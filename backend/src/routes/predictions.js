const express = require('express');
const { lancerAnalyse, listerAlertes, historiqueEleve } = require('../controllers/predictionController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/executer', authentifier, autoriserRoles('academie'), lancerAnalyse);
router.get('/alertes', authentifier, autoriserRoles('academie'), listerAlertes);
router.get('/eleve/:eleveId', authentifier, historiqueEleve);

module.exports = router;
