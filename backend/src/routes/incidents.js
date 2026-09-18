const express = require('express');
const { creerIncident, listerIncidentsEleve } = require('../controllers/incidentsController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/', authentifier, autoriserRoles('academie'), creerIncident);
router.get('/eleve/:eleveId', authentifier, listerIncidentsEleve);

module.exports = router;
