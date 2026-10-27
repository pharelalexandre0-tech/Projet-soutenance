const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { where, fn, col } = require('sequelize');
const { Utilisateur, Etablissement, Eleve, JournalAudit } = require('../models');
const { signEtape, verifyEtape } = require('../utils/jwt');
const { envoyerEmail, adresseDeTest } = require('../services/emailService');
const { emailCodeConnexion, emailReinitialisation, emailRappelMatricule, emailRappelParent } = require('../services/modelesEmail');
const { dossiersDuParent } = require('../services/familleService');
const { erreurMotDePasseInvalide, COUT_BCRYPT_PERSONNEL } = require('../utils/motDePasse');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { lienReinitialisation } = require('../utils/liens');
const { maintenanceEnCours, repondreMaintenance, journaliser } = require('../services/plateformeService');
const { chiffrer, dechiffrer, sha256 } = require('../utils/chiffrement');
const totp = require('../utils/totp');
const { ouvrirSession, revoquerSessions, sessionsActives } = require('../services/sessionService');
const { journaliserAudit } = require('../services/auditService');

const DUREE_CODE_2FA_MIN = 10;
const DUREE_RESET_MIN = 30;
const DELAI_RENVOI_S = 50;
const MAX_ESSAIS_CODE = 5;
const MAX_ECHECS = 5;
const DUREE_VERROU_MIN = 15;

// Étudiant (ou son parent) : code à 6 chiffres envoyé par e-mail.
// Personnel (Académie, Finance, Superadmin) : application d'authentification
// (TOTP), facultative : par défaut le personnel reçoit, comme les
// étudiants, un code à 6 chiffres par e-mail. Plus simple pour tous.
const ROLES_AVEC_2FA = ['etudiant'];
const ROLES_TOTP = ['superadmin', 'academie', 'finance', 'ministere'];

