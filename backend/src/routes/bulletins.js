const express = require('express');
const { obtenirBulletin, envoyerBulletinParEmail } = require('../controllers/bulletinController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

// Hors du périmètre Finance, comme les notes/absences : seuls l'Académie,
// l'Étudiant concerné et son Parent consultent ce bulletin.
router.get('/:eleveId/:semestreId', authentifier, autoriserRoles('academie', 'etudiant', 'parent'), obtenirBulletin);

// Envoi manuel par e-mail à l'étudiant — réservé à l'Académie.
router.post('/:eleveId/:semestreId/envoyer', authentifier, autoriserRoles('academie'), envoyerBulletinParEmail);

module.exports = router;
