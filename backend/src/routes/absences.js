const express = require('express');
const {
  saisirAbsenceAcademie,
  saisirAppelClasse,
  briefAbsenteisme,
  justifierAbsence,
  listerAbsencesEleve,
  statistiquesAbsences,
} = require('../controllers/absencesController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const academie = autoriserRoles('academie');

router.post('/', authentifier, academie, saisirAbsenceAcademie);
router.post('/appel', authentifier, academie, saisirAppelClasse);
router.get('/brief', authentifier, academie, briefAbsenteisme);
router.get('/statistiques', authentifier, academie, statistiquesAbsences);
router.get('/eleve/:eleveId', authentifier, listerAbsencesEleve);
router.post('/:id/justificatif', authentifier, autoriserRoles('etudiant'), justifierAbsence);

module.exports = router;
