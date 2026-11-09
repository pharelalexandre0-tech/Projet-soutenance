const express = require('express');
const { saisirNotesAcademie, listerNotesEleve } = require('../controllers/notesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/', authentifier, autoriserRoles('academie'), require('../middlewares/idempotence'), saisirNotesAcademie);
router.get('/eleve/:eleveId', authentifier, listerNotesEleve);

module.exports = router;
