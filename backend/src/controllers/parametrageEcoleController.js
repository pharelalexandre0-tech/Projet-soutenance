const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { COUT_BCRYPT_PERSONNEL } = require('../utils/motDePasse');
const { motDePasseAleatoire } = require('../utils/tokenGenerator');
const { revoquerSessions } = require('../services/sessionService');
const { journaliserAudit } = require('../services/auditService');
const { journaliser } = require('../services/plateformeService');
const P = require('../services/parametrageEcoleService');
const {
  Etablissement, Utilisateur, Eleve, Formation, Semestre, Classe, UniteEnseignement, Matiere,
} = require('../models');

// Superadmin : paramétrage complet d'une école affiliée (règles académiques,
// structure LMD, comptes du personnel, quotas et abonnement).

async function ecole(req) {
  const e = await Etablissement.findByPk(req.params.id);
  if (!e) throw Object.assign(new Error('établissement introuvable'), { status: 404 });
  return e;
}

const REGLES = ['seuilValidation', 'noteEliminatoire', 'compensationActive', 'noteMinCompensation', 'passageDetteActif', 'creditsMinPassagePct'];
const ABONNEMENT = ['quotaEtudiants', 'quotaPersonnel', 'abonnementFin', 'abonnementOffre'];
const choisir = (o, cles) => Object.fromEntries(cles.map((k) => [k, o[k] ?? null]));

async function obtenir(req, res) {
  const e = await ecole(req);
  const etablissementId = e.id;
  const [formations, semestres, classes, comptes, nbEtudiants] = await Promise.all([
    Formation.findAll({ where: { etablissementId }, order: [['cycle', 'ASC'], ['mention', 'ASC']] }),
    Semestre.findAll({ where: { etablissementId }, order: [['anneeScolaire', 'DESC'], ['cycle', 'ASC'], ['numero', 'ASC']] }),
    Classe.findAll({ where: { etablissementId }, attributes: ['id', 'nom', 'niveau', 'formationId'], order: [['niveau', 'ASC'], ['nom', 'ASC']] }),
    Utilisateur.findAll({ where: { etablissementId, role: { [Op.in]: ['academie', 'finance'] } }, order: [['role', 'ASC'], ['createdAt', 'ASC']] }),
    Eleve.count({ where: { etablissementId } }),
  ]);
  const ues = semestres.length ? await UniteEnseignement.findAll({ where: { semestreId: semestres.map((s) => s.id) }, attributes: ['id', 'semestreId', 'formationId', 'credits'], include: [{ model: Matiere, attributes: ['id'] }] }) : [];
  const parSemestre = new Map();
  for (const u of ues) {
    const k = parSemestre.get(u.semestreId) || { ues: 0, matieres: 0, credits: 0 };
    k.ues += 1; k.matieres += u.Matieres.length; k.credits += u.credits;
    parSemestre.set(u.semestreId, k);
  }
  return res.json({
    regles: choisir(e, REGLES),
    abonnement: { ...choisir(e, ABONNEMENT), expire: P.abonnementExpire(e) },
    usage: { etudiants: nbEtudiants, personnel: comptes.length },
    formations: formations.map((f) => ({ ...f.toJSON(), classes: classes.filter((c) => c.formationId === f.id).length, ues: ues.filter((u) => u.formationId === f.id).length })),
    semestres: semestres.map((s) => ({ id: s.id, libelle: s.libelle, cycle: s.cycle, numero: s.numero, anneeScolaire: s.anneeScolaire, ...(parSemestre.get(s.id) || { ues: 0, matieres: 0, credits: 0 }) })),
    classes,
    comptes: comptes.map((u) => u.toPublicJSON()),
  });
}

async function regles(req, res) {
  const e = await ecole(req);
  await e.update(P.validerRegles(req.body, e));
  await journaliser(req.utilisateur, 'etablissement', `Règles académiques de « ${e.nom} » modifiées`);
  return res.json({ regles: choisir(e, REGLES) });
}

