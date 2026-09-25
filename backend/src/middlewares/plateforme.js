const { Classe } = require('../models');
const { fonctionnaliteOuverte, maintenanceEnCours, repondreMaintenance } = require('../services/plateformeService');

const MESSAGE_FERMEE = "cette fonctionnalité n'est pas activée pour votre établissement";

// Masquer l'onglet côté frontend ne suffit pas : un appel direct à l'API
// doit lui aussi être refusé quand le module est fermé pour l'école.
// `roles` : ne contrôler que ces rôles (ex. les frais d'un élève restent
// toujours lisibles par la Finance, seule la consultation en ligne des
// familles dépend du module "Frais et reçus en ligne").
function exigerFonctionnalite(cle, { roles } = {}) {
  return async (req, res, next) => {
    const utilisateur = req.utilisateur;
    if (!utilisateur?.etablissementId) return next();
    if (roles && !roles.includes(utilisateur.role)) return next();
    if (await fonctionnaliteOuverte(cle, utilisateur.etablissementId)) return next();
    return res.status(403).json({ erreur: MESSAGE_FERMEE, fonctionnaliteFermee: cle });
  };
}

// Lien de professeur (compte éphémère) : pas de session, l'école se déduit
// de la classe sur laquelle porte le lien. À placer après
// verifierCompteEphemere, qui a déjà chargé req.compteEphemere.
function exigerFonctionnaliteEphemere(cle) {
  return async (req, res, next) => {
    const classe = await Classe.findByPk(req.compteEphemere.classeId, { attributes: ['etablissementId'] });
    if (!classe || (await fonctionnaliteOuverte(cle, classe.etablissementId))) return next();
    return res.status(403).json({ erreur: MESSAGE_FERMEE, fonctionnaliteFermee: cle });
  };
}

// Les liens de professeur n'ont pas de session (donc pas de passage par
// authentifier, qui porte le contrôle de maintenance pour tous les autres).
async function bloquerSiMaintenance(req, res, next) {
  const maintenance = await maintenanceEnCours();
  if (maintenance) return repondreMaintenance(res, maintenance);
  return next();
}

module.exports = { exigerFonctionnalite, exigerFonctionnaliteEphemere, bloquerSiMaintenance };
