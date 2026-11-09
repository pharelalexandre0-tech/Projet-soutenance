const express = require('express');
const ctrl = require('../controllers/paiementsEnLigneController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

const router = express.Router();
const module_ = exigerFonctionnalite('paiement-en-ligne');
const etudiant = autoriserRoles('etudiant');
const finance = autoriserRoles('finance');

// Rappel du fournisseur de paiement : public, vérifié par signature.
router.post('/notification/:fournisseur', express.json(), ctrl.notification);

router.get('/configuration', authentifier, autoriserRoles('etudiant', 'finance'), module_, ctrl.configuration);
router.get('/moi', authentifier, etudiant, module_, ctrl.mesPaiements);
router.get('/etablissement', authentifier, finance, module_, ctrl.listeFinance);
router.post('/', authentifier, etudiant, module_, require('../middlewares/idempotence'), ctrl.initier);
router.get('/:reference', authentifier, autoriserRoles('etudiant', 'finance'), module_, ctrl.consulter);
router.post('/:reference/confirmer-test', authentifier, etudiant, module_, ctrl.confirmerTest);

module.exports = router;
