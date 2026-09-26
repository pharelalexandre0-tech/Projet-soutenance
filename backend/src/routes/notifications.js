const express = require('express');
const { Notification } = require('../models');
const { authentifier } = require('../middlewares/auth');

const router = express.Router();
const AFFICHEES = 40;

// Notifications du compte connecté (absence signalée, paiement reçu,
// emploi du temps publié, alerte de décrochage...), les plus récentes
// d'abord. Le parent voit celles du compte de son enfant, qu'il ouvre.
router.get('/', authentifier, async (req, res) => {
  const where = { utilisateurId: req.utilisateur.id };
  const [notifications, nonLues] = await Promise.all([
    Notification.findAll({ where, order: [['dateEnvoi', 'DESC'], ['id', 'DESC']], limit: AFFICHEES }),
    Notification.count({ where: { ...where, lu: false } }),
  ]);
  return res.json({
    notifications: notifications.map((n) => ({ id: n.id, contenu: n.contenu, dateEnvoi: n.dateEnvoi, lu: n.lu })),
    nonLues,
  });
});

router.put('/lues', authentifier, async (req, res) => {
  await Notification.update({ lu: true }, { where: { utilisateurId: req.utilisateur.id, lu: false } });
  return res.status(204).send();
});

module.exports = router;
