const express = require('express');
const ctrl = require('../controllers/superadminController');
const pilotage = require('../controllers/pilotageController');
const fonctionnalites = require('../controllers/fonctionnalitesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const superadmin = autoriserRoles('superadmin');

router.get('/etablissements', authentifier, superadmin, ctrl.listerEtablissements);
router.get('/etablissements/:id', authentifier, superadmin, ctrl.obtenirEtablissement);
router.post('/etablissements', authentifier, superadmin, ctrl.creerEtablissement);
router.put('/etablissements/:id', authentifier, superadmin, ctrl.modifierEtablissement);
router.delete('/etablissements/:id', authentifier, superadmin, ctrl.supprimerEtablissement);
router.patch('/etablissements/:id/statut', authentifier, superadmin, ctrl.changerStatutEtablissement);
router.put('/etablissements/:id/reinitialiser-academie', authentifier, superadmin, ctrl.reinitialiserMotDePasseAcademie);

router.get('/statistiques', authentifier, superadmin, ctrl.obtenirStatistiques);
router.get('/config-email', authentifier, superadmin, ctrl.obtenirConfigEmail);
router.post('/email-test', authentifier, superadmin, ctrl.envoyerEmailTest);

router.get('/fonctionnalites', authentifier, superadmin, fonctionnalites.listerCatalogue);
router.post('/fonctionnalites', authentifier, superadmin, fonctionnalites.creerFonctionnalite);
router.put('/fonctionnalites/:cle', authentifier, superadmin, fonctionnalites.modifierFonctionnalite);
router.delete('/fonctionnalites/:cle', authentifier, superadmin, fonctionnalites.supprimerFonctionnalite);
router.put('/fonctionnalites/:cle/ecoles', authentifier, superadmin, fonctionnalites.definirEcoles);
router.post('/etablissements/:id/fonctionnalites', authentifier, superadmin, fonctionnalites.ajouterAEcole);
router.delete('/etablissements/:id/fonctionnalites/:cle', authentifier, superadmin, fonctionnalites.retirerDeEcole);

router.get('/mises-a-jour', authentifier, superadmin, pilotage.listerMisesAJour);
router.post('/mises-a-jour', authentifier, superadmin, pilotage.creerMiseAJour);
router.put('/mises-a-jour/:id', authentifier, superadmin, pilotage.modifierMiseAJour);
router.post('/mises-a-jour/:id/publier', authentifier, superadmin, pilotage.publierMiseAJour);
router.delete('/mises-a-jour/:id', authentifier, superadmin, pilotage.supprimerMiseAJour);
router.get('/systeme', authentifier, superadmin, pilotage.obtenirSysteme);

router.get('/diffusion', authentifier, superadmin, pilotage.obtenirDiffusion);
router.put('/annonce', authentifier, superadmin, pilotage.publierAnnonce);
router.delete('/annonce', authentifier, superadmin, pilotage.retirerAnnonce);
router.put('/maintenance', authentifier, superadmin, pilotage.definirMaintenance);

router.get('/journal', authentifier, superadmin, pilotage.listerJournal);

router.get('/superadmins', authentifier, superadmin, ctrl.listerSuperadmins);
router.post('/comptes', authentifier, superadmin, ctrl.creerSuperadmin);

router.put('/mon-profil', authentifier, superadmin, ctrl.mettreAJourMonProfil);

module.exports = router;
