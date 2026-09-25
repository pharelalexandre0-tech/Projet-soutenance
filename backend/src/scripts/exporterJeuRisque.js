// Jeu de test du modèle de risque de décrochage : `npm run export:jeu-risque`.
//
// Génère, avec une graine fixe (donc toujours le même fichier), un jeu de
// profils d'élèves selon exactement le même procédé que l'entraînement
// (scripts/entrainerModeleRisque.js), puis évalue le modèle ACTUEL
// (services/modeleRisque.json) sur ces exemples qu'il n'a jamais vus. Le
// modèle n'est pas modifié. Sorties dans donnees-test/ia/ :
//   - jeu_test_risque.csv : un élève par ligne (profil, caractéristiques
//     normalisées, étiquette, probabilité prédite, prédiction) ;
//   - evaluation_modele.json : exactitude, précision, rappel, F1, matrice
//     de confusion.
const fs = require('fs');
const path = require('path');
const { sigmoide, predireProbabilite, evaluer } = require('../services/logisticRegression');
const modele = require('../services/modeleRisque.json');

const N_EXEMPLES = 500;
const POIDS_VERITE = { notes: 3.5, absences: 2.5, comportement: 2.0, biais: -3.0 };
const SORTIE = path.join(__dirname, '..', '..', '..', 'donnees-test', 'ia');

let graine = 424242;
function alea() {
  graine = (graine + 0x6D2B79F5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + alea() * (max - min);

function genererExemple() {
  const moyenne = entre(0, 20);
  const absencesNonJustifiees = Math.round(entre(0, 14));
  const incidentsMineurs = alea() < 0.75 ? 0 : Math.round(entre(0, 3));
  const incidentsMajeurs = alea() < 0.9 ? 0 : Math.round(entre(0, 2));
  const x = [(20 - moyenne) / 20, Math.min(absencesNonJustifiees / 10, 1), Math.min((incidentsMineurs + 2 * incidentsMajeurs) / 6, 1)];
  const z = POIDS_VERITE.notes * x[0] + POIDS_VERITE.absences * x[1] + POIDS_VERITE.comportement * x[2] + POIDS_VERITE.biais;
  const etiquette = alea() < sigmoide(z) ? 1 : 0;
  return { moyenne, absencesNonJustifiees, incidentsMineurs, incidentsMajeurs, x, etiquette };
}

const exemples = Array.from({ length: N_EXEMPLES }, genererExemple);
const X = exemples.map((e) => e.x);
const y = exemples.map((e) => e.etiquette);
const metriques = evaluer(X, y, modele.poids, modele.biais);

fs.mkdirSync(SORTIE, { recursive: true });
const entete = 'id;moyenne_sur_20;absences_non_justifiees;incidents_mineurs;incidents_majeurs;x_notes;x_absences;x_comportement;etiquette_reelle;probabilite_predite;score_risque_sur_100;niveau;prediction';
const lignes = exemples.map((e, i) => {
  const p = predireProbabilite(e.x, modele.poids, modele.biais);
  const score = Math.round(p * 1000) / 10;
  const niveau = score >= 60 ? 'eleve' : score >= 30 ? 'moyen' : 'faible';
  const f = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');
  return [i + 1, f(e.moyenne), e.absencesNonJustifiees, e.incidentsMineurs, e.incidentsMajeurs, f(e.x[0]), f(e.x[1]), f(e.x[2]), e.etiquette, f(p), String(score).replace('.', ','), niveau, p >= 0.5 ? 1 : 0].join(';');
});
fs.writeFileSync(path.join(SORTIE, 'jeu_test_risque.csv'), `﻿${entete}\n${lignes.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(SORTIE, 'evaluation_modele.json'), JSON.stringify({
  modele: { entraineLe: modele.entraineLe, caracteristiques: modele.caracteristiques, poids: modele.poids, biais: modele.biais },
  jeuTest: { taille: N_EXEMPLES, graine: 424242, positifs: y.filter(Boolean).length, negatifs: y.filter((v) => !v).length },
  seuilDecision: 0.5,
  metriques,
}, null, 2), 'utf8');

console.log(`Jeu de test : ${N_EXEMPLES} profils (${y.filter(Boolean).length} à risque), écrit dans ${SORTIE}`);
console.log('Métriques du modèle actuel :', metriques);
