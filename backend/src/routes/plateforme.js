const express = require('express');
const ctrl = require('../controllers/plateformeController');
const { authentifier } = require('../middlewares/auth');

const router = express.Router();

router.get('/statut', ctrl.statutPublic);
router.get('/etablissements/:id/logo', ctrl.logoEtablissement);
// Politique de confidentialité : publique, lisible sans être connecté.
router.get('/confidentialite', async (req, res) => {
  const { lirePolitique } = require('../services/confidentialiteService');
  return res.json(await lirePolitique());
});
router.get('/etat', authentifier, ctrl.etatPourUtilisateur);
router.put('/nouveautes/vues', authentifier, ctrl.marquerNouveautesVues);

module.exports = router;
