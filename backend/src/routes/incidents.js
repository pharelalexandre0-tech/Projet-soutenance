const express = require('express');
const {
  creerIncident, listerIncidents, supprimerIncident, listerIncidentsEleve,
} = require('../controllers/incidentsController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.get('/', authentifier, autoriserRoles('academie'), listerIncidents);
router.post('/', authentifier, autoriserRoles('academie'), creerIncident);
router.delete('/:id', authentifier, autoriserRoles('academie'), supprimerIncident);
router.get('/eleve/:eleveId', authentifier, listerIncidentsEleve);

module.exports = router;
