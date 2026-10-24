const express = require('express');
const { obtenirBulletin, envoyerBulletinParEmail, resultatsClasse } = require('../controllers/bulletinController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

// Hors du périmètre Finance, comme les notes/absences : seuls l'Académie,
// l'Étudiant concerné et son Parent consultent ce bulletin.
// Résultats de la classe (validés / rattrapage) : Académie seulement.
router.get('/classe/:classeId/:semestreId', authentifier, autoriserRoles('academie'), resultatsClasse);

router.get('/:eleveId/:semestreId', authentifier, autoriserRoles('academie', 'etudiant'), obtenirBulletin);

// Envoi manuel par e-mail à l'étudiant — réservé à l'Académie.
router.post('/:eleveId/:semestreId/envoyer', authentifier, autoriserRoles('academie'), envoyerBulletinParEmail);

module.exports = router;
