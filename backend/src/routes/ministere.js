const express = require('express');
const ctrl = require('../controllers/ministereController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const ministere = autoriserRoles('ministere');
const academie = autoriserRoles('academie');

// Espace du Ministère de l'Enseignement supérieur.
router.get('/ministere/vue-nationale', authentifier, ministere, ctrl.vueNationale);
router.get('/ministere/etablissements/:id', authentifier, ministere, ctrl.ficheEtablissement);
router.post('/ministere/etablissements/:id/agrement', authentifier, ministere, ctrl.deciderAgrement);
router.get('/ministere/circulaires', authentifier, ministere, ctrl.listerCirculaires);
router.post('/ministere/circulaires', authentifier, ministere, ctrl.publierCirculaire);
router.get('/ministere/circulaires/:id', authentifier, ministere, ctrl.suiviCirculaire);
router.get('/ministere/documents', authentifier, ministere, ctrl.statistiquesDocuments);
router.get('/ministere/rapport', authentifier, ministere, ctrl.rapport);

// Côté établissement : circulaires reçues et situation d'agrément.
router.get('/circulaires', authentifier, academie, ctrl.circulairesRecues);
router.post('/circulaires/:id/lue', authentifier, academie, ctrl.marquerLue);
router.post('/circulaires/:id/accuse', authentifier, academie, ctrl.accuserReception);

module.exports = router;
