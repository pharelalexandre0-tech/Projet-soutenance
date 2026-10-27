const { Eleve, Matiere, Note, ReclamationNote, Notification, Utilisateur, UniteEnseignement } = require('../models');
const { journaliserAudit } = require('../services/auditService');

// Réclamations de notes : déposées par l'étudiant (ou son parent depuis le
// même compte), instruites par l'Académie.
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

async function eleveDuCompte(req) {
  return Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } });
}

const versJSON = (r) => ({
  ...r.toJSON(),
  eleve: r.Eleve ? { id: r.Eleve.id, nom: r.Eleve.nom, prenom: r.Eleve.prenom, matricule: r.Eleve.matricule } : undefined,
  matiere: r.Matiere ? { id: r.Matiere.id, code: r.Matiere.code, intitule: r.Matiere.intitule } : undefined,
  Eleve: undefined, Matiere: undefined,
});

// Étudiant : ses réclamations et les matières où il a une note.
async function mesReclamations(req, res) {
  const eleve = await eleveDuCompte(req);
  if (!eleve) return res.status(404).json({ erreur: 'dossier étudiant introuvable' });
  const reclamations = await ReclamationNote.findAll({ where: { eleveId: eleve.id }, include: [Matiere], order: [['createdAt', 'DESC']] });
  const notes = await Note.findAll({ where: { eleveId: eleve.id }, include: [{ model: Matiere, attributes: ['id', 'code', 'intitule'] }] });
  return res.json({
    reclamations: reclamations.map(versJSON),
    matieres: notes.filter((n) => n.Matiere).map((n) => ({ id: n.Matiere.id, code: n.Matiere.code, intitule: n.Matiere.intitule, session: n.session, moyenneCC: n.moyenneCC, moyenneExamen: n.moyenneExamen })),
  });
}

async function deposer(req, res) {
  const eleve = await eleveDuCompte(req);
  if (!eleve) return res.status(404).json({ erreur: 'dossier étudiant introuvable' });
  const { matiereId, categorie, motif, session = 'normale' } = req.body || {};
  if (!['cc', 'examen'].includes(categorie)) return res.status(400).json({ erreur: 'précisez la note contestée (contrôle continu ou examen)' });
  if (String(motif || '').trim().length < 15) return res.status(400).json({ erreur: 'expliquez votre réclamation (15 caractères au moins)' });
  const note = await Note.findOne({ where: { eleveId: eleve.id, matiereId, session } });
  if (!note) return res.status(404).json({ erreur: 'aucune note enregistrée pour cette matière' });
  const enCours = await ReclamationNote.findOne({ where: { eleveId: eleve.id, matiereId, categorie, statut: 'en_attente' } });
  if (enCours) return res.status(409).json({ erreur: 'une réclamation sur cette note est déjà en cours d’examen' });
  const reclamation = await ReclamationNote.create({
    etablissementId: eleve.etablissementId, eleveId: eleve.id, matiereId, categorie, session, motif: String(motif).trim().slice(0, 2000),
    ancienneValeur: categorie === 'cc' ? note.moyenneCC : note.moyenneExamen, deposeeParParent: Boolean(req.sessionParent),
  });
  const academies = await Utilisateur.findAll({ where: { etablissementId: eleve.etablissementId, role: 'academie' }, attributes: ['id'] });
  const matiere = await Matiere.findByPk(matiereId, { attributes: ['intitule'] });
  await Notification.bulkCreate(academies.map((u) => ({
    utilisateurId: u.id, dateEnvoi: new Date(), contenu: `Réclamation de note : ${eleve.prenom} ${eleve.nom}, ${matiere?.intitule || 'matière'} (${categorie === 'cc' ? 'contrôle continu' : 'examen'}).`,
  }))).catch(() => {});
  return res.status(201).json({ reclamation });
}

// Académie : réclamations de l'école.
async function lister(req, res) {
  const where = { etablissementId: req.utilisateur.etablissementId };
  if (['en_attente', 'acceptee', 'rejetee'].includes(req.query.statut)) where.statut = req.query.statut;
  const reclamations = await ReclamationNote.findAll({ where, include: [Eleve, { model: Matiere, include: [{ model: UniteEnseignement, attributes: ['code'] }] }], order: [['createdAt', 'DESC']], limit: 300 });
  const enAttente = await ReclamationNote.count({ where: { etablissementId: req.utilisateur.etablissementId, statut: 'en_attente' } });
  return res.json({ reclamations: reclamations.map(versJSON), enAttente });
}

async function traiter(req, res) {
  const reclamation = await ReclamationNote.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId }, include: [Eleve, Matiere] });
  if (!reclamation) return res.status(404).json({ erreur: 'réclamation introuvable' });
  if (reclamation.statut !== 'en_attente') return res.status(409).json({ erreur: 'réclamation déjà traitée' });
  const { decision, reponse, nouvelleValeur } = req.body || {};
  if (!['acceptee', 'rejetee'].includes(decision)) return res.status(400).json({ erreur: 'décision invalide' });
  if (String(reponse || '').trim().length < 10) return res.status(400).json({ erreur: 'rédigez une réponse à l’étudiant (10 caractères au moins)' });
  let valeur = null;
  if (decision === 'acceptee' && nouvelleValeur !== undefined && nouvelleValeur !== '' && nouvelleValeur !== null) {
    // Même chemin que toute saisie : échelle 0 à 20, verrou de délibération.
    const { enregistrerMoyenne } = require('./notesController');
    const resultat = await enregistrerMoyenne({
      eleveId: reclamation.eleveId, matiereId: reclamation.matiereId, categorie: reclamation.categorie === 'cc' ? 'cc' : 'examen',
      valeur: nouvelleValeur, session: reclamation.session, saisiParAcademieId: req.utilisateur.id, etablissementId: req.utilisateur.etablissementId,
    });
    valeur = reclamation.categorie === 'cc' ? resultat.moyenneCC : resultat.moyenneExamen;
  }
  await reclamation.update({ statut: decision, reponse: String(reponse).trim(), nouvelleValeur: valeur, traiteeParNom: nomAgent(req.utilisateur), traiteeLe: new Date() });
  if (reclamation.Eleve?.compteEtudiantId) {
    await Notification.create({
      utilisateurId: reclamation.Eleve.compteEtudiantId, dateEnvoi: new Date(),
      contenu: `Réclamation ${decision === 'acceptee' ? 'acceptée' : 'rejetée'} (${reclamation.Matiere?.intitule || 'matière'})${valeur != null ? `, nouvelle note ${String(valeur).replace('.', ',')}/20` : ''}.`.slice(0, 250),
    }).catch(() => {});
  }
  await journaliserAudit(req, { action: 'reclamation_traitee', cible: `${reclamation.Eleve?.matricule || reclamation.eleveId} ${reclamation.Matiere?.intitule || ''}`, details: { decision, ancienne: reclamation.ancienneValeur, nouvelle: valeur } });
  return res.json({ reclamation: versJSON(await reclamation.reload({ include: [Eleve, Matiere] })) });
}

module.exports = { mesReclamations, deposer, lister, traiter };
