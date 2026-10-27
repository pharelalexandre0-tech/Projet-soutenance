const { verifySession } = require('../utils/jwt');
const { sessionValide } = require('../services/sessionService');

const ROUTES_MINISTERE = /^\/api\/(ministere|auth|verification|evenements|plateforme\/statut)(\/|\?|$)/;
const { Utilisateur, Etablissement } = require('../models');
const { maintenanceEnCours, repondreMaintenance } = require('../services/plateformeService');

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
    // La session doit toujours être ouverte en base : fermée à distance,
    // expirée ou inconnue, le jeton ne suffit plus.
    const session = await sessionValide(payload);
    if (!session) {
      return res.status(401).json({ erreur: 'session expirée ou fermée, reconnectez-vous' });
    }
    const utilisateur = await Utilisateur.findByPk(payload.id);
    if (!utilisateur) {
      return res.status(401).json({ erreur: "erreur d'authentification" });
    }
    // Un superadmin verrouille un compte précis, ou suspend une école
    // entière -> perte d'accès immédiate, pas seulement à la prochaine
    // connexion (le token déjà émis ne doit plus suffire).
    if (utilisateur.statut === 'verrouille') {
      return res.status(403).json({ erreur: 'compte verrouillé, contactez votre administrateur' });
    }
    if (utilisateur.etablissementId) {
      const etablissement = await Etablissement.findByPk(utilisateur.etablissementId);
      if (!etablissement || etablissement.statut === 'suspendu') {
        return res.status(403).json({ erreur: 'établissement suspendu, contactez le support' });
      }
    }
    // Mode maintenance : seul le superadmin garde la main (c'est lui qui
    // conduit la maintenance), toutes les sessions d'école sont mises en
    // attente, y compris celles ouvertes avant son déclenchement.
    if (utilisateur.role !== 'superadmin') {
      const maintenance = await maintenanceEnCours();
      if (maintenance) return repondreMaintenance(res, maintenance);
    }
    // Agent du ministère : uniquement son espace (données agrégées), son
    // compte et la vérification des documents. Aucune route d'école, même
    // une route qui ne filtrerait que par établissement.
    if (utilisateur.role === 'ministere' && !ROUTES_MINISTERE.test(req.originalUrl)) {
      return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
    }
    req.utilisateur = utilisateur;
    req.session = session;
    // Session ouverte par le parent sur le compte étudiant de son enfant :
    // mêmes droits, seul l'affichage change (Espace Parents).
    req.sessionParent = utilisateur.role === 'etudiant' && payload.parent === true;
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
