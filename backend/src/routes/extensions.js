const express = require('express');
const ctrl = require('../controllers/extensionsController');
const { authentifier } = require('../middlewares/auth');

// Fonctionnalités personnalisées actives (assistant, formulaire, registre).
// Les droits se vérifient fonctionnalité par fonctionnalité dans le
// contrôleur : ajoutée à l'école, prévue pour l'espace, gestion réservée à
// l'Académie.
const router = express.Router();

router.use(authentifier);
router.get('/:cle', ctrl.lireDonnees);
router.post('/:cle/questions', ctrl.poserQuestion);
router.delete('/:cle/questions', ctrl.effacerQuestions);
router.post('/:cle/demandes', ctrl.envoyerDemande);
router.put('/:cle/demandes/:id', ctrl.traiterDemande);
router.post('/:cle/elements', ctrl.enregistrerElement);
router.put('/:cle/elements/:id', ctrl.enregistrerElement);
router.delete('/:cle/elements/:id', ctrl.supprimerElement);

module.exports = router;
