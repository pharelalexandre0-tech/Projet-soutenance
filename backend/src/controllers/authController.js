const bcrypt = require('bcryptjs');
const { Utilisateur, Etablissement, Eleve } = require('../models');
const { signSession } = require('../utils/jwt');
const { envoyerEmail } = require('../services/emailService');
const { emailCodeConnexion, emailReinitialisation, emailRappelMatricule } = require('../services/modelesEmail');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { lienReinitialisation } = require('../utils/liens');
const { maintenanceEnCours, repondreMaintenance, journaliser } = require('../services/plateformeService');

const DUREE_CODE_2FA_MIN = 10;
const DUREE_RESET_MIN = 30;

const ROLES_AVEC_2FA = ['etudiant', 'parent'];

// Diagramme 3 - Authentification :
// Academie/Etudiant/Finance saisit ses identifiants -> demanderConnexion ->
// rechercherUtilisateur -> alt [valides]/[invalides].
// Etudiant passe en plus par une double authentification (code à 6 chiffres
// envoyé par e-mail) avant que le token ne soit délivré, pour protéger son
// propre dossier ; Académie, Finance et Superadmin restent en simple
// facteur.
async function seConnecter(req, res) {
  const { email, motDePasse } = req.body;
  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: "identifiants incorrects" });
  }

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findOne({ where: { email } });
  if (!utilisateur) {
    return res.status(401).json({ erreur: "identifiants incorrects" });
  }

  const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.motDePasse);
  if (!motDePasseValide) {
    return res.status(401).json({ erreur: "identifiants incorrects" });
  }

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

  if (ROLES_AVEC_2FA.includes(utilisateur.role)) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    utilisateur.codeDoubleFacteur = code;
    utilisateur.codeDoubleFacteurExpire = new Date(Date.now() + DUREE_CODE_2FA_MIN * 60 * 1000);
    await utilisateur.save();
    const message = emailCodeConnexion({
      prenom: utilisateur.prenom, code, minutes: DUREE_CODE_2FA_MIN, etablissement: etablissement?.nom, role: utilisateur.role,
    });
    await envoyerEmail(utilisateur.email, message.sujet, message.texte, [], { html: message.html });
    return res.json({ doubleFacteurRequis: true, utilisateurId: utilisateur.id });
  }

  if (utilisateur.role === 'superadmin') {
    await journaliser(utilisateur, 'connexion', "Connexion à l'espace superadmin");
  }

  const token = signSession({ id: utilisateur.id, role: utilisateur.role });
  return res.json({
    token,
    profil: utilisateur.toPublicJSON(),
  });
}

// Deuxième étape de la connexion Etudiant : vérifie le code reçu par
// e-mail puis délivre le token, exactement comme une connexion normale.
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
  if (code !== utilisateur.codeDoubleFacteur) {
    return res.status(401).json({ erreur: 'code incorrect' });
  }
  // Maintenance déclenchée entre l'envoi du code et sa saisie.
  const maintenance = await maintenanceEnCours();
  if (maintenance) return repondreMaintenance(res, maintenance);

  utilisateur.codeDoubleFacteur = null;
  utilisateur.codeDoubleFacteurExpire = null;
  await utilisateur.save();

  const token = signSession({ id: utilisateur.id, role: utilisateur.role });
  return res.json({
    token,
    profil: utilisateur.toPublicJSON(),
  });
}

// Creation de compte Academie / Finance (utile pour le seed et pour
// permettre a l'Academie de creer des comptes Finance depuis son espace).
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
  const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
  }

  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
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

  const utilisateur = await Utilisateur.findOne({ where: { email } });
  if (!utilisateur) {
    return res.json(MESSAGE_GENERIQUE_RESET);
  }

  const etablissement = utilisateur.etablissementId
    ? await Etablissement.findByPk(utilisateur.etablissementId, { attributes: ['nom'] })
    : null;

  // Le mot de passe d'un étudiant est son matricule et ne se change pas :
  // on lui rappelle plutôt que de lui envoyer un lien de réinitialisation.
  if (utilisateur.role === 'etudiant') {
    const eleve = await Eleve.findOne({ where: { compteEtudiantId: utilisateur.id }, attributes: ['matricule'] });
    if (eleve?.matricule) {
      const message = emailRappelMatricule({ prenom: utilisateur.prenom, matricule: eleve.matricule, etablissement: etablissement?.nom });
      await envoyerEmail(utilisateur.email, message.sujet, message.texte, [], { html: message.html });
    }
    return res.json(MESSAGE_GENERIQUE_RESET);
  }

  const token = genererJetonEphemere();
  utilisateur.tokenReinitialisation = token;
  utilisateur.tokenReinitialisationExpire = new Date(Date.now() + DUREE_RESET_MIN * 60 * 1000);
  await utilisateur.save();

  const lien = lienReinitialisation(token);
  const message = emailReinitialisation({
    prenom: utilisateur.prenom, email: utilisateur.email, lien, minutes: DUREE_RESET_MIN, etablissement: etablissement?.nom,
  });
  await envoyerEmail(utilisateur.email, message.sujet, message.texte, [], { html: message.html });

  return res.json(MESSAGE_GENERIQUE_RESET);
}

async function reinitialiserMotDePasse(req, res) {
  const { token, motDePasse } = req.body;
  if (!token || !motDePasse) {
    return res.status(400).json({ erreur: 'jeton et mot de passe requis' });
  }
  const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
  }

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findOne({ where: { tokenReinitialisation: token } });
  if (!utilisateur || !utilisateur.tokenReinitialisationExpire || new Date() > utilisateur.tokenReinitialisationExpire) {
    return res.status(400).json({ erreur: 'lien invalide ou expiré, refais une demande de réinitialisation' });
  }
  if (utilisateur.role === 'etudiant') {
    return res.status(403).json({ erreur: "le mot de passe d'un étudiant est son matricule, il ne se modifie pas" });
  }

  utilisateur.motDePasse = await bcrypt.hash(motDePasse, 10);
  utilisateur.tokenReinitialisation = null;
  utilisateur.tokenReinitialisationExpire = null;
  await utilisateur.save();

  return res.json({ message: 'mot de passe mis à jour, tu peux te connecter' });
}

async function monProfil(req, res) {
  return res.json({ profil: req.utilisateur.toPublicJSON() });
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
  req.utilisateur.nom = nom;
  req.utilisateur.prenom = prenom;
  if (motDePasse) {
    const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
    if (erreurMotDePasse) {
      return res.status(400).json({ erreur: erreurMotDePasse });
    }
    req.utilisateur.motDePasse = await bcrypt.hash(motDePasse, 10);
  }
  await req.utilisateur.save();
  return res.json({ profil: req.utilisateur.toPublicJSON() });
}

module.exports = {
  seConnecter,
  verifierDoubleFacteur,
  creerCompte,
  monProfil,
  mettreAJourMonProfil,
  demanderReinitialisation,
  reinitialiserMotDePasse,
};
