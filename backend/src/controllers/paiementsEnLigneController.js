const { Op } = require('sequelize');
const { PaiementEnLigne, Eleve, Recu, FraisScolarite, Etablissement } = require('../models');
const { fournisseurActif, nouvelleReference, normaliserTelephone, CODE_TEST } = require('../services/mobileMoneyService');
const { chargerFrais, encaisser } = require('../services/encaissementService');
const { journaliserAudit } = require('../services/auditService');

// Paiement des frais par mobile money depuis l'espace étudiant (ou parent).
const OPERATEURS = { airtel: 'Airtel Money', moov: 'Moov Money' };
const EXPIRATION_MS = 15 * 60 * 1000;

async function eleveDuCompte(req) {
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } });
  if (!eleve) throw Object.assign(new Error('dossier étudiant introuvable'), { status: 404 });
  return eleve;
}

// Une demande restée sans réponse plus de 15 minutes expire.
async function rafraichir(pel) {
  if (pel.statut === 'en_attente' && Date.now() - new Date(pel.createdAt).getTime() > EXPIRATION_MS) {
    await pel.update({ statut: 'expire', message: 'aucune confirmation reçue dans les 15 minutes' });
  }
  return pel;
}

async function avecRecu(pel) {
  const json = pel.toJSON();
  if (pel.paiementId) json.recu = await Recu.findOne({ where: { paiementId: pel.paiementId }, attributes: ['numero', 'fichierPDF'] });
  json.libelleOperateur = OPERATEURS[pel.operateur];
  return json;
}

const ecoleDe = (req) => Etablissement.findByPk(req.utilisateur.etablissementId, { attributes: ['id', 'email'] });

async function configuration(req, res) {
  let f;
  try { f = fournisseurActif(await ecoleDe(req)); } catch (err) { return res.json({ disponible: false, message: err.message }); }
  return res.json({ disponible: true, modeTest: !f.reel, fournisseur: f.nom, operateurs: Object.entries(OPERATEURS).map(([cle, nom]) => ({ cle, nom })), codeTest: f.reel ? null : CODE_TEST });
}

async function initier(req, res) {
  const eleve = await eleveDuCompte(req);
  const frais = await FraisScolarite.findOne({ where: { id: req.body.fraisId, eleveId: eleve.id } });
  if (!frais) return res.status(404).json({ erreur: 'frais introuvable' });
  const reste = frais.montant - frais.montantRegle;
  const montant = Math.round(Number(req.body.montant));
  if (!Number.isFinite(montant) || montant < 100 || montant > reste + 0.01) return res.status(400).json({ erreur: `le montant doit être compris entre 100 et ${Math.round(reste).toLocaleString('fr-FR')} FCFA` });
  const operateur = OPERATEURS[req.body.operateur] ? req.body.operateur : null;
  if (!operateur) return res.status(400).json({ erreur: 'choisissez Airtel Money ou Moov Money' });
  const telephone = normaliserTelephone(req.body.telephone);
  if (!telephone) return res.status(400).json({ erreur: 'numéro de téléphone gabonais invalide (ex. 077 12 34 56)' });
  const encours = await PaiementEnLigne.findOne({ where: { eleveId: eleve.id, fraisId: frais.id, statut: 'en_attente', createdAt: { [Op.gt]: new Date(Date.now() - EXPIRATION_MS) } } });
  if (encours) return res.status(409).json({ erreur: 'un paiement est déjà en attente de confirmation pour ce frais', reference: encours.reference });

  const f = fournisseurActif(await ecoleDe(req));
  const reference = nouvelleReference();
  const pel = await PaiementEnLigne.create({
    reference, etablissementId: eleve.etablissementId, eleveId: eleve.id, fraisId: frais.id, montant, operateur, telephone,
    fournisseur: f.cle, initieParId: req.utilisateur.id, initieParParent: Boolean(req.sessionParent),
  });
  try {
    const r = await f.initier({ reference, montant, telephone, operateur, description: `${frais.libelle} : ${eleve.prenom} ${eleve.nom}` });
    await pel.update({ referenceFournisseur: r.referenceFournisseur || null });
  } catch (err) {
    await pel.update({ statut: 'echoue', message: String(err.message).slice(0, 250) });
    return res.status(502).json({ erreur: 'le fournisseur de paiement n’a pas accepté la demande, réessayez plus tard' });
  }
  await journaliserAudit(req, { action: 'paiement_en_ligne_demande', cible: reference, etablissementId: eleve.etablissementId, details: { montant, operateur, modeTest: !f.reel } });
  return res.status(201).json({ paiement: await avecRecu(pel), modeTest: !f.reel });
}

