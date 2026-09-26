const { ModeleIA } = require('../models');
const { CARACTERISTIQUES, caracteristiquesEleve, versVecteur } = require('./ia/caracteristiques');
const { predireProbabilite } = require('./ia/algorithmes');
const { entrainerModele } = require('./ia/entrainement');

const SEUIL_ALERTE = 60; // sur 100
const SEUIL_MOYEN = 30;

// "Collecter les données puis calculer le score de risque" (diagramme
// d'activité 7). Le score est la probabilité d'échec du semestre prédite par
// le modèle d'apprentissage automatique actif (forêt aléatoire ou régression
// logistique, choisi par validation croisée, voir services/ia), à partir des
// signaux observés en cours de semestre.
let modeleEnCache = null;

async function modeleActif() {
  if (modeleEnCache) return modeleEnCache;
  let modele = await ModeleIA.findOne({ where: { actif: true } });
  if (!modele) modele = await entrainerModele();
  modeleEnCache = modele.toJSON();
  return modeleEnCache;
}

function oublierModele() {
  modeleEnCache = null;
}

// Au démarrage : un modèle doit exister (entraîné à la première mise en route).
async function assurerModeleIA() {
  const modele = await modeleActif();
  console.log(`Modèle de prédiction actif : v${modele.version} (${modele.algorithme}), AUC ${modele.metriques.auc}.`);
}

async function calculerRisqueEleve(eleveId) {
  const modele = await modeleActif();
  const caracteristiques = await caracteristiquesEleve(eleveId);
  const x = versVecteur(caracteristiques, modele.imputation);
  const probabilite = predireProbabilite(modele.modele, x);
  const scoreRisque = Math.round(probabilite * 1000) / 10;
  const niveauRisque = scoreRisque >= SEUIL_ALERTE ? 'eleve' : scoreRisque >= SEUIL_MOYEN ? 'moyen' : 'faible';

  // Explication locale : pour chaque signal, de combien la probabilité
  // baisserait si l'élève avait la valeur typique d'un élève qui réussit.
  const facteurs = CARACTERISTIQUES.map((c, j) => {
    if (caracteristiques[c.cle] === null || caracteristiques[c.cle] === undefined) return null;
    const xReference = [...x];
    xReference[j] = modele.reference[c.cle];
    return { cle: c.cle, libelle: c.libelle, texte: c.texte(caracteristiques[c.cle]), impact: probabilite - predireProbabilite(modele.modele, xReference) };
  })
    .filter((f) => f && f.impact > 0.015)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((f) => ({ ...f, impact: Math.round(f.impact * 1000) / 10 }));

  return {
    scoreRisque,
    niveauRisque,
    alerteGeneree: scoreRisque >= SEUIL_ALERTE,
    facteursCles: JSON.stringify({
      facteurs,
      sansNotes: caracteristiques.moyenneCC === null,
      modele: { version: modele.version, algorithme: modele.algorithme },
    }),
  };
}

module.exports = { calculerRisqueEleve, modeleActif, oublierModele, assurerModeleIA };
