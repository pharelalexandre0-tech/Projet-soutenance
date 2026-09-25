const { Op } = require('sequelize');
const {
  CompteRenduSaisie, CompteEphemere, Classe, Professeur, Matiere, Eleve, Absence, Note,
} = require('../models');

function trier(eleves) {
  return [...eleves].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
}

function dateDuJour() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function contexte(compte) {
  const [classe, professeur, matiere] = await Promise.all([
    Classe.findByPk(compte.classeId),
    Professeur.findByPk(compte.professeurId),
    compte.matiereId ? Matiere.findByPk(compte.matiereId) : null,
  ]);
  return {
    compteEphemereId: compte.id,
    classeId: compte.classeId,
    professeurId: compte.professeurId,
    matiereId: compte.matiereId || null,
    etablissementId: classe?.etablissementId || null,
    classeNom: classe ? `${classe.nom} (${classe.niveau})` : null,
    professeurNom: professeur ? `${professeur.prenom} ${professeur.nom}` : null,
    matiereNom: matiere?.intitule || null,
    categorie: compte.categorie || null,
    evaluationLibelle: compte.evaluationLibelle || null,
  };
}

async function enregistrer(compte, donnees) {
  const existant = await CompteRenduSaisie.findOne({ where: { compteEphemereId: compte.id } });
  return existant ? existant.update(donnees) : CompteRenduSaisie.create(donnees);
}

// Feuille d'appel complète envoyée par un professeur : chaque élève de la
// classe avec son statut (présent, absent, en retard).
async function consignerAppel(compte, { eleves, marques, date, envoyeLe = new Date() }) {
  const statutDe = new Map(marques.map((m) => [m.eleveId, m.type === 'retard' ? 'retard' : 'absent']));
  const lignes = trier(eleves).map((e) => ({
    eleveId: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule || null, statut: statutDe.get(e.id) || 'present',
  }));
  const resume = {
    presents: lignes.filter((l) => l.statut === 'present').length,
    absents: lignes.filter((l) => l.statut === 'absent').length,
    retards: lignes.filter((l) => l.statut === 'retard').length,
  };
  return enregistrer(compte, { ...(await contexte(compte)), tache: 'saisie_absences', date: date || dateDuJour(), resume, lignes, envoyeLe });
}

// Notes envoyées par un professeur : chaque élève de la classe avec la
// moyenne saisie (ou aucune).
async function consignerNotes(compte, { eleves, notes, envoyeLe = new Date() }) {
  const valeurDe = new Map(notes.map((n) => [n.eleveId, Number(n.valeur)]));
  const lignes = trier(eleves).map((e) => ({
    eleveId: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule || null,
    valeur: valeurDe.has(e.id) && Number.isFinite(valeurDe.get(e.id)) ? valeurDe.get(e.id) : null,
  }));
  const valeurs = lignes.map((l) => l.valeur).filter((v) => v !== null);
  const resume = {
    saisies: valeurs.length,
    sansNote: lignes.length - valeurs.length,
    moyenne: valeurs.length ? Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 100) / 100 : null,
    min: valeurs.length ? Math.min(...valeurs) : null,
    max: valeurs.length ? Math.max(...valeurs) : null,
  };
  const date = new Date(envoyeLe);
  const jour = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return enregistrer(compte, { ...(await contexte(compte)), tache: 'saisie_notes', date: jour, resume, lignes, envoyeLe });
}

function presenterResume(cr) {
  return {
    id: cr.id,
    compteEphemereId: cr.compteEphemereId,
    tache: cr.tache,
    date: cr.date,
    envoyeLe: cr.envoyeLe,
    classeId: cr.classeId,
    classe: cr.classeNom,
    professeur: cr.professeurNom,
    matiere: cr.matiereNom,
    categorie: cr.categorie,
    evaluation: cr.evaluationLibelle,
    resume: cr.resume,
    effectif: (cr.lignes || []).length,
  };
}

// Détail pour l'Académie. Pour un appel, on ajoute l'état actuel de chaque
// absence (justifiée ou non, motif), qui peut avoir changé depuis l'envoi.
async function presenterDetail(cr) {
  let lignes = cr.lignes || [];
  if (cr.tache === 'saisie_absences' && cr.compteEphemereId) {
    const absences = await Absence.findAll({ where: { compteEphemereId: cr.compteEphemereId } });
    const parEleve = new Map(absences.map((a) => [a.eleveId, a]));
    lignes = lignes.map((l) => {
      const absence = parEleve.get(l.eleveId);
      return absence ? { ...l, justifie: !!absence.justifie, motif: absence.motif || null } : l;
    });
  }
  return { ...presenterResume(cr), lignes };
}

// Au démarrage : les accès déjà terminés avant l'existence de cette table
// retrouvent leur compte rendu, reconstitué à partir des absences ou des
// notes enregistrées avec leur jeton.
async function reconstituerComptesRendus() {
  const deja = await CompteRenduSaisie.findAll({ attributes: ['compteEphemereId'] });
  const traites = new Set(deja.map((c) => c.compteEphemereId));
  const comptes = await CompteEphemere.findAll({ where: { tache: { [Op.in]: ['saisie_notes', 'saisie_absences'] } } });
  let n = 0;
  for (const compte of comptes) {
    if (traites.has(compte.id)) continue;
    const eleves = await Eleve.findAll({ where: { classeId: compte.classeId } });
    if (compte.tache === 'saisie_absences') {
      const absences = await Absence.findAll({ where: { compteEphemereId: compte.id } });
      if (!absences.length && !compte.saisieEnvoyeeLe) continue;
      await consignerAppel(compte, {
        eleves,
        marques: absences.map((a) => ({ eleveId: a.eleveId, type: a.type })),
        date: absences[0]?.date || null,
        envoyeLe: compte.saisieEnvoyeeLe || absences[0]?.createdAt || compte.updatedAt,
      });
    } else {
      const notes = await Note.findAll({ where: { compteEphemereId: compte.id } });
      if (!notes.length && !compte.saisieEnvoyeeLe) continue;
      const champ = compte.categorie === 'examen' ? 'moyenneExamen' : 'moyenneCC';
      await consignerNotes(compte, {
        eleves,
        notes: notes.filter((note) => note[champ] !== null && note[champ] !== undefined).map((note) => ({ eleveId: note.eleveId, valeur: note[champ] })),
        envoyeLe: compte.saisieEnvoyeeLe || notes[0]?.updatedAt || compte.updatedAt,
      });
    }
    n += 1;
  }
  if (n) console.log(`Comptes rendus : ${n} saisie(s) de professeur reconstituée(s).`);
}

module.exports = { consignerAppel, consignerNotes, presenterResume, presenterDetail, reconstituerComptesRendus };