function memeAdresse(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

// Comparaison en temps constant de deux empreintes hexadécimales.
function egal(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const codeAleatoire = () => String(crypto.randomInt(100000, 1000000));

// Le compte dont c'est l'adresse ; à défaut (ou si le mot de passe ne lui
// correspond pas), un compte étudiant dont c'est l'adresse du PARENT : le
// parent se connecte avec son propre e-mail et le mot de passe de son
// enfant, qui désigne aussi l'enfant quand il en a plusieurs.
// Le matricule (mot de passe d'un étudiant) est toujours en majuscules : on
// accepte aussi la saisie en minuscules ou entourée d'espaces, fréquente sur
// téléphone. Les mots de passe du personnel restent comparés à l'identique.
async function motDePasseEtudiantCorrect(saisi, hache) {
  const brut = String(saisi || '');
  const variantes = [...new Set([brut, brut.trim(), brut.trim().toUpperCase()])];
  for (const v of variantes) {
    if (await bcrypt.compare(v, hache)) return true;
  }
  return false;
}

async function compteParEmail(email) {
  const adresse = String(email || '').trim().toLowerCase();
  return Utilisateur.scope('avecMotDePasse').findOne({ where: where(fn('lower', col('email')), adresse) });
}

async function identifier(compte, adresse, motDePasse) {
  const correct = compte && (compte.role === 'etudiant'
    ? await motDePasseEtudiantCorrect(motDePasse, compte.motDePasse)
    : await bcrypt.compare(motDePasse, compte.motDePasse));
  if (correct) {
    return { utilisateur: compte, parent: false };
  }
  for (const dossier of await dossiersDuParent(adresse)) {
    if (await motDePasseEtudiantCorrect(motDePasse, dossier.compteEtudiant.motDePasse)) {
      return { utilisateur: dossier.compteEtudiant, parent: true, emailParent: dossier.emailParent };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Verrouillage temporaire après des échecs répétés
// ---------------------------------------------------------------------------

function minutesDeVerrou(compte) {
  if (!compte?.verrouilleJusqua) return 0;
  const reste = new Date(compte.verrouilleJusqua).getTime() - Date.now();
  return reste > 0 ? Math.ceil(reste / 60000) : 0;
}

function repondreVerrou(res, minutes) {
  return res.status(429).json({ erreur: `trop d'essais infructueux : compte bloqué pendant encore ${minutes} min`, verrou: minutes });
}

async function enregistrerEchec(req, compte, motif) {
  compte.echecsConnexion = (compte.echecsConnexion || 0) + 1;
  const bloque = compte.echecsConnexion >= MAX_ECHECS;
  if (bloque) {
    compte.verrouilleJusqua = new Date(Date.now() + DUREE_VERROU_MIN * 60000);
    compte.echecsConnexion = 0;
  }
  await compte.save();
  await journaliserAudit(req, { action: bloque ? 'compte_bloque_temporairement' : 'connexion_refusee', utilisateur: compte, cible: compte.email, details: { motif } });
  return bloque;
}

async function enregistrerReussite(compte) {
  compte.echecsConnexion = 0;
  compte.verrouilleJusqua = null;
  compte.derniereConnexion = new Date();
  await compte.save();
}

// Profil renvoyé au frontend : en session parent, c'est le compte de
// l'enfant, présenté comme l'Espace Parents.
async function profilDeSession(utilisateur, sessionParent) {
  const profil = utilisateur.toPublicJSON();
  if (!sessionParent) return profil;
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: utilisateur.id }, attributes: ['emailParent'] });
  return { ...profil, modeParent: true, emailParent: eleve?.emailParent || null };
}

async function terminerConnexion(req, res, utilisateur, { parent = false, methode, extra = {} }) {
  await enregistrerReussite(utilisateur);
  const { token } = await ouvrirSession(req, utilisateur, { parent, methode });
  await journaliserAudit(req, { action: 'connexion', utilisateur, cible: parent ? 'Espace Parents' : utilisateur.email, details: { methode } });
  if (utilisateur.role === 'superadmin') await journaliser(utilisateur, 'connexion', "Connexion à l'espace superadmin");
  return res.json({ token, profil: await profilDeSession(utilisateur, parent), ...extra });
}

// Diagramme 3 - Authentification :
// Academie/Etudiant/Finance saisit ses identifiants -> demanderConnexion ->
// rechercherUtilisateur -> alt [valides]/[invalides].
// Deuxième facteur : code par e-mail pour l'étudiant (ou son parent),
// application d'authentification pour le personnel.
async function seConnecter(req, res) {
  const { email, motDePasse } = req.body;
  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: "identifiants incorrects" });
  }

  const adresse = String(email).trim().toLowerCase();
  const compte = await compteParEmail(adresse);
  const verrou = minutesDeVerrou(compte);
  if (verrou) return repondreVerrou(res, verrou);

  const connexion = await identifier(compte, adresse, motDePasse);
  if (!connexion) {
    if (compte && await enregistrerEchec(req, compte, 'mot de passe incorrect')) return repondreVerrou(res, DUREE_VERROU_MIN);
    return res.status(401).json({ erreur: "identifiants incorrects" });
  }
  const { utilisateur, parent } = connexion;

  if (utilisateur.statut === 'verrouille') {
    return res.status(403).json({ erreur: 'compte verrouillé, contactez votre administrateur' });
  }
  let etablissement = null;
  if (utilisateur.etablissementId) {
    etablissement = await Etablissement.findByPk(utilisateur.etablissementId);
    if (!etablissement || etablissement.statut === 'suspendu') {
      return res.status(403).json({ erreur: 'établissement suspendu, contactez le support' });
    }
  }

  // Vérifié après le mot de passe : il faut savoir QUI se connecte pour
  // laisser passer le superadmin pendant une maintenance.
  if (utilisateur.role !== 'superadmin') {
    const maintenance = await maintenanceEnCours();
    if (maintenance) return repondreMaintenance(res, maintenance);
  }

  const parApplication = ROLES_TOTP.includes(utilisateur.role) && utilisateur.totpActif;
  if (ROLES_AVEC_2FA.includes(utilisateur.role) || (ROLES_TOTP.includes(utilisateur.role) && !parApplication)) {
    // Le code part à l'adresse saisie : celle de l'étudiant, ou celle de
    // son parent. Seule son empreinte est gardée en base.
    const destinataire = parent ? connexion.emailParent : utilisateur.email;
    const code = codeAleatoire();
    utilisateur.codeDoubleFacteur = sha256(code);
    utilisateur.codeDoubleFacteurExpire = new Date(Date.now() + DUREE_CODE_2FA_MIN * 60 * 1000);
    utilisateur.codeDoubleFacteurPour = destinataire;
    utilisateur.codeDoubleFacteurEssais = 0;
    await utilisateur.save();
    const message = emailCodeConnexion({
      prenom: parent ? null : utilisateur.prenom,
      code,
      minutes: DUREE_CODE_2FA_MIN,
      etablissement,
      role: parent ? 'parent' : utilisateur.role,
      email: destinataire,
      enfant: parent ? `${utilisateur.prenom} ${utilisateur.nom}` : null,
    });
    await envoyerEmail(destinataire, message.sujet, message.texte, [], { html: message.html });
    // Comptes fictifs de démonstration (domaines réservés aux tests, où
    // aucun e-mail ne part) : le code est montré à l'écran. Jamais pour une
    // adresse réelle.
    return res.json({ doubleFacteurRequis: true, utilisateurId: utilisateur.id, delaiRenvoi: DELAI_RENVOI_S, ...(adresseDeTest(destinataire) && { codeDemonstration: code }) });
  }

  if (parApplication) {
    return res.json({
      applicationRequise: true,
      configurationRequise: false,
      jetonEtape: signEtape({ id: utilisateur.id, etape: 'totp' }),
      prenom: utilisateur.prenom,
    });
  }

  return terminerConnexion(req, res, utilisateur, { methode: 'mot_de_passe' });
}

