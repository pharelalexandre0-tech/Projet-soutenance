const express = require('express');
const { lancerAnalyse, listerAlertes, historiqueEleve } = require('../controllers/predictionController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

const router = express.Router();
const alertesIA = exigerFonctionnalite('prediction');

router.post('/executer', authentifier, alertesIA, autoriserRoles('academie'), lancerAnalyse);
router.get('/alertes', authentifier, alertesIA, autoriserRoles('academie'), listerAlertes);
router.get('/eleve/:eleveId', authentifier, alertesIA, historiqueEleve);

module.exports = router;
