const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Preinscription, Etablissement, Classe, Eleve, Utilisateur, FraisScolarite, Semestre } = require('../models');
const { attribuerMatricule } = require('../services/matriculeService');
const { motDePasseAleatoire } = require('../utils/tokenGenerator');
const { envoyerEmail } = require('../services/emailService');
const { fournisseurActif, normaliserTelephone, CODE_TEST } = require('../services/mobileMoneyService');
const { chargerFrais, encaisser } = require('../services/encaissementService');
const { verifierQuotaEtudiants } = require('../services/parametrageEcoleService');

// Inscription entièrement en ligne : le candidat accepté reçoit un lien
// personnel, règle ses frais d'inscription (mobile money, ou au guichet) et
// son compte étudiant est créé aussitôt, sans déplacement.

const FRONTEND = (process.env.FRONTEND_URL || 'https://edusphere-frontend-pryg.onrender.com').replace(/\/$/, '');
const DUREE_LIEN_JOURS = 30;
const OPERATEURS = { airtel: 'Airtel Money', moov: 'Moov Money' };
const empreinte = (j) => crypto.createHash('sha256').update(String(j)).digest('hex');
const erreur = (message, status = 400) => Object.assign(new Error(message), { status });
const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Appelé par l'Académie à l'acceptation : lien personnel envoyé par e-mail.
async function ouvrirInscription(dossier, { classeId, fraisInscription }) {
  const classe = classeId ? await Classe.findOne({ where: { id: Number(classeId) || 0, etablissementId: dossier.etablissementId } }) : null;
  if (!classe) throw erreur('choisissez la classe dans laquelle le candidat sera inscrit');
  const frais = Math.max(0, Math.round(Number(String(fraisInscription ?? 0).replace(/\s/g, '')) || 0));
  const jeton = crypto.randomBytes(32).toString('hex');
  await dossier.update({
    classeId: classe.id, fraisInscription: frais, jetonInscription: empreinte(jeton),
    jetonExpire: new Date(Date.now() + DUREE_LIEN_JOURS * 24 * 3600 * 1000), paiementStatut: frais > 0 ? 'en_attente' : 'non_requis',
  });
  const ecole = await Etablissement.findByPk(dossier.etablissementId, { attributes: ['nom'] });
  const lien = `${FRONTEND}/inscription/${jeton}`;
  envoyerEmail(dossier.email, `Votre admission à ${ecole.nom} : finalisez votre inscription en ligne`,
    `Bonjour ${dossier.prenom},\n\nVotre candidature ${dossier.numero} est acceptée en ${classe.niveau} (${classe.nom}).\n\nFinalisez votre inscription en ligne, sans vous déplacer${frais ? `, en réglant les frais d'inscription de ${fcfa(frais)} par Airtel Money ou Moov Money` : ''} :\n${lien}\n\nCe lien personnel est valable ${DUREE_LIEN_JOURS} jours. Votre compte étudiant sera créé dès la fin de l'inscription.${dossier.commentaire ? `\n\n${dossier.commentaire}` : ''}\n`,
  ).catch(() => {});
  return lien;
}

async function dossierDuLien(jeton) {
  const dossier = await Preinscription.findOne({ where: { jetonInscription: empreinte(jeton) } });
  if (!dossier) throw erreur('lien d’inscription invalide', 404);
  if (dossier.statut !== 'inscrite' && (!dossier.jetonExpire || dossier.jetonExpire < new Date())) throw erreur('ce lien a expiré : demandez-en un nouveau à l’établissement', 410);
  if (!['acceptee', 'inscrite'].includes(dossier.statut)) throw erreur('ce dossier n’est plus ouvert à l’inscription', 409);
  return dossier;
}

async function resume(dossier) {
  const [ecole, classe] = await Promise.all([
    Etablissement.findByPk(dossier.etablissementId, { attributes: ['id', 'nom', 'sigle', 'ville', 'logo', 'email'] }),
    Classe.findByPk(dossier.classeId, { attributes: ['nom', 'niveau'] }),
  ]);
  let paiement = { disponible: false };
  try { const f = fournisseurActif(ecole); paiement = { disponible: true, modeTest: !f.reel, codeTest: f.reel ? null : CODE_TEST }; } catch (e) { paiement = { disponible: false, message: e.message }; }
  const eleve = dossier.eleveId ? await Eleve.findByPk(dossier.eleveId, { attributes: ['matricule'] }) : null;
  return {
    numero: dossier.numero, nom: dossier.nom, prenom: dossier.prenom, email: dossier.email,
    ecole: { nom: ecole.nom, sigle: ecole.sigle, ville: ecole.ville, logo: ecole.logo }, classe,
    fraisInscription: dossier.fraisInscription || 0, paiementStatut: dossier.paiementStatut, paiementReference: dossier.paiementReference,
    inscrit: dossier.statut === 'inscrite', matricule: eleve?.matricule || null, paiement,
    operateurs: Object.entries(OPERATEURS).map(([cle, nom]) => ({ cle, nom })),
  };
}

async function consulter(req, res) {
  return res.json(await resume(await dossierDuLien(req.params.jeton)));
}

// Création du compte étudiant (une seule fois), frais d'inscription et reçu.
async function finaliser(dossier, { payeEnLigne = false, modeTest = false } = {}) {
  if (dossier.statut === 'inscrite') return dossier;
  await verifierQuotaEtudiants(dossier.etablissementId);
  if (await Utilisateur.findOne({ where: { email: dossier.email } })) throw erreur('un compte existe déjà avec cette adresse e-mail : contactez l’établissement', 409);
  const compte = await Utilisateur.create({ nom: dossier.nom, prenom: dossier.prenom, email: dossier.email, motDePasse: await bcrypt.hash(motDePasseAleatoire(), 10), role: 'etudiant', etablissementId: dossier.etablissementId });
  const eleve = await Eleve.create({ nom: dossier.nom, prenom: dossier.prenom, dateNaissance: dossier.dateNaissance, sexe: dossier.sexe, classeId: dossier.classeId, compteEtudiantId: compte.id, etablissementId: dossier.etablissementId });
  await attribuerMatricule(eleve);
  await eleve.reload();
  if (dossier.fraisInscription > 0) {
    const semestre = await Semestre.findOne({ where: { etablissementId: dossier.etablissementId }, order: [['anneeScolaire', 'DESC'], ['numero', 'ASC']] });
    const nouveau = await FraisScolarite.create({
      eleveId: eleve.id, semestreId: semestre?.id || null, libelle: 'Frais d’inscription', montant: dossier.fraisInscription,
      dateEcheance: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    });
    if (payeEnLigne) {
      const frais = await chargerFrais(nouveau.id);
      await encaisser({ frais, montant: dossier.fraisInscription, modePaiement: 'mobile_money', modeTest, mention: ` par ${OPERATEURS[dossier.operateur] || 'mobile money'}${modeTest ? ' (mode test, aucun argent débité)' : ''}` });
    }
  }
  await dossier.update({ statut: 'inscrite', eleveId: eleve.id, inscritLe: new Date() });
  const ecole = await Etablissement.findByPk(dossier.etablissementId, { attributes: ['nom'] });
  envoyerEmail(dossier.email, `Bienvenue à ${ecole.nom} : vos identifiants`,
    `Bonjour ${dossier.prenom},\n\nVotre inscription est terminée. Votre espace étudiant est ouvert :\n\nAdresse : ${FRONTEND}/connexion\nIdentifiant : ${dossier.email}\nMot de passe : votre matricule ${eleve.matricule}\n\nVos parents peuvent aussi ouvrir votre dossier avec leur propre adresse, une fois qu'elle aura été enregistrée par l'établissement.\n`,
  ).catch(() => {});
  return dossier;
}

async function payer(req, res) {
  const dossier = await dossierDuLien(req.params.jeton);
  if (dossier.statut === 'inscrite') throw erreur('inscription déjà terminée', 409);
  if (!(dossier.fraisInscription > 0)) throw erreur('aucun frais d’inscription à régler');
  const ecole = await Etablissement.findByPk(dossier.etablissementId, { attributes: ['id', 'email'] });
  const f = fournisseurActif(ecole);
  const operateur = OPERATEURS[req.body.operateur] ? req.body.operateur : null;
  if (!operateur) throw erreur('choisissez Airtel Money ou Moov Money');
  const telephone = normaliserTelephone(req.body.telephone);
  if (!telephone) throw erreur('numéro de téléphone gabonais invalide (ex. 077 12 34 56)');
  const reference = `INS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  await f.initier({ reference, montant: dossier.fraisInscription, telephone, operateur, description: `Frais d’inscription ${dossier.numero}` });
  await dossier.update({ paiementStatut: 'en_attente', paiementReference: reference, operateur, telephone2: telephone, fournisseur: f.cle });
  return res.json(await resume(dossier));
}

async function confirmerTest(req, res) {
  const dossier = await dossierDuLien(req.params.jeton);
  if (dossier.fournisseur !== 'test' || !dossier.paiementReference) throw erreur('aucun paiement de test en attente', 409);
  if (String(req.body.code || '').trim() !== CODE_TEST) throw erreur('code de confirmation incorrect');
  await dossier.update({ paiementStatut: 'paye' });
  await finaliser(dossier, { payeEnLigne: true, modeTest: true });
  return res.json(await resume(dossier));
}

// Frais réglés plus tard à l'établissement : le compte est créé tout de suite,
// les frais restent dus dans l'espace de l'étudiant.
async function payerAuGuichet(req, res) {
  const dossier = await dossierDuLien(req.params.jeton);
  if (dossier.statut !== 'inscrite') {
    await dossier.update({ paiementStatut: dossier.fraisInscription > 0 ? 'au_guichet' : 'non_requis' });
    await finaliser(dossier);
  }
  return res.json(await resume(dossier));
}

module.exports = { ouvrirInscription, consulter, payer, confirmerTest, payerAuGuichet };
