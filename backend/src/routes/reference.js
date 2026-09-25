const express = require('express');
const ctrl = require('../controllers/referenceController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

const router = express.Router();
const academie = autoriserRoles('academie');
const emplois = exigerFonctionnalite('emplois-du-temps');
const communication = exigerFonctionnalite('communication');

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

router.get('/parents', authentifier, academie, ctrl.listerParents);

router.post('/eleves', authentifier, academie, ctrl.creerEleve);
router.get('/eleves', authentifier, ctrl.listerEleves);
router.delete('/eleves/:id', authentifier, academie, ctrl.supprimerEleve);
router.put('/eleves/:id/parent', authentifier, academie, ctrl.rattacherParent);
router.delete('/eleves/:id/parent', authentifier, academie, ctrl.detacherParent);
router.put('/comptes/:id/mot-de-passe', authentifier, academie, ctrl.reinitialiserMotDePasseCompte);

router.post('/semestres', authentifier, academie, ctrl.creerSemestre);
router.get('/semestres', authentifier, ctrl.listerSemestres);

router.post('/unites-enseignement', authentifier, academie, ctrl.creerUE);
router.get('/unites-enseignement', authentifier, ctrl.listerUE);

router.post('/matieres', authentifier, academie, ctrl.creerMatiere);

router.post('/emplois-du-temps', authentifier, emplois, academie, ctrl.creerEmploiDuTemps);
router.get('/emplois-du-temps', authentifier, emplois, ctrl.listerEmploisDuTemps);
router.get('/emplois-du-temps/pdf', authentifier, emplois, academie, ctrl.genererEmploiDuTempsPDFRoute);
router.get('/emplois-du-temps/publication', authentifier, emplois, academie, ctrl.etatPublicationEmploi);
router.post('/emplois-du-temps/publier', authentifier, emplois, academie, ctrl.publierEmploiDuTemps);
router.delete('/emplois-du-temps/:id', authentifier, emplois, academie, ctrl.supprimerEmploiDuTemps);

router.get('/cahier-de-textes', authentifier, ctrl.listerCahierDeTextes);
router.post('/cahier-de-textes', authentifier, academie, ctrl.ajouterCahierDeTextes);

router.post('/messages', authentifier, communication, academie, ctrl.envoyerMessage);
router.get('/messages', authentifier, communication, ctrl.listerMessages);

router.get('/tableau-de-bord/academique', authentifier, academie, ctrl.statistiquesAcademiques);

router.get('/etablissement', authentifier, ctrl.obtenirEtablissement);
router.put('/etablissement', authentifier, academie, ctrl.configurerEtablissement);

module.exports = router;
