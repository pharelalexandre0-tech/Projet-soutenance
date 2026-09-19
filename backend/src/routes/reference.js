const express = require('express');
const ctrl = require('../controllers/referenceController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const academie = autoriserRoles('academie');

router.post('/classes', authentifier, academie, ctrl.creerClasse);
// Renvoie la liste complète des élèves de CHAQUE classe (noms, dates de
// naissance...) — jamais destiné à étudiant/parent, qui n'y accédaient que
// faute d'une restriction de rôle explicite ici (seuls Académie et Finance
// l'appellent réellement, voir leurs pages respectives).
router.get('/classes', authentifier, autoriserRoles('academie', 'finance'), ctrl.listerClasses);
router.put('/classes/:id', authentifier, academie, ctrl.modifierClasse);
router.delete('/classes/:id', authentifier, academie, ctrl.supprimerClasse);
router.get('/classes/:id/statistiques', authentifier, academie, ctrl.statistiquesClasse);

router.post('/professeurs', authentifier, academie, ctrl.creerProfesseur);
router.get('/professeurs', authentifier, academie, ctrl.listerProfesseurs);
router.delete('/professeurs/:id', authentifier, academie, ctrl.supprimerProfesseur);

router.post('/eleves', authentifier, academie, ctrl.creerEleve);
router.get('/eleves', authentifier, ctrl.listerEleves);
router.delete('/eleves/:id', authentifier, academie, ctrl.supprimerEleve);

router.post('/semestres', authentifier, academie, ctrl.creerSemestre);
router.get('/semestres', authentifier, ctrl.listerSemestres);

router.post('/unites-enseignement', authentifier, academie, ctrl.creerUE);
router.get('/unites-enseignement', authentifier, ctrl.listerUE);

router.post('/matieres', authentifier, academie, ctrl.creerMatiere);
router.get('/matieres', authentifier, ctrl.listerMatieres);

router.post('/emplois-du-temps', authentifier, academie, ctrl.creerEmploiDuTemps);
router.get('/emplois-du-temps', authentifier, ctrl.listerEmploisDuTemps);
router.delete('/emplois-du-temps/:id', authentifier, academie, ctrl.supprimerEmploiDuTemps);

router.get('/cahier-de-textes', authentifier, ctrl.listerCahierDeTextes);
router.post('/cahier-de-textes', authentifier, academie, ctrl.ajouterCahierDeTextes);

router.post('/messages', authentifier, academie, ctrl.envoyerMessage);
router.get('/messages', authentifier, ctrl.listerMessages);

router.get('/tableau-de-bord/academique', authentifier, academie, ctrl.statistiquesAcademiques);

router.get('/etablissement', authentifier, ctrl.obtenirEtablissement);
router.put('/etablissement', authentifier, academie, ctrl.configurerEtablissement);

module.exports = router;
