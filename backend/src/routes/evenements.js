const express = require('express');
const { authentifier } = require('../middlewares/auth');
const { abonner } = require('../services/evenementsService');

const router = express.Router();
const BATTEMENT_MS = 25 * 1000;

// Flux d'événements (Server-Sent Events) d'une session : l'école du compte
// connecté et la plateforme (tout, pour le superadmin). Le navigateur
// l'ouvre avec fetch (et non EventSource) pour envoyer son jeton dans
// l'en-tête Authorization plutôt que dans l'adresse. "no-transform" empêche la compression de retenir les
// messages, X-Accel-Buffering l'empêche côté nginx ; le battement garde la
// connexion ouverte à travers les proxys.
router.get('/', authentifier, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const envoyer = (evenement) => {
    res.write(`data: ${JSON.stringify(evenement)}\n\n`);
  };
  const desabonner = abonner(req.utilisateur.etablissementId, envoyer, { tout: req.utilisateur.role === 'superadmin' });
  const battement = setInterval(() => res.write(': battement\n\n'), BATTEMENT_MS);
  req.on('close', () => {
    clearInterval(battement);
    desabonner();
  });
});

module.exports = router;
