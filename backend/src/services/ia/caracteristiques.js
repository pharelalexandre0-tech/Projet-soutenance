const { Op } = require('sequelize');
const { Note, Absence, IncidentComportement, FraisScolarite } = require('../../models');

const fr = (v, d = 1) => Number(v).toFixed(d).replace('.', ',');
const pct = (v) => `${Math.round(v * 100)} %`;

// Les signaux précoces utilisés par le modèle, disponibles en cours de
// semestre (avant les examens) : notes de contrôle continu, assiduité,
// comportement et régularité des paiements. `sens` : +1 si une valeur plus
// haute augmente le risque, -1 sinon (sert aux explications).
const CARACTERISTIQUES = [
  { cle: 'moyenneCC', libelle: 'Moyenne de contrôle continu', sens: -1, texte: (v) => `moyenne de CC ${fr(v)}/20` },
  { cle: 'partMatieresSous10', libelle: 'Part des matières sous 10 en CC', sens: 1, texte: (v) => `${pct(v)} des matières sous 10` },
  { cle: 'noteCCMin', libelle: 'Plus basse note de CC', sens: -1, texte: (v) => `note la plus basse ${fr(v)}/20` },
  { cle: 'ecartTypeCC', libelle: 'Irrégularité des notes (écart-type)', sens: 1, texte: (v) => `notes irrégulières (écart-type ${fr(v)})` },
  { cle: 'absencesNonJustifiees', libelle: 'Absences non justifiées', sens: 1, texte: (v) => `${v} absence${v > 1 ? 's' : ''} non justifiée${v > 1 ? 's' : ''}` },
  { cle: 'absencesJustifiees', libelle: 'Absences justifiées', sens: 1, texte: (v) => `${v} absence${v > 1 ? 's' : ''} justifiée${v > 1 ? 's' : ''}` },
  { cle: 'retards', libelle: 'Retards', sens: 1, texte: (v) => `${v} retard${v > 1 ? 's' : ''}` },
  { cle: 'incidentsMineurs', libelle: 'Incidents mineurs', sens: 1, texte: (v) => `${v} incident${v > 1 ? 's' : ''} mineur${v > 1 ? 's' : ''}` },
  { cle: 'incidentsMajeurs', libelle: 'Incidents majeurs', sens: 1, texte: (v) => `${v} incident${v > 1 ? 's' : ''} majeur${v > 1 ? 's' : ''}` },
  { cle: 'tauxFraisRegles', libelle: 'Part des frais réglés', sens: -1, texte: (v) => `frais réglés à ${pct(v)}` },
  { cle: 'fraisImpayes', libelle: 'Frais impayés (échéance dépassée)', sens: 1, texte: (v) => `${v} frais impayé${v > 1 ? 's' : ''}` },
];
const CLES = CARACTERISTIQUES.map((c) => c.cle);

function moyenne(valeurs) {
  return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
}

// Calcule les caractéristiques d'un vecteur de notes de CC (une par matière).
function depuisNotesCC(notesCC) {
  if (!notesCC.length) return { moyenneCC: null, partMatieresSous10: null, noteCCMin: null, ecartTypeCC: null };
  const m = moyenne(notesCC);
  const variance = moyenne(notesCC.map((n) => (n - m) ** 2));
  return {
    moyenneCC: m,
    partMatieresSous10: notesCC.filter((n) => n < 10).length / notesCC.length,
    noteCCMin: Math.min(...notesCC),
    ecartTypeCC: Math.sqrt(variance),
  };
}

// Caractéristiques d'un élève à partir de ses données dans PostgreSQL.
// Une valeur null (ex. aucune note encore saisie) est complétée par le
// modèle avec la médiane apprise.
async function caracteristiquesEleve(eleveId) {
  const [notes, absences, incidents, frais] = await Promise.all([
    Note.findAll({ where: { eleveId, session: 'normale', moyenneCC: { [Op.ne]: null } }, attributes: ['moyenneCC'] }),
    Absence.findAll({ where: { eleveId }, attributes: ['type', 'justifie'] }),
    IncidentComportement.findAll({ where: { eleveId }, attributes: ['gravite'] }),
    FraisScolarite.findAll({ where: { eleveId }, attributes: ['montant', 'montantRegle', 'statut'] }),
  ]);
  const totalFrais = frais.reduce((s, f) => s + f.montant, 0);
  return {
    ...depuisNotesCC(notes.map((n) => n.moyenneCC)),
    absencesNonJustifiees: absences.filter((a) => a.type !== 'retard' && !a.justifie).length,
    absencesJustifiees: absences.filter((a) => a.type !== 'retard' && a.justifie).length,
    retards: absences.filter((a) => a.type === 'retard').length,
    incidentsMineurs: incidents.filter((i) => i.gravite !== 'majeur').length,
    incidentsMajeurs: incidents.filter((i) => i.gravite === 'majeur').length,
    tauxFraisRegles: totalFrais > 0 ? Math.min(1, frais.reduce((s, f) => s + f.montantRegle, 0) / totalFrais) : 1,
    fraisImpayes: frais.filter((f) => f.statut === 'impaye').length,
  };
}

function versVecteur(caracteristiques, imputation = {}) {
  return CLES.map((cle) => {
    const v = caracteristiques[cle];
    return v === null || v === undefined || Number.isNaN(v) ? (imputation[cle] ?? 0) : Number(v);
  });
}

module.exports = { CARACTERISTIQUES, CLES, caracteristiquesEleve, depuisNotesCC, versVecteur };
