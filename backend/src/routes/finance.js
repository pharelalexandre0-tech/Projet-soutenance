const express = require('express');
const {
  definirFraisClasse,
  listerFraisEleve,
  enregistrerPaiement,
  listerPaiementsEleve,
  verifierImpayes,
  tableauDeBordImpayes,
  roulementFraisParClasse,
  envoyerRelance,
  verserSalaire,
} = require('../controllers/financeController');
const { listerPersonnel, creerPersonnel, obtenirFichePaie } = require('../controllers/personnelController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

const router = express.Router();
const finance = autoriserRoles('finance');
const paie = exigerFonctionnalite('paie');
// La Finance garde toujours la main sur les frais ; seule la consultation
// par les familles dépend du module "Frais et reçus en ligne".
const fraisEnLigne = exigerFonctionnalite('frais-en-ligne', { roles: ['etudiant', 'parent'] });

// Un frais ne se définit plus pour un seul élève à la fois (definirFrais a
// été retiré) — toujours pour une classe, un niveau ou l'établissement
// entier, jamais élève par élève.
router.post('/frais/classe', authentifier, finance, definirFraisClasse);
router.get('/frais/eleve/:eleveId', authentifier, fraisEnLigne, listerFraisEleve);

router.post('/paiements', authentifier, finance, enregistrerPaiement);
router.get('/paiements/eleve/:eleveId', authentifier, fraisEnLigne, listerPaiementsEleve);

router.post('/impayes/verifier', authentifier, finance, verifierImpayes);
router.get('/impayes', authentifier, finance, tableauDeBordImpayes);
router.get('/impayes/par-classe', authentifier, finance, roulementFraisParClasse);
router.post('/impayes/:fraisId/relance', authentifier, finance, envoyerRelance);

router.get('/personnel', authentifier, paie, finance, listerPersonnel);
router.post('/personnel', authentifier, paie, finance, creerPersonnel);
router.get('/personnel/:personnelId/fiche', authentifier, paie, finance, obtenirFichePaie);
router.post('/salaires', authentifier, paie, finance, verserSalaire);

module.exports = router;
