const express = require('express');
const ctrl = require('../controllers/authController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/connexion', ctrl.seConnecter);
router.post('/connexion/double-facteur', ctrl.verifierDoubleFacteur);
router.post('/connexion/renvoyer-code', ctrl.renvoyerCode);
// Application d'authentification du personnel (jeton d'étape requis).
router.post('/connexion/application', ctrl.verifierTotpConnexion);
router.post('/connexion/application/initialiser', ctrl.initialiserTotpConnexion);
router.post('/connexion/application/activer', ctrl.activerTotpConnexion);
router.post('/mot-de-passe-oublie', ctrl.demanderReinitialisation);
router.post('/reinitialiser-mot-de-passe', ctrl.reinitialiserMotDePasse);
// Réservé à l'Académie : évite qu'un compte non authentifié s'auto-crée un
// accès (le premier superadmin se crée par npm run init:superadmin).
router.post('/comptes', authentifier, autoriserRoles('academie'), ctrl.creerCompte);
router.get('/moi', authentifier, ctrl.monProfil);
router.put('/mon-profil', authentifier, ctrl.mettreAJourMonProfil);

// Sécurité du compte : appareils connectés, application d'authentification.
router.get('/securite', authentifier, ctrl.securite);
router.post('/deconnexion', authentifier, ctrl.seDeconnecter);
router.delete('/sessions/:id', authentifier, ctrl.fermerSession);
router.post('/sessions/fermer-autres', authentifier, ctrl.fermerAutresSessions);
router.post('/securite/application/initialiser', authentifier, ctrl.initialiserTotpCompte);
router.post('/securite/application/activer', authentifier, ctrl.activerTotpCompte);
router.post('/securite/codes-secours', authentifier, ctrl.regenererCodesSecours);

module.exports = router;