// Nouveau code, au plus toutes les 50 secondes, envoyé à la même adresse
// que le précédent (l'élève, ou son parent).
async function renvoyerCode(req, res) {
  const { utilisateurId } = req.body;
  const utilisateur = utilisateurId ? await Utilisateur.scope('avecMotDePasse').findByPk(utilisateurId) : null;
  if (!utilisateur || !utilisateur.codeDoubleFacteurExpire || !utilisateur.codeDoubleFacteurPour) {
    return res.status(400).json({ erreur: 'aucune vérification en cours, reconnecte-toi' });
  }
  const envoyeLe = new Date(utilisateur.codeDoubleFacteurExpire).getTime() - DUREE_CODE_2FA_MIN * 60 * 1000;
  const attente = Math.ceil((envoyeLe + DELAI_RENVOI_S * 1000 - Date.now()) / 1000);
  if (attente > 0) return res.status(429).json({ erreur: `patiente encore ${attente} s avant de demander un nouveau code`, attente });

  const etablissement = utilisateur.etablissementId ? await Etablissement.findByPk(utilisateur.etablissementId) : null;
  const parent = !memeAdresse(utilisateur.codeDoubleFacteurPour, utilisateur.email);
  const code = codeAleatoire();
  utilisateur.codeDoubleFacteur = sha256(code);
  utilisateur.codeDoubleFacteurExpire = new Date(Date.now() + DUREE_CODE_2FA_MIN * 60 * 1000);
  utilisateur.codeDoubleFacteurEssais = 0;
  await utilisateur.save();
  const message = emailCodeConnexion({
    prenom: parent ? null : utilisateur.prenom,
    code,
    minutes: DUREE_CODE_2FA_MIN,
    etablissement,
    role: parent ? 'parent' : utilisateur.role,
    email: utilisateur.codeDoubleFacteurPour,
    enfant: parent ? `${utilisateur.prenom} ${utilisateur.nom}` : null,
  });
  await envoyerEmail(utilisateur.codeDoubleFacteurPour, message.sujet, message.texte, [], { html: message.html, etablissement });
  return res.json({ renvoye: true, delai: DELAI_RENVOI_S, ...(adresseDeTest(utilisateur.codeDoubleFacteurPour) && { codeDemonstration: code }) });
}

