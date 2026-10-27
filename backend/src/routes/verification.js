const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { ipClient } = require('../utils/ipClient');
const ctrl = require('../controllers/verificationController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

// Pages publiques : sans connexion, mais limitées pour qu'on ne puisse pas
// essayer des codes en masse (2^60 combinaisons, 40 essais par quart d'heure).
const limiteurVerification = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'trop de vérifications depuis cette connexion, réessayez dans quelques minutes' },
  keyGenerator: (req) => ipKeyGenerator(ipClient(req)),
});

router.get('/verification/cle-publique', ctrl.clePublique);
router.get('/verification/:code', limiteurVerification, ctrl.verifier);

router.get('/certifications', authentifier, autoriserRoles('academie', 'finance'), ctrl.registre);
router.post('/certifications/:code/annuler', authentifier, autoriserRoles('academie', 'finance'), ctrl.annuler);

module.exports = router;
