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

router.get('/superadmins', authentifier, superadmin, ctrl.listerSuperadmins);
router.post('/comptes', authentifier, superadmin, ctrl.creerSuperadmin);
router.patch('/comptes/:id/statut', authentifier, superadmin, ctrl.changerStatutCompte);
router.post('/comptes/:id/reinitialiser-mot-de-passe', authentifier, superadmin, ctrl.reinitialiserMotDePasseCompte);

router.put('/mon-profil', authentifier, superadmin, ctrl.mettreAJourMonProfil);

module.exports = router;
