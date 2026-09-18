const { Note, Absence, IncidentComportement } = require('../models');
const { calculerNoteFinale } = require('./moyenneService');
const { predireProbabilite } = require('./logisticRegression');
const modele = require('./modeleRisque.json');

const SEUIL_ALERTE = 60; // sur 100

// "Collecter les données (notes, absences, comportement)" puis "Calculer le
// score de risque de décrochage / échec par élève" - diagramme d'activité 7.
// scoreRisque = probabilité prédite par une régression logistique entraînée
// (scripts/entrainerModeleRisque.js, npm run train:risque), pas une formule
// à poids choisis à la main — voir modeleRisque.json pour les poids appris
// et les métriques mesurées sur le jeu de test (exactitude, précision, rappel).
async function calculerRisqueEleve(eleveId) {
  const [notes, absences, incidents] = await Promise.all([
    Note.findAll({ where: { eleveId, session: 'normale' } }),
    Absence.findAll({ where: { eleveId } }),
    IncidentComportement.findAll({ where: { eleveId } }),
  ]);

  const notesFinales = notes
    .map((n) => calculerNoteFinale(n.moyenneCC, n.moyenneExamen))
    .filter((v) => v !== null);
  const moyenneNotes =
    notesFinales.length > 0 ? notesFinales.reduce((acc, v) => acc + v, 0) / notesFinales.length : null;
  const absencesNonJustifiees = absences.filter((a) => !a.justifie).length;
  const incidentsMajeurs = incidents.filter((i) => i.gravite === 'majeur').length;
  const incidentsMineurs = incidents.length - incidentsMajeurs;

  // Mêmes conventions de normalisation [0,1] que le jeu d'entraînement
  // synthétique — un score ne veut dire quelque chose que si l'inférence
  // utilise exactement les caractéristiques sur lesquelles le modèle a
  // appris. Pas de notes = 0.5 (incertitude), ni bon ni mauvais signe.
  const caracteristiques = [
    moyenneNotes !== null ? (20 - moyenneNotes) / 20 : 0.5,
    Math.min(absencesNonJustifiees / 10, 1),
    Math.min((incidentsMineurs + 2 * incidentsMajeurs) / 6, 1),
  ];

  const probabilite = predireProbabilite(caracteristiques, modele.poids, modele.biais);
  const scoreRisque = Math.round(probabilite * 1000) / 10; // 0-100, une décimale
  const niveauRisque = scoreRisque >= SEUIL_ALERTE ? 'eleve' : scoreRisque >= 30 ? 'moyen' : 'faible';

  const facteursCles = [
    moyenneNotes !== null ? `moyenne ${moyenneNotes.toFixed(1)}/20` : 'pas encore de notes',
    `${absencesNonJustifiees} absence(s) non justifiée(s)`,
    `${incidents.length} incident(s) de comportement`,
  ].join(' ; ');

  return { scoreRisque, niveauRisque, facteursCles, alerteGeneree: scoreRisque >= SEUIL_ALERTE };
}

module.exports = { calculerRisqueEleve, SEUIL_ALERTE };
