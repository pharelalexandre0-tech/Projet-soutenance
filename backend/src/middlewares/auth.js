const { verifySession } = require('../utils/jwt');
const { Utilisateur, Etablissement } = require('../models');

// Diagramme 3 : verification cote serveur d'une session (Academie ou
// Etudiant, et Finance qui suit le meme mecanisme d'authentification).
async function authentifier(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ erreur: "identifiants incorrects" });
  }
  try {
    const payload = verifySession(token);
    const utilisateur = await Utilisateur.findByPk(payload.id);
    if (!utilisateur) {
      return res.status(401).json({ erreur: "erreur d'authentification" });
    }
    // Un superadmin verrouille un compte précis, ou suspend une école
    // entière -> perte d'accès immédiate, pas seulement à la prochaine
    // connexion (le token déjà émis ne doit plus suffire).
    if (utilisateur.statut === 'verrouille') {
      return res.status(403).json({ erreur: 'compte verrouillé — contactez votre administrateur' });
    }
    if (utilisateur.etablissementId) {
      const etablissement = await Etablissement.findByPk(utilisateur.etablissementId);
      if (!etablissement || etablissement.statut === 'suspendu') {
        return res.status(403).json({ erreur: 'établissement suspendu — contactez le support' });
      }
    }
    req.utilisateur = utilisateur;
    next();
  } catch (err) {
    return res.status(401).json({ erreur: "erreur d'authentification" });
  }
}

function autoriserRoles(...roles) {
  return (req, res, next) => {
    if (!req.utilisateur || !roles.includes(req.utilisateur.role)) {
      return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
    }
    next();
  };
}

module.exports = { authentifier, autoriserRoles };
