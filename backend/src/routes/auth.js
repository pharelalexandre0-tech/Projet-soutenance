const express = require('express');
const { seConnecter, verifierDoubleFacteur, creerCompte, monProfil, mettreAJourMonProfil } = require('../controllers/authController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/connexion', seConnecter);
router.post('/connexion/double-facteur', verifierDoubleFacteur);
// Réservé à l'Académie : évite qu'un compte non authentifié s'auto-crée un
// accès (le seed, lui, passe directement par le modèle, pas par cette route).
router.post('/comptes', authentifier, autoriserRoles('academie'), creerCompte);
router.get('/moi', authentifier, monProfil);
router.put('/mon-profil', authentifier, mettreAJourMonProfil);

module.exports = router;
