// Entraînement du modèle de prédiction de risque de décrochage.
// `npm run train:risque` — à relancer quand l'établissement dispose de
// suffisamment de vrais dossiers d'élèves (voir la fonction
// `construireJeuReel` en bas de fichier, non utilisée pour l'instant).
//
// Faute d'historique réel de décrochage (l'établissement vient d'ouvrir),
// le jeu d'entraînement est SYNTHÉTIQUE : on simule des profils d'élèves
// plausibles, on tire leur étiquette (à risque / pas à risque) selon un
// modèle probabiliste construit à dire d'expert plutôt qu'un seuil brutal
// (le bruit dans le tirage imite le fait qu'un vrai décrochage ne dépend
// jamais QUE de ces 3 facteurs). La régression logistique apprend ensuite
// ses propres poids à partir de ces exemples, par descente de gradient —
// c'est un apprentissage faiblement supervisé (weak supervision), une
// technique reconnue pour démarrer un modèle avant d'avoir de vraies
// données labellisées.
const fs = require('fs');
const path = require('path');
const { entrainer, evaluer } = require('../services/logisticRegression');

const N_EXEMPLES = 1200;
const FRACTION_TEST = 0.3;

// Poids "vérité terrain" utilisés UNIQUEMENT pour générer les étiquettes
// synthétiques — la régression logistique ne les connaît pas, elle doit
// les redécouvrir à partir des exemples (X, y) seuls, exactement comme un
// vrai jeu de données. Toutes les caractéristiques sont orientées "plus
// haut = plus à risque", pour que des poids positifs restent lisibles.
const POIDS_VERITE = { notes: 3.5, absences: 2.5, comportement: 2.0, biais: -3.0 };

function sigmoide(z) {
  return 1 / (1 + Math.exp(-z));
}

function alea(min, max) {
  return min + Math.random() * (max - min);
}

// Génère un élève plausible et ses 3 caractéristiques normalisées [0,1] —
// mêmes conventions que riskService.calculerRisqueEleve (moyenne/20,
// absences plafonnées, incidents pondérés par gravité).
function genererExemple() {
  const moyenne = alea(0, 20);
  const absencesNonJustifiees = Math.round(alea(0, 14));
  const incidentsMineurs = Math.random() < 0.75 ? 0 : Math.round(alea(0, 3));
  const incidentsMajeurs = Math.random() < 0.9 ? 0 : Math.round(alea(0, 2));

  const caracteristiques = [
    (20 - moyenne) / 20,
    Math.min(absencesNonJustifiees / 10, 1),
    Math.min((incidentsMineurs + 2 * incidentsMajeurs) / 6, 1),
  ];

  const zVerite =
    POIDS_VERITE.notes * caracteristiques[0] +
    POIDS_VERITE.absences * caracteristiques[1] +
    POIDS_VERITE.comportement * caracteristiques[2] +
    POIDS_VERITE.biais;
  const probabiliteVerite = sigmoide(zVerite);
  // Tirage de Bernoulli plutôt qu'un seuil : deux élèves avec le même
  // profil ne partagent pas forcément la même issue dans la réalité.
  const etiquette = Math.random() < probabiliteVerite ? 1 : 0;

  return { caracteristiques, etiquette, profil: { moyenne, absencesNonJustifiees, incidentsMineurs, incidentsMajeurs } };
}

function melanger(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

(function main() {
  const exemples = melanger(Array.from({ length: N_EXEMPLES }, genererExemple));
  const nTest = Math.round(N_EXEMPLES * FRACTION_TEST);
  const entrainement = exemples.slice(nTest);
  const test = exemples.slice(0, nTest);

  const X_train = entrainement.map((e) => e.caracteristiques);
  const y_train = entrainement.map((e) => e.etiquette);
  const X_test = test.map((e) => e.caracteristiques);
  const y_test = test.map((e) => e.etiquette);

  console.log(`Entraînement sur ${X_train.length} exemples, test sur ${X_test.length}...`);
  const { poids, biais, historiqueCout } = entrainer(X_train, y_train);
  console.log('Coût (entropie croisée) toutes les 200 époques :', historiqueCout.map((h) => h.cout).join(' -> '));

  const metriquesTrain = evaluer(X_train, y_train, poids, biais);
  const metriquesTest = evaluer(X_test, y_test, poids, biais);
  console.log('Métriques (train) :', metriquesTrain);
  console.log('Métriques (test)  :', metriquesTest);
  console.log('Poids appris : notes=%s, absences=%s, comportement=%s, biais=%s',
    poids[0].toFixed(3), poids[1].toFixed(3), poids[2].toFixed(3), biais.toFixed(3));

  const modele = {
    version: 1,
    entraineLe: new Date().toISOString(),
    caracteristiques: ['notes', 'absences', 'comportement'],
    poids,
    biais,
    metriquesTest,
    tailleJeuEntrainement: X_train.length,
    tailleJeuTest: X_test.length,
    origineDonnees: 'synthetique_faiblement_supervisee',
  };
  const cheminSortie = path.join(__dirname, '..', 'services', 'modeleRisque.json');
  fs.writeFileSync(cheminSortie, JSON.stringify(modele, null, 2));
  console.log('Modèle sauvegardé :', cheminSortie);
})();

// Quand l'établissement aura accumulé assez d'élèves avec une issue connue
// (ex. un champ statut='decroche'/'diplome' sur Eleve, à ajouter le moment
// venu), cette fonction remplacera genererExemple : mêmes 3 caractéristiques,
// mais l'étiquette viendrait de l'issue réelle au lieu d'un tirage simulé.
// eslint-disable-next-line no-unused-vars
async function construireJeuReel() {
  throw new Error('pas encore de données réelles suffisantes — voir le commentaire ci-dessus');
}
