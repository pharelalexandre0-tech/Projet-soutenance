const express = require('express');
const ctrl = require('../controllers/documentsController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

// Documents à télécharger par l'Académie (PDF officiels et Excel).
const router = express.Router();
const academie = autoriserRoles('academie');

router.get('/liste-presence', authentifier, academie, ctrl.listePresence);
router.get('/recapitulatif-presences', authentifier, academie, ctrl.recapitulatifPresences);
router.get('/resultats', authentifier, academie, ctrl.resultats);
router.get('/emplois-du-temps', authentifier, exigerFonctionnalite('emplois-du-temps'), academie, ctrl.emploisDuTemps);

module.exports = router;
