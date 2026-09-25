const { Op } = require('sequelize');
const { ModeleIA, DonneeEntrainementIA, Eleve, Semestre } = require('../../models');
const { CLES, caracteristiquesEleve, versVecteur } = require('./caracteristiques');
const {
  generateur, melanger, entrainerForet, entrainerRegression, predireProbabilite, mesures, validationCroisee,
} = require('./algorithmes');
const { genererCohorte } = require('./cohorteHistorique');

const TAILLE_COHORTE = 3000;
const VERSIONS_CONSERVEES = 5;

function mediane(valeurs) {
  const v = valeurs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Cohorte historique de référence, enregistrée une fois dans PostgreSQL.
async function assurerCohorteHistorique() {
  if (await DonneeEntrainementIA.count({ where: { origine: 'historique_simule' } })) return;
  const cohorte = genererCohorte(TAILLE_COHORTE);
  await DonneeEntrainementIA.bulkCreate(cohorte.map((p) => ({ origine: 'historique_simule', caracteristiques: p.caracteristiques, etiquette: p.etiquette })));
}

// Dossiers réels dont l'issue est connue : semestre terminé (examens
// saisis pour toutes les matières). Étiquette = semestre non validé.
async function actualiserDonneesReelles() {
  const { calculerBulletin } = require('../moyenneService');
  await DonneeEntrainementIA.destroy({ where: { origine: 'etablissement' } });
  const eleves = await Eleve.findAll({ attributes: ['id', 'etablissementId'] });
  const semestresParEcole = new Map();
  const lignes = [];
  for (const eleve of eleves) {
    if (!semestresParEcole.has(eleve.etablissementId)) {
      semestresParEcole.set(eleve.etablissementId, await Semestre.findAll({ where: { etablissementId: eleve.etablissementId }, attributes: ['id'] }));
    }
    for (const semestre of semestresParEcole.get(eleve.etablissementId)) {
      const bulletin = await calculerBulletin(eleve.id, semestre.id);
      const matieres = bulletin.detailParUE.flatMap((ue) => ue.matieres || []);
      const termine = matieres.length > 0 && matieres.every((m) => m.moyenneExamen !== null && m.moyenneExamen !== undefined);
      if (!termine) continue;
      lignes.push({
        origine: 'etablissement', caracteristiques: await caracteristiquesEleve(eleve.id), etiquette: bulletin.admis ? 0 : 1,
        eleveId: eleve.id, semestreId: semestre.id, etablissementId: eleve.etablissementId,
      });
    }
  }
  if (lignes.length) await DonneeEntrainementIA.bulkCreate(lignes);
  return lignes.length;
}

// Entraîne les deux algorithmes, les compare par validation croisée
// (AUC moyenne), garde le meilleur, l'évalue sur un jeu de test jamais vu
// et l'enregistre comme modèle actif.
async function entrainerModele({ entraineParId = null } = {}) {
  const debut = Date.now();
  await assurerCohorteHistorique();
  const reels = await actualiserDonneesReelles();
  const donnees = await DonneeEntrainementIA.findAll({ attributes: ['caracteristiques', 'etiquette', 'origine'] });

  const imputation = Object.fromEntries(CLES.map((cle) => [cle, mediane(donnees.map((d) => d.caracteristiques[cle]))]));
  const alea = generateur(2026);
  const ordre = melanger([...donnees.keys()], alea);
  const nTest = Math.round(ordre.length * 0.25);
  const iTest = ordre.slice(0, nTest);
  const iApp = ordre.slice(nTest);
  const X = donnees.map((d) => versVecteur(d.caracteristiques, imputation));
  const y = donnees.map((d) => d.etiquette);
  const Xa = iApp.map((i) => X[i]);
  const ya = iApp.map((i) => y[i]);
  const Xt = iTest.map((i) => X[i]);
  const yt = iTest.map((i) => y[i]);

  const cvForet = validationCroisee(Xa, ya, (a, b) => entrainerForet(a, b, { nbArbres: 50 }), 5);
  const cvRegression = validationCroisee(Xa, ya, (a, b) => entrainerRegression(a, b, { epoques: 600 }), 5);
  const foret = entrainerForet(Xa, ya);
  const regression = entrainerRegression(Xa, ya);
  const testForet = mesures(yt, Xt.map((x) => predireProbabilite(foret, x)));
  const testRegression = mesures(yt, Xt.map((x) => predireProbabilite(regression, x)));

  const choisi = cvForet.aucMoyenne >= cvRegression.aucMoyenne ? foret : regression;
  const metriques = choisi === foret ? testForet : testRegression;
  const negatifs = iApp.filter((i) => y[i] === 0);
  const reference = Object.fromEntries(CLES.map((cle, j) => [cle, mediane(negatifs.map((i) => X[i][j]))]));
  const { importances, ...parametresAppris } = choisi;

  const precedent = await ModeleIA.max('version');
  await ModeleIA.update({ actif: false }, { where: { actif: true } });
  const modele = await ModeleIA.create({
    version: (precedent || 0) + 1,
    algorithme: choisi.type,
    actif: true,
    caracteristiques: CLES,
    parametres: choisi.parametres,
    modele: parametresAppris,
    metriques,
    comparaison: {
      foret_aleatoire: { validationCroisee: cvForet, test: testForet },
      regression_logistique: { validationCroisee: cvRegression, test: testRegression },
    },
    importances: Object.fromEntries(CLES.map((cle, j) => [cle, Math.round(importances[j] * 1000) / 1000])),
    imputation,
    reference,
    donnees: {
      total: donnees.length,
      apprentissage: iApp.length,
      test: iTest.length,
      historiqueSimule: donnees.length - reels,
      reels,
      tauxEchec: Math.round((y.filter(Boolean).length / y.length) * 1000) / 1000,
    },
    entraineParId,
    dureeMs: Date.now() - debut,
  });

  // On ne garde que les dernières versions (les arbres prennent de la place).
  const anciennes = await ModeleIA.findAll({ where: { actif: false }, order: [['version', 'DESC']], offset: VERSIONS_CONSERVEES - 1, attributes: ['id'] });
  if (anciennes.length) await ModeleIA.destroy({ where: { id: { [Op.in]: anciennes.map((m) => m.id) } } });
  return modele;
}

module.exports = { entrainerModele };
