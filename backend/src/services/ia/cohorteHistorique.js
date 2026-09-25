const { generateur } = require('./algorithmes');
const { depuisNotesCC } = require('./caracteristiques');

// Cohorte historique de référence pour démarrer l'apprentissage.
//
// Un établissement qui ouvre n'a pas encore d'historique d'élèves dont on
// connaît l'issue (réussite ou échec du semestre). On simule donc des
// parcours passés à partir de facteurs cachés (aptitude, engagement,
// précarité) : ces facteurs influencent à la fois les signaux observables
// (notes de CC, absences, incidents, paiements) et l'issue du semestre, avec
// des effets non linéaires et du bruit, comme dans la réalité. Le modèle ne
// voit jamais les facteurs cachés : il doit apprendre à reconnaître l'issue
// à partir des seuls signaux, exactement comme sur de vraies données. Les
// dossiers réels des établissements (semestres terminés) s'ajoutent à cette
// base à chaque entraînement.

function normale(alea) {
  const u = Math.max(alea(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * alea());
}

function poisson(lambda, alea) {
  const limite = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k += 1; p *= alea(); } while (p > limite);
  return k - 1;
}

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const sigmoide = (z) => 1 / (1 + Math.exp(-z));

function genererParcours(alea) {
  const aptitude = normale(alea);
  const engagement = normale(alea);
  const precarite = normale(alea);

  const niveau = 11 + 2.4 * aptitude + 1.3 * engagement;
  const notesCC = Array.from({ length: 9 }, () => Math.round(borner(niveau + 2.2 * normale(alea), 0, 20) * 4) / 4);
  const absencesNonJustifiees = poisson(Math.exp(0.55 - 0.85 * engagement + 0.35 * precarite), alea);
  const absencesJustifiees = poisson(Math.exp(0.1 + 0.15 * precarite), alea);
  const retards = poisson(Math.exp(0.35 - 0.6 * engagement), alea);
  const incidentsMineurs = poisson(Math.exp(-1.2 - 0.9 * engagement), alea);
  const incidentsMajeurs = poisson(Math.exp(-3 - 1.1 * engagement), alea);
  const tauxFraisRegles = Math.round(borner(sigmoide(1.6 - 1.3 * precarite + 0.7 * normale(alea)) + 0.1, 0, 1) * 20) / 20;
  const fraisImpayes = tauxFraisRegles < 0.5 ? (alea() < 0.7 ? 1 : 2) : 0;

  const cc = depuisNotesCC(notesCC);
  // Issue du semestre : dépend des facteurs cachés et de seuils (effets
  // non linéaires), plus une part d'imprévu.
  const z = -1.0 * aptitude - 1.6 * engagement + 0.7 * precarite
    + 1.2 * (absencesNonJustifiees >= 8 ? 1 : 0)
    + 0.9 * (incidentsMajeurs >= 1 ? 1 : 0)
    + 0.8 * (cc.moyenneCC < 8 ? 1 : 0)
    + 0.6 * (fraisImpayes > 0 && absencesNonJustifiees >= 4 ? 1 : 0)
    + 0.9 * normale(alea) - 1.1;
  const etiquette = alea() < sigmoide(2.2 * z) ? 1 : 0;

  return {
    caracteristiques: {
      ...cc, absencesNonJustifiees, absencesJustifiees, retards, incidentsMineurs, incidentsMajeurs, tauxFraisRegles, fraisImpayes,
    },
    etiquette,
  };
}

function genererCohorte(taille = 3000, graine = 2026) {
  const alea = generateur(graine);
  return Array.from({ length: taille }, () => genererParcours(alea));
}

module.exports = { genererCohorte };
