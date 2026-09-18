const express = require('express');
const {
  creerCompteEphemere,
  verifierJeton,
  enregistrerNotesEphemere,
} = require('../controllers/comptesEphemeresController');
const { saisirAppelEphemere } = require('../controllers/absencesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { verifierCompteEphemere } = require('../middlewares/ephemeralAuth');

const router = express.Router();

// Académie : créer un accès temporaire pour un Professeur.
router.post('/', authentifier, autoriserRoles('academie'), creerCompteEphemere);

// Professeur : ouvrir le lien reçu, puis saisir les notes (ou les absences
// selon la tâche du compte éphémère). Pas de session classique ici, le
// jeton fait office d'authentification temporaire.
router.get('/:jeton', verifierCompteEphemere, verifierJeton);
router.post('/:jeton/notes', verifierCompteEphemere, enregistrerNotesEphemere);
router.post('/:jeton/absences', verifierCompteEphemere, saisirAppelEphemere);

module.exports = router;
