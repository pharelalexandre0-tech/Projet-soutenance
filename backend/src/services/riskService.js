const { Note, Absence, IncidentComportement } = require('../models');
const { calculerNoteFinale } = require('./moyenneService');

const SEUIL_ALERTE = 60; // sur 100

// "Collecter les données (notes, absences, comportement)" puis "Calculer le
// score de risque de décrochage / échec par élève" - diagramme d'activité 7.
// Heuristique simple et explicable (volontairement pas un vrai modèle de
// machine learning entraîné, ce qui serait hors de portée d'un prototype de
// soutenance) : plus la moyenne est basse, plus les absences non justifiées
// sont nombreuses et plus les incidents de comportement sont graves/répétés,
// plus le score de risque augmente.
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

  const facteurNotes = moyenneNotes !== null ? Math.max(0, (10 - moyenneNotes) * 6) : 20; // pas de notes = incertitude
  const facteurAbsences = Math.min(60, absencesNonJustifiees * 8);
  const facteurComportement = Math.min(30, incidentsMineurs * 4 + incidentsMajeurs * 10);

  const scoreRisque = Math.round(Math.min(100, facteurNotes + facteurAbsences + facteurComportement) * 10) / 10;
  const niveauRisque = scoreRisque >= SEUIL_ALERTE ? 'eleve' : scoreRisque >= 30 ? 'moyen' : 'faible';

  const facteursCles = [
    moyenneNotes !== null ? `moyenne ${moyenneNotes.toFixed(1)}/20` : 'pas encore de notes',
    `${absencesNonJustifiees} absence(s) non justifiée(s)`,
    `${incidents.length} incident(s) de comportement`,
  ].join(' ; ');

  return { scoreRisque, niveauRisque, facteursCles, alerteGeneree: scoreRisque >= SEUIL_ALERTE };
}

module.exports = { calculerRisqueEleve, SEUIL_ALERTE };
