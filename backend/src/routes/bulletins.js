const express = require('express');
const { obtenirBulletin, envoyerBulletinParEmail } = require('../controllers/bulletinController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

// Hors du périmètre Finance, comme les notes/absences : seuls l'Académie et
// le Parent concerné consultent un bulletin.
router.get('/:eleveId/:semestreId', authentifier, autoriserRoles('academie', 'parent'), obtenirBulletin);

// Envoi manuel par e-mail au parent — réservé à l'Académie.
router.post('/:eleveId/:semestreId/envoyer', authentifier, autoriserRoles('academie'), envoyerBulletinParEmail);

module.exports = router;
