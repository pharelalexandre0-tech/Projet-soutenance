const { Op } = require('sequelize');
const { CertificationDocument, Etablissement, Utilisateur } = require('../models');
const { normaliserCode, signatureValide, clePubliquePem } = require('../services/certificationService');

const LIBELLES_TYPE = {
  bulletin: 'Bulletin de notes',
  recu: 'Reçu de paiement',
  fiche_paie: 'Fiche de paie',
  emploi_du_temps: 'Emploi du temps',
  liste_presence: 'Liste de présence',
  recapitulatif_presences: 'Récapitulatif des présences',
  proces_verbal: 'Procès-verbal des résultats',
  rapport_national: 'Rapport national (Ministère)',
  annuaire_statistique: 'Annuaire statistique (Ministère)',
  classement_national: 'Classement des établissements (Ministère)',
  registre_national: 'Registre des établissements (Ministère)',
  rapport_inspection: "Rapport d'inspection (Ministère)",
  attestation: 'Attestation',
  releve: 'Relevé de notes officiel',
  pv_deliberation: 'Procès-verbal de délibération',
};

// Documents que la Finance peut consulter et annuler ; l'Académie gère tous
// les autres.
const TYPES_FINANCE = ['recu', 'fiche_paie'];

// Page publique /verifier/:code : toute personne qui reçoit un document
// (employeur, autre université, ministère) confirme qu'il a été émis par
// l'école, qu'il est toujours en vigueur et que la signature est intacte.
async function verifier(req, res) {
  const code = normaliserCode(req.params.code);
  if (!code) return res.status(400).json({ erreur: 'code de vérification mal formé (12 caractères, par exemple 7KQ2-M9XA-4TPD)' });
  const certification = await CertificationDocument.findOne({ where: { code } });
  if (!certification) return res.status(404).json({ trouve: false, erreur: 'aucun document ne correspond à ce code' });

  const etablissement = certification.etablissementId ? await Etablissement.findByPk(certification.etablissementId) : null;
  const signature = await signatureValide(certification);
  await certification.increment('nombreVerifications');
  await certification.update({ derniereVerification: new Date() }, { silent: true });

  return res.json({
    trouve: true,
    code: certification.code,
    statut: certification.statut,
    authentique: signature && certification.statut === 'valide',
    signatureValide: signature,
    type: certification.typeDocument,
    libelleType: LIBELLES_TYPE[certification.typeDocument] || 'Document',
    titre: certification.titre,
    titulaire: certification.titulaire,
    elements: certification.elements,
    emisLe: certification.emisLe,
    remplaceLe: certification.remplaceLe,
    annuleLe: certification.annuleLe,
    motifAnnulation: certification.motifAnnulation,
    empreintes: certification.empreintes,
    etablissement: etablissement ? {
      nom: etablissement.nom,
      sigle: etablissement.sigle,
      ville: etablissement.ville,
      pays: etablissement.pays,
      logo: etablissement.logo || null,
      statut: etablissement.statut,
    } : null,
  });
}

async function clePublique(req, res) {
  res.type('text/plain').send(await clePubliquePem());
}

// Registre des documents émis par l'école (Académie : tous ; Finance :
// reçus et fiches de paie).
async function registre(req, res) {
  const { type, statut, q } = req.query;
  const where = { etablissementId: req.utilisateur.etablissementId };
  const typesPermis = req.utilisateur.role === 'finance' ? TYPES_FINANCE : Object.keys(LIBELLES_TYPE);
  where.typeDocument = type && typesPermis.includes(type) ? type : typesPermis;
  if (['valide', 'remplace', 'annule'].includes(statut)) where.statut = statut;
  if (q) {
    const motif = `%${String(q).trim().slice(0, 60)}%`;
    where[Op.or] = [{ titulaire: { [Op.iLike]: motif } }, { titre: { [Op.iLike]: motif } }, { code: { [Op.iLike]: motif } }];
  }
  const lignes = await CertificationDocument.findAll({
    where,
    attributes: ['code', 'typeDocument', 'titre', 'titulaire', 'statut', 'emisLe', 'remplaceLe', 'annuleLe', 'motifAnnulation', 'nombreVerifications', 'derniereVerification', 'emisParId'],
    order: [['emisLe', 'DESC']],
    limit: 300,
  });
  const emetteurs = await Utilisateur.findAll({ where: { id: [...new Set(lignes.map((l) => l.emisParId).filter(Boolean))] }, attributes: ['id', 'nom', 'prenom'] });
  const nomDe = new Map(emetteurs.map((u) => [u.id, `${u.prenom} ${u.nom}`]));
  const totaux = await CertificationDocument.count({ where: { etablissementId: req.utilisateur.etablissementId, typeDocument: typesPermis }, group: ['statut'] });
  return res.json({
    documents: lignes.map((l) => ({ ...l.toJSON(), libelleType: LIBELLES_TYPE[l.typeDocument], emisPar: nomDe.get(l.emisParId) || null })),
    totaux: Object.fromEntries(totaux.map((t) => [t.statut, Number(t.count)])),
    types: typesPermis.map((t) => ({ valeur: t, libelle: LIBELLES_TYPE[t] })),
  });
}

// Annulation d'un document émis par erreur : la page de vérification
// l'affiche alors comme annulé, avec le motif.
async function annuler(req, res) {
  const code = normaliserCode(req.params.code);
  const motif = String(req.body?.motif || '').trim();
  if (!code) return res.status(400).json({ erreur: 'code de vérification mal formé' });
  if (motif.length < 5) return res.status(400).json({ erreur: "indiquez le motif de l'annulation (5 caractères au moins)" });
  const certification = await CertificationDocument.findOne({ where: { code, etablissementId: req.utilisateur.etablissementId } });
  const typesPermis = req.utilisateur.role === 'finance' ? TYPES_FINANCE : Object.keys(LIBELLES_TYPE);
  if (!certification || !typesPermis.includes(certification.typeDocument)) return res.status(404).json({ erreur: 'document introuvable' });
  if (certification.statut === 'annule') return res.status(409).json({ erreur: 'ce document est déjà annulé' });
  await certification.update({ statut: 'annule', annuleLe: new Date(), motifAnnulation: motif.slice(0, 300) });
  return res.json({ ok: true, code, statut: 'annule' });
}

module.exports = { verifier, clePublique, registre, annuler, LIBELLES_TYPE };
