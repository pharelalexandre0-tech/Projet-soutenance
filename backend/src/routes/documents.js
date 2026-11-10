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
// Documents en lot (sélection multiple d'étudiants ou de classes).
const lot = require('../controllers/documentsLotController');
router.post('/lot/telecharger', authentifier, academie, lot.telecharger);
router.post('/lot/envoyer', authentifier, academie, lot.envoyer);
router.get('/lots', authentifier, academie, lot.historique);
router.get('/lots/:id', authentifier, academie, lot.suivre);
router.post('/lot/proces-verbaux', authentifier, academie, lot.procesVerbaux);
router.get('/emplois-du-temps', authentifier, exigerFonctionnalite('emplois-du-temps'), academie, ctrl.emploisDuTemps);

module.exports = router;
