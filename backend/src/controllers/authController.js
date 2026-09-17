const bcrypt = require('bcryptjs');
const { Utilisateur, Etablissement } = require('../models');
const { signSession } = require('../utils/jwt');
const { envoyerEmail } = require('../services/emailService');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');

const DUREE_CODE_2FA_MIN = 10;

const ROLES_AVEC_2FA = ['etudiant'];

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
    return res.status(403).json({ erreur: 'compte verrouillé — contactez votre administrateur' });
  }
  if (utilisateur.etablissementId) {
    const etablissement = await Etablissement.findByPk(utilisateur.etablissementId);
    if (!etablissement || etablissement.statut === 'suspendu') {
      return res.status(403).json({ erreur: 'établissement suspendu — contactez le support' });
    }
  }

  if (ROLES_AVEC_2FA.includes(utilisateur.role)) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    utilisateur.codeDoubleFacteur = code;
    utilisateur.codeDoubleFacteurExpire = new Date(Date.now() + DUREE_CODE_2FA_MIN * 60 * 1000);
    await utilisateur.save();
    await envoyerEmail(
      utilisateur.email,
      'Votre code de connexion EduSphere',
      `Votre code de vérification est : ${code}\nIl expire dans ${DUREE_CODE_2FA_MIN} minutes.`
    );
    return res.json({ doubleFacteurRequis: true, utilisateurId: utilisateur.id });
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
    return res.status(400).json({ erreur: 'code expiré — reconnecte-toi pour en recevoir un nouveau' });
  }
  if (code !== utilisateur.codeDoubleFacteur) {
    return res.status(401).json({ erreur: 'code incorrect' });
  }

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

module.exports = { seConnecter, verifierDoubleFacteur, creerCompte, monProfil, mettreAJourMonProfil };