async function abonnement(req, res) {
  const e = await ecole(req);
  await e.update(P.validerAbonnement(req.body));
  await journaliser(req.utilisateur, 'etablissement', `Abonnement et quotas de « ${e.nom} » modifiés`);
  return res.json({ abonnement: { ...choisir(e, ABONNEMENT), expire: P.abonnementExpire(e) } });
}

async function maquette(req, res) {
  const e = await ecole(req);
  const r = await P.creerMaquette(e.id, req.body);
  await journaliser(req.utilisateur, 'etablissement', `Maquette ${r.formation.cycle} « ${r.formation.mention} » préparée pour « ${e.nom} »`);
  return res.status(201).json({ formation: r.formation, semestres: r.semestres.length, classes: r.classes.length });
}

async function importer(req, res) {
  const e = await ecole(req);
  const r = await P.importerStructure(e.id, req.body);
  return res.status(201).json(r);
}

async function creerCompte(req, res) {
  const e = await ecole(req);
  const role = ['academie', 'finance'].includes(req.body.role) ? req.body.role : null;
  const nom = String(req.body.nom || '').trim();
  const prenom = String(req.body.prenom || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!role) return res.status(400).json({ erreur: 'choisissez l’espace du compte : Académie ou Finance' });
  if (!nom || !prenom || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ erreur: 'nom, prénom et adresse e-mail valide obligatoires' });
  if (await Utilisateur.findOne({ where: { email } })) return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  await P.verifierQuotaPersonnel(e.id);
  const motDePasse = motDePasseAleatoire();
  const u = await Utilisateur.create({ nom, prenom, email, role, etablissementId: e.id, motDePasse: await bcrypt.hash(motDePasse, COUT_BCRYPT_PERSONNEL), fonction: String(req.body.fonction || '').trim() || null });
  await journaliserAudit(req, { action: 'compte_personnel_cree', cible: email, etablissementId: e.id });
  await journaliser(req.utilisateur, 'compte', `Compte ${role === 'academie' ? 'Académie' : 'Finance'} créé pour « ${e.nom} »`);
  return res.status(201).json({ compte: u.toPublicJSON(), motDePasse });
}

async function compteDeLEcole(req) {
  const e = await ecole(req);
  const u = await Utilisateur.findOne({ where: { id: req.params.uid, etablissementId: e.id, role: { [Op.in]: ['academie', 'finance'] } } });
  if (!u) throw Object.assign(new Error('compte introuvable'), { status: 404 });
  return { e, u };
}

async function statutCompte(req, res) {
  const { e, u } = await compteDeLEcole(req);
  const statut = req.body.statut === 'verrouille' ? 'verrouille' : 'actif';
  if (statut === 'verrouille' && u.role === 'academie') {
    const autres = await Utilisateur.count({ where: { etablissementId: e.id, role: 'academie', statut: 'actif', id: { [Op.ne]: u.id } } });
    if (!autres) return res.status(409).json({ erreur: 'c’est le dernier compte Académie actif de l’école : créez-en un autre avant de le verrouiller' });
  }
  await u.update({ statut });
  if (statut === 'verrouille') await revoquerSessions(u.id, { motif: 'compte verrouillé par le superadmin' });
  await journaliserAudit(req, { action: statut === 'verrouille' ? 'compte_verrouille' : 'compte_deverrouille', cible: u.email, etablissementId: e.id });
  return res.json({ compte: u.toPublicJSON() });
}

async function reinitialiserCompte(req, res) {
  const { e, u } = await compteDeLEcole(req);
  const motDePasse = motDePasseAleatoire();
  await u.update({
    motDePasse: await bcrypt.hash(motDePasse, COUT_BCRYPT_PERSONNEL), statut: 'actif',
    totpActif: false, totpSecret: null, totpSecretEnAttente: null, totpCodesSecours: null, echecsConnexion: 0, verrouilleJusqua: null,
  });
  await revoquerSessions(u.id, { motif: 'accès réinitialisé par le superadmin' });
  await journaliserAudit(req, { action: 'acces_personnel_reinitialise', cible: u.email, etablissementId: e.id });
  return res.json({ email: u.email, motDePasse });
}

module.exports = { obtenir, regles, abonnement, maquette, importer, creerCompte, statutCompte, reinitialiserCompte };
