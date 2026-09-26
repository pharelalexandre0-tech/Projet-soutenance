const express = require('express');
const {
  seConnecter, verifierDoubleFacteur, creerCompte, monProfil, mettreAJourMonProfil,
  demanderReinitialisation, reinitialiserMotDePasse,
} = require('../controllers/authController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/connexion', seConnecter);
router.post('/connexion/double-facteur', verifierDoubleFacteur);
router.post('/mot-de-passe-oublie', demanderReinitialisation);
router.post('/reinitialiser-mot-de-passe', reinitialiserMotDePasse);
// Réservé à l'Académie : évite qu'un compte non authentifié s'auto-crée un
// accès (le premier superadmin se crée par npm run init:superadmin).
router.post('/comptes', authentifier, autoriserRoles('academie'), creerCompte);
router.get('/moi', authentifier, monProfil);
router.put('/mon-profil', authentifier, mettreAJourMonProfil);

module.exports = router;
