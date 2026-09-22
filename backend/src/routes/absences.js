const express = require('express');
const {
  justifierAbsence,
  listerAbsencesEleve,
  statistiquesAbsences,
} = require('../controllers/absencesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

// La saisie d'absences par l'Académie (appel classe par classe, brief,
// suppression manuelle) a été retirée avec l'onglet "Absences" — l'appel se
// fait désormais uniquement par le Professeur via son accès temporaire
// (comptesEphemeresController, saisirAppelEphemere), qui alimente les
// mêmes lignes Absence que l'ancien flux Académie.
router.get('/statistiques', authentifier, autoriserRoles('academie'), statistiquesAbsences);
router.get('/eleve/:eleveId', authentifier, listerAbsencesEleve);
router.post('/:id/justificatif', authentifier, autoriserRoles('etudiant'), justifierAbsence);

module.exports = router;
