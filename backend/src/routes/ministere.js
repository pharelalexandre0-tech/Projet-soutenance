const express = require('express');
const ctrl = require('../controllers/ministereController');
const tutelle = require('../controllers/tutelleController');
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

// Registre, classement et annuaire (consultation, PDF certifié, Excel).
router.get('/ministere/registre', authentifier, ministere, tutelle.registre);
router.get('/ministere/classement', authentifier, ministere, tutelle.classement);
router.get('/ministere/annuaire', authentifier, ministere, tutelle.annuaire);
// Habilitation des formations.
router.get('/ministere/habilitations', authentifier, ministere, tutelle.listerHabilitations);
router.post('/ministere/habilitations', authentifier, ministere, tutelle.creerHabilitation);
router.put('/ministere/habilitations/:id', authentifier, ministere, tutelle.modifierHabilitation);
// Inspections et suivi des recommandations.
router.get('/ministere/inspections', authentifier, ministere, tutelle.listerInspections);
router.post('/ministere/inspections', authentifier, ministere, tutelle.programmerInspection);
router.put('/ministere/inspections/:id', authentifier, ministere, tutelle.rendreInspection);
router.post('/ministere/inspections/:id/cloture', authentifier, ministere, tutelle.cloturerInspection);
router.put('/ministere/recommandations/:id', authentifier, ministere, tutelle.suivreRecommandation);
router.get('/ministere/inspections/:id/rapport', authentifier, ministere, tutelle.rapportInspection);
// Calendrier universitaire national.
router.get('/ministere/calendrier', authentifier, ministere, tutelle.calendrier);
router.post('/ministere/calendrier', authentifier, ministere, tutelle.ajouterEvenement);
router.delete('/ministere/calendrier/:id', authentifier, ministere, tutelle.retirerEvenement);
router.post('/ministere/calendrier/publier', authentifier, ministere, tutelle.publierCalendrier);

// Côté établissement : tutelle (habilitations, inspections, calendrier).
router.get('/tutelle', authentifier, academie, tutelle.tutelleEtablissement);
router.put('/tutelle/recommandations/:id', authentifier, academie, tutelle.repondreRecommandation);
router.post('/tutelle/calendrier/accuse', authentifier, academie, tutelle.accuserCalendrier);
router.get('/tutelle/inspections/:id/rapport', authentifier, academie, tutelle.rapportInspection);

// Côté établissement : circulaires reçues et situation d'agrément.
router.get('/circulaires', authentifier, academie, ctrl.circulairesRecues);
router.post('/circulaires/:id/lue', authentifier, academie, ctrl.marquerLue);
router.post('/circulaires/:id/accuse', authentifier, academie, ctrl.accuserReception);

module.exports = router;
