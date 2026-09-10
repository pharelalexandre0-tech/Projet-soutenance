const express = require('express');
const ctrl = require('../controllers/referenceController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const academie = autoriserRoles('academie');

router.post('/classes', authentifier, academie, ctrl.creerClasse);
router.get('/classes', authentifier, ctrl.listerClasses);

router.post('/professeurs', authentifier, academie, ctrl.creerProfesseur);
router.get('/professeurs', authentifier, academie, ctrl.listerProfesseurs);

router.post('/eleves', authentifier, academie, ctrl.creerEleve);
router.get('/eleves', authentifier, ctrl.listerEleves);

router.post('/semestres', authentifier, academie, ctrl.creerSemestre);
router.get('/semestres', authentifier, ctrl.listerSemestres);

router.post('/unites-enseignement', authentifier, academie, ctrl.creerUE);
router.get('/unites-enseignement', authentifier, ctrl.listerUE);

router.post('/matieres', authentifier, academie, ctrl.creerMatiere);
router.get('/matieres', authentifier, ctrl.listerMatieres);

router.post('/emplois-du-temps', authentifier, academie, ctrl.creerEmploiDuTemps);
router.get('/emplois-du-temps', authentifier, ctrl.listerEmploisDuTemps);

router.get('/cahier-de-textes', authentifier, ctrl.listerCahierDeTextes);
router.post('/cahier-de-textes', authentifier, academie, ctrl.ajouterCahierDeTextes);

router.post('/messages', authentifier, academie, ctrl.envoyerMessage);
router.get('/messages', authentifier, ctrl.listerMessages);

router.get('/etablissement', authentifier, ctrl.obtenirEtablissement);
router.put('/etablissement', authentifier, academie, ctrl.configurerEtablissement);

module.exports = router;
