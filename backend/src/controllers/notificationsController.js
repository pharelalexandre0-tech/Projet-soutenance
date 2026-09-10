const { Notification } = require('../models');

// "Recevoir notifications et messages" (Espace Parents) — utilisé aussi par
// l'Académie pour les alertes de prédiction IA.
async function mesNotifications(req, res) {
  const notifications = await Notification.findAll({
    where: { utilisateurId: req.utilisateur.id },
    order: [['dateEnvoi', 'DESC']],
  });
  return res.json({ notifications });
}

async function marquerLue(req, res) {
  const { id } = req.params;
  const notification = await Notification.findOne({ where: { id, utilisateurId: req.utilisateur.id } });
  if (!notification) return res.status(404).json({ erreur: 'notification introuvable' });
  notification.lu = true;
  await notification.save();
  return res.json({ notification });
}

module.exports = { mesNotifications, marquerLue };
