const express = require('express');
const {
  creerCompteEphemere,
  verifierJeton,
  enregistrerNotesEphemere,
} = require('../controllers/comptesEphemeresController');
const { saisirAppelEphemere } = require('../controllers/absencesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { verifierCompteEphemere } = require('../middlewares/ephemeralAuth');
const { exigerFonctionnalite, exigerFonctionnaliteEphemere, bloquerSiMaintenance } = require('../middlewares/plateforme');

const router = express.Router();
// Lien de professeur : maintenance d'abord (pas de session, donc pas de
// passage par authentifier), puis validité du jeton, puis module ouvert
// pour l'école de la classe visée.
const lienProfesseur = [bloquerSiMaintenance, verifierCompteEphemere, exigerFonctionnaliteEphemere('acces-temporaires')];

// Académie : créer un accès temporaire pour un Professeur.
router.post('/', authentifier, exigerFonctionnalite('acces-temporaires'), autoriserRoles('academie'), creerCompteEphemere);

// Professeur : ouvrir le lien reçu, puis saisir les notes (ou les absences
// selon la tâche du compte éphémère). Pas de session classique ici, le
// jeton fait office d'authentification temporaire.
router.get('/:jeton', ...lienProfesseur, verifierJeton);
router.post('/:jeton/notes', ...lienProfesseur, enregistrerNotesEphemere);
router.post('/:jeton/absences', ...lienProfesseur, saisirAppelEphemere);

module.exports = router;
