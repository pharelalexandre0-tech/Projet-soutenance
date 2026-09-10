const { CompteEphemere } = require('../models');

// Diagramme 4 : verifierJeton(jeton) -> controler validite (portee,
// expiration, statut) avant d'ouvrir une session temporaire limitee.
async function verifierCompteEphemere(req, res, next) {
  const { jeton } = req.params;
  const compte = await CompteEphemere.findOne({ where: { jeton } });

  if (!compte) {
    return res.status(404).json({ erreur: "lien invalide, demande un nouvel accès" });
  }

  if (compte.statut === 'revoque') {
    return res.status(403).json({ erreur: "accès refusé : ce lien a déjà été utilisé" });
  }

  if (new Date() >= new Date(compte.dateExpiration)) {
    if (compte.statut !== 'expire') {
      compte.statut = 'expire';
      await compte.save();
    }
    return res.status(403).json({ erreur: "lien expiré, demande un nouvel accès" });
  }

  req.compteEphemere = compte;
  next();
}

module.exports = { verifierCompteEphemere };
