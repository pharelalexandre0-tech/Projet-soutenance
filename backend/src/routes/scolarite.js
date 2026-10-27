const express = require('express');
const deliberations = require('../controllers/deliberationsController');
const reclamations = require('../controllers/reclamationsController');
const scolarite = require('../controllers/scolariteController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const academie = autoriserRoles('academie');
const etudiant = autoriserRoles('etudiant');
const academieOuEtudiant = autoriserRoles('academie', 'etudiant');

// Délibérations du jury
router.get('/deliberations/:classeId/:semestreId', authentifier, academie, deliberations.consulter);
router.put('/deliberations/:classeId/:semestreId', authentifier, academie, deliberations.enregistrer);
router.post('/deliberations/:classeId/:semestreId/clore', authentifier, academie, deliberations.clore);
router.post('/deliberations/:classeId/:semestreId/rouvrir', authentifier, academie, deliberations.rouvrir);
router.get('/deliberations/:classeId/:semestreId/pv', authentifier, academie, deliberations.procesVerbal);

// Réclamations de notes
router.get('/reclamations/moi', authentifier, etudiant, reclamations.mesReclamations);
router.post('/reclamations', authentifier, etudiant, reclamations.deposer);
router.get('/reclamations', authentifier, academie, reclamations.lister);
router.post('/reclamations/:id/traiter', authentifier, academie, reclamations.traiter);

// Attestations, relevé officiel
router.get('/scolarite/attestation', authentifier, academieOuEtudiant, scolarite.attestation);
router.get('/scolarite/releve', authentifier, academieOuEtudiant, scolarite.releve);
router.get('/scolarite/semestres', authentifier, academieOuEtudiant, scolarite.semestresValides);

// Passage en année supérieure
router.get('/passage/:classeId', authentifier, academie, scolarite.propositionPassage);
router.post('/passage/:classeId', authentifier, academie, scolarite.appliquerPassage);

module.exports = router;