// Deuxième étape de la connexion Etudiant : vérifie le code reçu par
// e-mail puis délivre le token, exactement comme une connexion normale.
// Cinq essais au plus par code : deviner 6 chiffres devient impossible.
async function verifierDoubleFacteur(req, res) {
  const { utilisateurId, code } = req.body;
  if (!utilisateurId || !code) {
    return res.status(400).json({ erreur: 'code manquant' });
  }

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findByPk(utilisateurId);
  if (!utilisateur || !utilisateur.codeDoubleFacteur || !utilisateur.codeDoubleFacteurExpire) {
    return res.status(400).json({ erreur: 'aucune vérification en cours pour ce compte' });
  }
  if (new Date() > utilisateur.codeDoubleFacteurExpire) {
    return res.status(400).json({ erreur: 'code expiré, reconnecte-toi pour en recevoir un nouveau' });
  }
  if (!egal(sha256(String(code).trim()), utilisateur.codeDoubleFacteur)) {
    utilisateur.codeDoubleFacteurEssais = (utilisateur.codeDoubleFacteurEssais || 0) + 1;
    if (utilisateur.codeDoubleFacteurEssais >= MAX_ESSAIS_CODE) {
      utilisateur.codeDoubleFacteur = null;
      utilisateur.codeDoubleFacteurExpire = null;
      await utilisateur.save();
      await journaliserAudit(req, { action: 'code_email_epuise', utilisateur, cible: utilisateur.email });
      return res.status(429).json({ erreur: 'trop de codes incorrects, reconnecte-toi pour en recevoir un nouveau' });
    }
    await utilisateur.save();
    return res.status(401).json({ erreur: `code incorrect (${MAX_ESSAIS_CODE - utilisateur.codeDoubleFacteurEssais} essai(s) restant(s))` });
  }
  // Maintenance déclenchée entre l'envoi du code et sa saisie.
  const maintenance = await maintenanceEnCours();
  if (maintenance) return repondreMaintenance(res, maintenance);

  // Code envoyé à une autre adresse que celle du compte : c'est le parent
  // qui se connecte.
  const parent = !!utilisateur.codeDoubleFacteurPour && !memeAdresse(utilisateur.codeDoubleFacteurPour, utilisateur.email);
  utilisateur.codeDoubleFacteur = null;
  utilisateur.codeDoubleFacteurExpire = null;
  utilisateur.codeDoubleFacteurPour = null;
  utilisateur.codeDoubleFacteurEssais = 0;
  return terminerConnexion(req, res, utilisateur, { parent, methode: 'code_email' });
}

// ---------------------------------------------------------------------------
// Application d'authentification (TOTP) du personnel
// ---------------------------------------------------------------------------

async function compteDeLEtape(jeton, etapesPermises) {
  let charge;
  try {
    charge = verifyEtape(jeton);
  } catch {
    const err = new Error('étape de connexion expirée, recommencez la connexion');
    err.status = 401;
    throw err;
  }
  if (!etapesPermises.includes(charge.etape)) {
    const err = new Error('étape de connexion invalide');
    err.status = 400;
    throw err;
  }
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(charge.id);
  if (!compte || compte.statut === 'verrouille') {
    const err = new Error('compte indisponible');
    err.status = 403;
    throw err;
  }
  return compte;
}

const grouper = (secret) => secret.match(/.{1,4}/g).join(' ');

async function preparerSecret(compte) {
  const secret = totp.genererSecret();
  compte.totpSecretEnAttente = chiffrer(secret);
  await compte.save();
  const uri = totp.uriOtpauth(secret, compte.email);
  const qr = await QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0B1E3D', light: '#FFFFFF' } });
  return { secret: grouper(secret), uri, qr: `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}` };
}

function genererCodesSecours(compte) {
  const codes = totp.genererCodesSecours();
  compte.totpCodesSecours = codes.map((c) => sha256(totp.normaliserCodeSecours(c)));
  return codes;
}

// Valide un code TOTP (6 chiffres) ou un code de secours (XXXX-XXXX).
// Renvoie la méthode reconnue, ou null.
function controlerCode(compte, saisi) {
  const chiffres = String(saisi || '').replace(/\s/g, '');
  if (/^\d{6}$/.test(chiffres) && compte.totpSecret) {
    const pas = totp.verifierCode(dechiffrer(compte.totpSecret), chiffres, compte.totpDernierPas);
    if (pas != null) {
      compte.totpDernierPas = pas;
      return 'totp';
    }
    return null;
  }
  const secours = totp.normaliserCodeSecours(saisi);
  if (secours.length === 8) {
    const empreinte = sha256(secours);
    const restants = compte.totpCodesSecours || [];
    if (restants.some((e) => egal(e, empreinte))) {
      compte.totpCodesSecours = restants.filter((e) => !egal(e, empreinte));
      return 'code_secours';
    }
  }
  return null;
}

// Première connexion du personnel : QR code à scanner avec l'application.
async function initialiserTotpConnexion(req, res) {
  const compte = await compteDeLEtape(req.body.jetonEtape, ['totp-configuration']);
  if (compte.totpActif) return res.status(409).json({ erreur: "l'application d'authentification est déjà configurée, reconnectez-vous" });
  return res.json(await preparerSecret(compte));
}

