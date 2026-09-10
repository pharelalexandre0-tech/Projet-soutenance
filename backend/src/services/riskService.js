const { Note, Absence } = require('../models');
const { calculerNoteFinale } = require('./moyenneService');

const SEUIL_ALERTE = 60; // sur 100

// "Collecter les données (notes, absences, comportement)" puis "Calculer le
// score de risque de décrochage / échec par élève" - diagramme d'activité 7.
// Heuristique simple et explicable (volontairement pas un vrai modèle de
// machine learning entraîné, ce qui serait hors de portée d'un prototype de
// soutenance) : plus la moyenne est basse et plus les absences non
// justifiées sont nombreuses, plus le score de risque augmente.
async function calculerRisqueEleve(eleveId) {
  const notes = await Note.findAll({ where: { eleveId, session: 'normale' } });
  const absences = await Absence.findAll({ where: { eleveId } });

  const notesFinales = notes
    .map((n) => calculerNoteFinale(n.moyenneCC, n.moyenneExamen))
    .filter((v) => v !== null);
  const moyenneNotes =
    notesFinales.length > 0 ? notesFinales.reduce((acc, v) => acc + v, 0) / notesFinales.length : null;
  const absencesNonJustifiees = absences.filter((a) => !a.justifie).length;

  const facteurNotes = moyenneNotes !== null ? Math.max(0, (10 - moyenneNotes) * 6) : 20; // pas de notes = incertitude
  const facteurAbsences = Math.min(60, absencesNonJustifiees * 8);

  const scoreRisque = Math.round(Math.min(100, facteurNotes + facteurAbsences) * 10) / 10;
  const niveauRisque = scoreRisque >= SEUIL_ALERTE ? 'eleve' : scoreRisque >= 30 ? 'moyen' : 'faible';

  const facteursCles = [
    moyenneNotes !== null ? `moyenne ${moyenneNotes.toFixed(1)}/20` : 'pas encore de notes',
    `${absencesNonJustifiees} absence(s) non justifiée(s)`,
  ].join(' ; ');

  return { scoreRisque, niveauRisque, facteursCles, alerteGeneree: scoreRisque >= SEUIL_ALERTE };
}

module.exports = { calculerRisqueEleve, SEUIL_ALERTE };
