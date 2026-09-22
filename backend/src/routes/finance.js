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

const router = express.Router();
const finance = autoriserRoles('finance');

// Un frais ne se définit plus pour un seul élève à la fois (definirFrais a
// été retiré) — toujours pour une classe, un niveau ou l'établissement
// entier, jamais élève par élève.
router.post('/frais/classe', authentifier, finance, definirFraisClasse);
router.get('/frais/eleve/:eleveId', authentifier, listerFraisEleve);

router.post('/paiements', authentifier, finance, enregistrerPaiement);
router.get('/paiements/eleve/:eleveId', authentifier, listerPaiementsEleve);

router.post('/impayes/verifier', authentifier, finance, verifierImpayes);
router.get('/impayes', authentifier, finance, tableauDeBordImpayes);
router.get('/impayes/par-classe', authentifier, finance, roulementFraisParClasse);
router.post('/impayes/:fraisId/relance', authentifier, finance, envoyerRelance);

router.get('/personnel', authentifier, finance, listerPersonnel);
router.post('/personnel', authentifier, finance, creerPersonnel);
router.get('/personnel/:personnelId/fiche', authentifier, finance, obtenirFichePaie);
router.post('/salaires', authentifier, finance, verserSalaire);

module.exports = router;