// Premier code correct : l'application est enregistrée, les codes de
// secours sont remis une seule fois, la session s'ouvre.
async function activerTotpConnexion(req, res) {
  const compte = await compteDeLEtape(req.body.jetonEtape, ['totp-configuration']);
  if (compte.totpActif) return res.status(409).json({ erreur: "l'application d'authentification est déjà configurée, reconnectez-vous" });
  const verrou = minutesDeVerrou(compte);
  if (verrou) return repondreVerrou(res, verrou);
  if (!compte.totpSecretEnAttente) return res.status(400).json({ erreur: 'affichez d’abord le QR code à scanner' });
  const pas = totp.verifierCode(dechiffrer(compte.totpSecretEnAttente), req.body.code);
  if (pas == null) {
    if (await enregistrerEchec(req, compte, 'code de configuration incorrect')) return repondreVerrou(res, DUREE_VERROU_MIN);
    return res.status(401).json({ erreur: "code incorrect : vérifiez l'heure de votre téléphone et saisissez le code affiché" });
  }
  compte.totpSecret = compte.totpSecretEnAttente;
  compte.totpSecretEnAttente = null;
  compte.totpActif = true;
  compte.totpActiveLe = new Date();
  compte.totpDernierPas = pas;
  const codesSecours = genererCodesSecours(compte);
  await journaliserAudit(req, { action: 'double_facteur_active', utilisateur: compte, cible: compte.email });
  return terminerConnexion(req, res, compte, { methode: 'totp', extra: { codesSecours } });
}

async function verifierTotpConnexion(req, res) {
  const compte = await compteDeLEtape(req.body.jetonEtape, ['totp']);
  const verrou = minutesDeVerrou(compte);
  if (verrou) return repondreVerrou(res, verrou);
  const methode = controlerCode(compte, req.body.code);
  if (!methode) {
    if (await enregistrerEchec(req, compte, 'code de l’application incorrect')) return repondreVerrou(res, DUREE_VERROU_MIN);
    return res.status(401).json({ erreur: 'code incorrect' });
  }
  if (compte.role !== 'superadmin') {
    const maintenance = await maintenanceEnCours();
    if (maintenance) return repondreMaintenance(res, maintenance);
  }
  const restants = (compte.totpCodesSecours || []).length;
  if (methode === 'code_secours') await journaliserAudit(req, { action: 'code_secours_utilise', utilisateur: compte, cible: compte.email, details: { restants } });
  return terminerConnexion(req, res, compte, { methode, extra: { codesSecoursRestants: restants } });
}

// ---------------------------------------------------------------------------
// Espace « Sécurité du compte » (connecté)
// ---------------------------------------------------------------------------

const LIBELLES_METHODE = { mot_de_passe: 'Mot de passe', code_email: 'Code par e-mail', totp: "Application d'authentification", code_secours: 'Code de secours' };

async function securite(req, res) {
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  const sessions = await sessionsActives(compte.id);
  const historique = await JournalAudit.findAll({
    where: { utilisateurId: compte.id },
    attributes: ['id', 'horodatage', 'action', 'ip', 'details'],
    order: [['id', 'DESC']],
    limit: 15,
  });
  return res.json({
    doubleFacteur: {
      type: ROLES_TOTP.includes(compte.role) && compte.totpActif ? 'application' : 'email',
      actif: true,
      applicationPossible: ROLES_TOTP.includes(compte.role),
      activeLe: compte.totpActiveLe,
      codesSecoursRestants: (compte.totpCodesSecours || []).length,
    },
    derniereConnexion: compte.derniereConnexion,
    motDePasseChangeLe: compte.motDePasseChangeLe,
    sessions: sessions.map((s) => ({
      id: s.id,
      appareil: s.appareil,
      ip: s.ip,
      ouverteLe: s.createdAt,
      derniereActivite: s.derniereActivite,
      methode: LIBELLES_METHODE[s.methode] || s.methode,
      parent: s.parent,
      actuelle: s.id === req.session.id,
    })),
    historique,
  });
}

async function fermerSession(req, res) {
  const { SessionUtilisateur } = require('../models');
  const session = await SessionUtilisateur.findOne({ where: { id: req.params.id, utilisateurId: req.utilisateur.id } });
  if (!session) return res.status(404).json({ erreur: 'session introuvable' });
  await session.update({ revoqueeLe: new Date(), motifRevocation: 'fermée par le titulaire' });
  await journaliserAudit(req, { action: 'session_fermee', cible: session.appareil });
  return res.json({ ok: true });
}

