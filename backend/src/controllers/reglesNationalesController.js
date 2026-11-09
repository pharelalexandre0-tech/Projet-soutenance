const { RegleNationale, Etablissement } = require('../models');
const { validerRegles } = require('../services/parametrageEcoleService');
const { journaliserAudit } = require('../services/auditService');

// Règles LMD nationales : le Ministère publie, les établissements adoptent.
const CHAMPS = ['seuilValidation', 'noteEliminatoire', 'compensationActive', 'noteMinCompensation', 'passageDetteActif', 'creditsMinPassagePct'];
const valeurs = (o) => Object.fromEntries(CHAMPS.map((k) => [k, o[k] ?? null]));
const egal = (a, b) => (a === null || a === undefined ? null : Number(a)) === (b === null || b === undefined ? null : Number(b));

function conforme(etablissement, ref) {
  if (!ref) return null;
  return Number(etablissement.seuilValidation) === Number(ref.seuilValidation)
    && Number(etablissement.noteEliminatoire) === Number(ref.noteEliminatoire)
    && Boolean(etablissement.compensationActive) === Boolean(ref.compensationActive)
    && (!ref.compensationActive || egal(etablissement.noteMinCompensation, ref.noteMinCompensation))
    && Boolean(etablissement.passageDetteActif) === Boolean(ref.passageDetteActif)
    && (!ref.passageDetteActif || egal(etablissement.creditsMinPassagePct, ref.creditsMinPassagePct));
}

const actuelle = () => RegleNationale.findOne({ order: [['version', 'DESC']] });

// Ministère : référentiel en vigueur, historique, et situation de chaque établissement.
async function consulter(req, res) {
  const [ref, historique, etablissements] = await Promise.all([
    actuelle(),
    RegleNationale.findAll({ order: [['version', 'DESC']], limit: 50 }),
    Etablissement.findAll({ attributes: ['id', 'nom', 'sigle', 'ville', ...CHAMPS], order: [['nom', 'ASC']] }),
  ]);
  return res.json({
    actuelle: ref,
    historique,
    etablissements: etablissements.map((e) => ({ id: e.id, nom: e.nom, sigle: e.sigle, ville: e.ville, regles: valeurs(e), conforme: conforme(e, ref) })),
  });
}

async function publier(req, res) {
  const texteReference = String(req.body.texteReference || '').trim();
  if (!texteReference) return res.status(400).json({ erreur: 'indiquez la référence du texte officiel (arrêté, décret ou circulaire)' });
  const precedente = await actuelle();
  const base = precedente ? valeurs(precedente) : { seuilValidation: 10, noteEliminatoire: 7, compensationActive: false, noteMinCompensation: null, passageDetteActif: false, creditsMinPassagePct: null };
  const regles = validerRegles(req.body, base);
  const ref = await RegleNationale.create({
    ...regles, texteReference, commentaire: String(req.body.commentaire || '').trim() || null,
    version: (precedente?.version || 0) + 1, publieParNom: `${req.utilisateur.prenom} ${req.utilisateur.nom}`.trim(),
  });
  await journaliserAudit(req, { action: 'regles_nationales_publiees', cible: `version ${ref.version}`, details: { texteReference } });
  return res.status(201).json({ actuelle: ref });
}

// Académie : le référentiel national et la position de l'établissement.
async function pourEtablissement(req, res) {
  const [ref, e] = await Promise.all([actuelle(), Etablissement.findByPk(req.utilisateur.etablissementId)]);
  return res.json({ actuelle: ref, conforme: e ? conforme(e, ref) : null });
}

async function adopterPour(etablissementId, req) {
  const ref = await actuelle();
  if (!ref) throw Object.assign(new Error('le Ministère n’a pas encore publié de règles nationales'), { status: 404 });
  const e = await Etablissement.findByPk(etablissementId);
  if (!e) throw Object.assign(new Error('établissement introuvable'), { status: 404 });
  await e.update(valeurs(ref));
  await journaliserAudit(req, { action: 'regles_nationales_adoptees', cible: `version ${ref.version}`, etablissementId: e.id });
  return e;
}

async function adopter(req, res) {
  const e = await adopterPour(req.utilisateur.etablissementId, req);
  return res.json({ etablissement: e });
}

async function adopterParSuperadmin(req, res) {
  const e = await adopterPour(Number(req.params.id), req);
  return res.json({ regles: valeurs(e) });
}

async function lireActuelle(req, res) { return res.json({ actuelle: await actuelle() }); }

module.exports = { lireActuelle, consulter, publier, pourEtablissement, adopter, adopterParSuperadmin, conforme };