// Confirmation réussie : le paiement devient un encaissement avec reçu.
async function confirmer(pel) {
  if (pel.statut !== 'en_attente') return pel;
  const frais = await chargerFrais(pel.fraisId);
  const reste = frais.montant - frais.montantRegle;
  if (pel.montant > reste + 0.01) {
    await pel.update({ statut: 'echoue', message: 'le frais a déjà été réglé entre-temps' });
    return pel;
  }
  const libelle = OPERATEURS[pel.operateur];
  const { paiement } = await encaisser({ frais, montant: pel.montant, modePaiement: 'mobile_money', modeTest: pel.fournisseur === 'test', mention: ` par ${libelle}${pel.fournisseur === 'test' ? ' (mode test, aucun argent débité)' : ''}` });
  await pel.update({ statut: 'reussi', paiementId: paiement.id, message: null });
  return pel;
}

async function consulter(req, res) {
  const where = { reference: req.params.reference };
  if (req.utilisateur.role === 'etudiant') where.eleveId = (await eleveDuCompte(req)).id;
  else where.etablissementId = req.utilisateur.etablissementId;
  const pel = await PaiementEnLigne.findOne({ where });
  if (!pel) return res.status(404).json({ erreur: 'paiement introuvable' });
  if (pel.statut === 'en_attente' && pel.fournisseur !== 'test') {
    try {
      const statut = await fournisseurActif(await ecoleDe(req)).verifier(pel);
      if (statut === 'reussi') await confirmer(pel);
      else if (statut === 'echoue') await pel.update({ statut: 'echoue', message: 'paiement refusé ou annulé sur le téléphone' });
    } catch { /* fournisseur injoignable : on réessaiera */ }
  }
  await rafraichir(pel);
  return res.json({ paiement: await avecRecu(pel) });
}

// Mode test uniquement : l'étudiant « valide sur son téléphone » avec le code de test.
async function confirmerTest(req, res) {
  const eleve = await eleveDuCompte(req);
  const pel = await PaiementEnLigne.findOne({ where: { reference: req.params.reference, eleveId: eleve.id } });
  if (!pel) return res.status(404).json({ erreur: 'paiement introuvable' });
  if (pel.fournisseur !== 'test') return res.status(403).json({ erreur: 'confirmation de test indisponible pour un paiement réel' });
  await rafraichir(pel);
  if (pel.statut !== 'en_attente') return res.status(409).json({ erreur: 'ce paiement n’est plus en attente', paiement: await avecRecu(pel) });
  if (String(req.body.code || '').trim() !== CODE_TEST) {
    await pel.update({ statut: 'echoue', message: 'code de confirmation incorrect' });
    return res.json({ paiement: await avecRecu(pel) });
  }
  await confirmer(pel);
  return res.json({ paiement: await avecRecu(pel) });
}

// Rappel du fournisseur (paiement réel), sans session : il prouve son origine
// par la signature propre à chaque fournisseur.
async function notification(req, res) {
  let f;
  try { f = fournisseurActif(); } catch { return res.status(404).end(); }
  if (f.cle !== req.params.fournisseur) return res.status(404).end();
  const lu = f.lireNotification(req);
  if (!lu) return res.status(400).json({ erreur: 'notification invalide' });
  const pel = await PaiementEnLigne.findOne({ where: { reference: lu.reference, fournisseur: f.cle } });
  if (!pel) return res.status(404).end();
  if (lu.statut === 'reussi') await confirmer(pel);
  else if (lu.statut === 'echoue' && pel.statut === 'en_attente') await pel.update({ statut: 'echoue', message: 'paiement refusé ou annulé' });
  return res.json({ recu: true });
}

async function mesPaiements(req, res) {
  const eleve = await eleveDuCompte(req);
  const liste = await PaiementEnLigne.findAll({ where: { eleveId: eleve.id }, order: [['createdAt', 'DESC']], limit: 30 });
  for (const p of liste) await rafraichir(p);
  return res.json({ paiements: await Promise.all(liste.map(avecRecu)) });
}

async function listeFinance(req, res) {
  const liste = await PaiementEnLigne.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, include: [{ model: Eleve, attributes: ['nom', 'prenom', 'matricule'] }, { model: FraisScolarite, attributes: ['libelle'] }], order: [['createdAt', 'DESC']], limit: 300 });
  for (const p of liste) await rafraichir(p);
  return res.json({ paiements: await Promise.all(liste.map(async (p) => ({ ...(await avecRecu(p)), eleve: p.Eleve, frais: p.FraisScolarite }))) });
}

module.exports = { configuration, initier, consulter, confirmerTest, notification, mesPaiements, listeFinance };