async function fermerAutresSessions(req, res) {
  const n = await revoquerSessions(req.utilisateur.id, { sauf: req.session.id, motif: 'fermeture des autres appareils' });
  await journaliserAudit(req, { action: 'sessions_fermees', details: { nombre: n } });
  return res.json({ fermees: n });
}

async function seDeconnecter(req, res) {
  await req.session.update({ revoqueeLe: new Date(), motifRevocation: 'déconnexion' });
  return res.json({ ok: true });
}

// Changement de téléphone : mot de passe actuel exigé, puis nouveau QR code.
async function initialiserTotpCompte(req, res) {
  if (!ROLES_TOTP.includes(req.utilisateur.role)) return res.status(403).json({ erreur: 'réservé au personnel' });
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  if (!req.body.motDePasse || !(await bcrypt.compare(req.body.motDePasse, compte.motDePasse))) {
    return res.status(400).json({ erreur: 'mot de passe actuel incorrect' });
  }
  return res.json(await preparerSecret(compte));
}

async function activerTotpCompte(req, res) {
  if (!ROLES_TOTP.includes(req.utilisateur.role)) return res.status(403).json({ erreur: 'réservé au personnel' });
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  if (!compte.totpSecretEnAttente) return res.status(400).json({ erreur: 'affichez d’abord le QR code à scanner' });
  const pas = totp.verifierCode(dechiffrer(compte.totpSecretEnAttente), req.body.code);
  if (pas == null) return res.status(401).json({ erreur: 'code incorrect' });
  compte.totpSecret = compte.totpSecretEnAttente;
  compte.totpSecretEnAttente = null;
  compte.totpActif = true;
  compte.totpActiveLe = new Date();
  compte.totpDernierPas = pas;
  const codesSecours = genererCodesSecours(compte);
  await compte.save();
  // L'ancien téléphone ne doit plus rien ouvrir : les autres sessions
  // sont fermées.
  await revoquerSessions(compte.id, { sauf: req.session.id, motif: "changement d'application d'authentification" });
  await journaliserAudit(req, { action: 'double_facteur_reconfigure', cible: compte.email });
  return res.json({ codesSecours });
}

// Retour au code par e-mail : mot de passe actuel exigé.
async function desactiverTotpCompte(req, res) {
  if (!ROLES_TOTP.includes(req.utilisateur.role)) return res.status(403).json({ erreur: 'réservé au personnel' });
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  if (!req.body.motDePasse || !(await bcrypt.compare(req.body.motDePasse, compte.motDePasse))) {
    return res.status(400).json({ erreur: 'mot de passe actuel incorrect' });
  }
  compte.totpActif = false;
  compte.totpSecret = null;
  compte.totpSecretEnAttente = null;
  compte.totpCodesSecours = null;
  compte.totpDernierPas = null;
  await compte.save();
  await journaliserAudit(req, { action: 'double_facteur_email', cible: compte.email });
  return res.json({ ok: true });
}

async function regenererCodesSecours(req, res) {
  if (!ROLES_TOTP.includes(req.utilisateur.role)) return res.status(403).json({ erreur: 'réservé au personnel' });
  const compte = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  if (!compte.totpActif) return res.status(400).json({ erreur: "configurez d'abord l'application d'authentification" });
  const pas = totp.verifierCode(dechiffrer(compte.totpSecret), req.body.code, compte.totpDernierPas);
  if (pas == null) return res.status(401).json({ erreur: "code de l'application incorrect" });
  compte.totpDernierPas = pas;
  const codesSecours = genererCodesSecours(compte);
  await compte.save();
  await journaliserAudit(req, { action: 'codes_secours_regeneres', cible: compte.email });
  return res.json({ codesSecours });
}

// Creation de compte Academie / Finance, pour permettre a l'Academie de
// creer des comptes Finance depuis son espace.
// Les comptes Etudiant, eux, se créent via l'inscription d'un élève
// (referenceController.creerEleve), jamais isolément.
async function creerCompte(req, res) {
  const { nom, prenom, email, motDePasse, role, service, fonction } = req.body;
  if (!nom || !prenom || !email || !motDePasse || !role) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }
  if (!['academie', 'finance'].includes(role)) {
    return res.status(400).json({ erreur: 'rôle invalide' });
  }
  const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse, { email });
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
  }

  const motDePasseHache = await bcrypt.hash(motDePasse, COUT_BCRYPT_PERSONNEL);
  const utilisateur = await Utilisateur.create({
    nom,
    prenom,
    email,
    motDePasse: motDePasseHache,
    role,
    // Toujours rattaché à l'établissement de l'Académie qui crée le compte
    // — jamais choisi librement, pour qu'aucun compte ne se retrouve
    // rattaché à la mauvaise école.
    etablissementId: req.utilisateur.etablissementId,
    service: role === 'academie' ? service : null,
    fonction: role === 'finance' ? fonction : null,
  });
  await journaliserAudit(req, { action: 'compte_cree', cible: `${role} ${email}` });

  return res.status(201).json({ profil: utilisateur.toPublicJSON() });
}

