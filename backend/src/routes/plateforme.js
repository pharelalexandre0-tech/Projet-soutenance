const express = require('express');
const ctrl = require('../controllers/plateformeController');
const { authentifier } = require('../middlewares/auth');

const router = express.Router();

router.get('/statut', ctrl.statutPublic);
router.get('/etat', authentifier, ctrl.etatPourUtilisateur);
router.put('/nouveautes/vues', authentifier, ctrl.marquerNouveautesVues);

module.exports = router;
