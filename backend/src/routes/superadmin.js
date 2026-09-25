const express = require('express');
const ctrl = require('../controllers/superadminController');
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

router.get('/superadmins', authentifier, superadmin, ctrl.listerSuperadmins);
router.post('/comptes', authentifier, superadmin, ctrl.creerSuperadmin);

router.put('/mon-profil', authentifier, superadmin, ctrl.mettreAJourMonProfil);

module.exports = router;