// "Mot de passe oublié" : symétrique de la double authentification
// ci-dessus (même service d'e-mail, même principe jeton + expiration),
// mais accessible SANS être connecté — le seul point d'entrée public de ce
// contrôleur avec seConnecter. Réponse volontairement identique que le
// compte existe ou non : sinon ce formulaire devient un moyen de vérifier
// quelles adresses ont un compte ici (énumération d'e-mails).
const MESSAGE_GENERIQUE_RESET = { message: "si ce compte existe, un e-mail de réinitialisation vient d'être envoyé" };

async function demanderReinitialisation(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ erreur: 'e-mail requis' });
  }

  const utilisateur = await Utilisateur.findOne({ where: where(fn('lower', col('email')), String(email).trim().toLowerCase()) });
  if (!utilisateur) {
    // Adresse d'un parent : il n'a pas de mot de passe à lui, on lui
    // rappelle celui de chacun de ses enfants (leur matricule).
    const dossiers = await dossiersDuParent(email);
    if (dossiers.length) {
      const etablissement = await Etablissement.findByPk(dossiers[0].etablissementId);
      const message = emailRappelParent({
        email,
        enfants: dossiers.map((d) => ({ nom: `${d.prenom} ${d.nom}`, matricule: d.matricule })),
        etablissement,
      });
      await envoyerEmail(email, message.sujet, message.texte, [], { html: message.html });
    }
    return res.json(MESSAGE_GENERIQUE_RESET);
  }

  const etablissement = utilisateur.etablissementId
    ? await Etablissement.findByPk(utilisateur.etablissementId)
    : null;

  // Le mot de passe d'un étudiant est son matricule et ne se change pas :
  // on lui rappelle plutôt que de lui envoyer un lien de réinitialisation.
  if (utilisateur.role === 'etudiant') {
    const eleve = await Eleve.findOne({ where: { compteEtudiantId: utilisateur.id }, attributes: ['matricule'] });
    if (eleve?.matricule) {
      const message = emailRappelMatricule({ prenom: utilisateur.prenom, matricule: eleve.matricule, email: utilisateur.email, etablissement });
      await envoyerEmail(utilisateur.email, message.sujet, message.texte, [], { html: message.html });
    }
    return res.json(MESSAGE_GENERIQUE_RESET);
  }

  // Seule l'empreinte du jeton est gardée : une copie de la base ne
  // permet pas de réinitialiser un mot de passe.
  const token = genererJetonEphemere();
  utilisateur.tokenReinitialisation = sha256(token);
  utilisateur.tokenReinitialisationExpire = new Date(Date.now() + DUREE_RESET_MIN * 60 * 1000);
  await utilisateur.save();
  await journaliserAudit(req, { action: 'reinitialisation_demandee', utilisateur, cible: utilisateur.email });

  const lien = lienReinitialisation(token);
  const message = emailReinitialisation({
    prenom: utilisateur.prenom, email: utilisateur.email, lien, minutes: DUREE_RESET_MIN, etablissement,
  });
  await envoyerEmail(utilisateur.email, message.sujet, message.texte, [], { html: message.html });

  return res.json(MESSAGE_GENERIQUE_RESET);
}

