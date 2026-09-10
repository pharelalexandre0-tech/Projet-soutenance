const bcrypt = require('bcryptjs');
const { Utilisateur, Etablissement } = require('../models');
const { signSession } = require('../utils/jwt');

// Diagramme 3 - Authentification :
// Academie/Parent/Finance saisit ses identifiants -> demanderConnexion ->
// rechercherUtilisateur -> alt [valides]/[invalides].
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

  const token = signSession({ id: utilisateur.id, role: utilisateur.role });
  return res.json({
    token,
    profil: utilisateur.toPublicJSON(),
  });
}

// Creation de compte Academie / Finance / Parent (utile pour le seed et pour
// permettre a l'Academie de creer des comptes Finance/Parent depuis son
// espace).
async function creerCompte(req, res) {
  const { nom, prenom, email, motDePasse, role, service, fonction } = req.body;
  if (!nom || !prenom || !email || !motDePasse || !role) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }
  if (!['academie', 'finance', 'parent'].includes(role)) {
    return res.status(400).json({ erreur: 'rôle invalide' });
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

module.exports = { seConnecter, creerCompte, monProfil };