async function reinitialiserMotDePasse(req, res) {
  const { token, motDePasse } = req.body;
  if (!token || !motDePasse) {
    return res.status(400).json({ erreur: 'jeton et mot de passe requis' });
  }

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findOne({ where: { tokenReinitialisation: sha256(String(token)) } });
  if (!utilisateur || !utilisateur.tokenReinitialisationExpire || new Date() > utilisateur.tokenReinitialisationExpire) {
    return res.status(400).json({ erreur: 'lien invalide ou expiré, refais une demande de réinitialisation' });
  }
  if (utilisateur.role === 'etudiant') {
    return res.status(403).json({ erreur: "le mot de passe d'un étudiant est son matricule, il ne se modifie pas" });
  }
  const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse, { email: utilisateur.email });
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
  }

  utilisateur.motDePasse = await bcrypt.hash(motDePasse, COUT_BCRYPT_PERSONNEL);
  utilisateur.motDePasseChangeLe = new Date();
  utilisateur.tokenReinitialisation = null;
  utilisateur.tokenReinitialisationExpire = null;
  utilisateur.echecsConnexion = 0;
  utilisateur.verrouilleJusqua = null;
  await utilisateur.save();
  // Toutes les sessions ouvertes avec l'ancien mot de passe sont fermées.
  await revoquerSessions(utilisateur.id, { motif: 'mot de passe réinitialisé' });
  await journaliserAudit(req, { action: 'mot_de_passe_reinitialise', utilisateur, cible: utilisateur.email });

  return res.json({ message: 'mot de passe mis à jour, tu peux te connecter' });
}

async function monProfil(req, res) {
  return res.json({ profil: await profilDeSession(req.utilisateur, req.sessionParent) });
}

// Symétrique de superadminController.mettreAJourMonProfil, pour les trois
// autres rôles — jusqu'ici seul le superadmin pouvait changer son propre
// mot de passe depuis l'app ; Académie, Finance et Étudiant n'avaient
// aucun moyen en libre-service (ex. après un mot de passe temporaire
// reçu par e-mail).
async function mettreAJourMonProfil(req, res) {
  const { nom, prenom, motDePasse } = req.body;
  // L'identité et le mot de passe (matricule) d'un étudiant sont gérés par
  // son établissement, jamais par lui-même.
  if (req.utilisateur.role === 'etudiant') {
    return res.status(403).json({ erreur: "les informations d'un compte étudiant sont gérées par l'établissement" });
  }
  if (!nom || !prenom) {
    return res.status(400).json({ erreur: 'nom et prénom sont obligatoires' });
  }
  // Changer d'identifiant (e-mail) ou de mot de passe demande le mot de
  // passe actuel : une session laissée ouverte ne suffit pas.
  const nouvelEmail = String(req.body.email || '').trim();
  const changeEmail = nouvelEmail && nouvelEmail.toLowerCase() !== String(req.utilisateur.email).toLowerCase();
  if (changeEmail || motDePasse) {
    const avecMotDePasse = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
    if (!req.body.motDePasseActuel || !(await bcrypt.compare(req.body.motDePasseActuel, avecMotDePasse.motDePasse))) {
      return res.status(400).json({ erreur: 'mot de passe actuel incorrect' });
    }
  }
  if (changeEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nouvelEmail)) return res.status(400).json({ erreur: 'adresse e-mail invalide' });
    if (await Utilisateur.findOne({ where: { email: nouvelEmail } })) {
      return res.status(400).json({ erreur: 'cette adresse est déjà utilisée par un autre compte' });
    }
    req.utilisateur.email = nouvelEmail;
  }
  req.utilisateur.nom = nom;
  req.utilisateur.prenom = prenom;
  if (motDePasse) {
    const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse, { email: req.utilisateur.email });
    if (erreurMotDePasse) {
      return res.status(400).json({ erreur: erreurMotDePasse });
    }
    req.utilisateur.motDePasse = await bcrypt.hash(motDePasse, COUT_BCRYPT_PERSONNEL);
    req.utilisateur.motDePasseChangeLe = new Date();
  }
  await req.utilisateur.save();
  if (motDePasse) {
    await revoquerSessions(req.utilisateur.id, { sauf: req.session.id, motif: 'mot de passe changé' });
    await journaliserAudit(req, { action: 'mot_de_passe_change', cible: req.utilisateur.email });
  }
  if (changeEmail) await journaliserAudit(req, { action: 'email_change', cible: nouvelEmail });
  return res.json({ profil: req.utilisateur.toPublicJSON() });
}

module.exports = {
  seConnecter,
  renvoyerCode,
  verifierDoubleFacteur,
  initialiserTotpConnexion,
  activerTotpConnexion,
  verifierTotpConnexion,
  securite,
  fermerSession,
  fermerAutresSessions,
  seDeconnecter,
  initialiserTotpCompte,
  activerTotpCompte,
  desactiverTotpCompte,
  regenererCodesSecours,
  creerCompte,
  monProfil,
  mettreAJourMonProfil,
  demanderReinitialisation,
  reinitialiserMotDePasse,
  ROLES_TOTP,
};
