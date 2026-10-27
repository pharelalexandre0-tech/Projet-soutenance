const express = require('express');
const ctrl = require('../controllers/bourseController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
const etudiant = autoriserRoles('etudiant');
const academie = autoriserRoles('academie');
// Fichier envoyé tel quel (corps binaire), 6 Mo au plus avant contrôle.
const binaire = express.raw({ type: () => true, limit: '6mb' });

// Étudiant (ou son parent)
router.get('/bourse/moi', authentifier, etudiant, ctrl.monDossier);
router.put('/bourse/moi', authentifier, etudiant, ctrl.majMonDossier);
router.post('/bourse/moi/pieces', authentifier, etudiant, binaire, ctrl.deposerMaPiece);
router.post('/bourse/moi/pieces/generer', authentifier, etudiant, ctrl.genererPiece);
router.delete('/bourse/moi/pieces/:id', authentifier, etudiant, ctrl.retirerMaPiece);
router.post('/bourse/moi/soumettre', authentifier, etudiant, ctrl.soumettre);
router.get('/bourse/pieces/:id/fichier', authentifier, autoriserRoles('etudiant', 'academie'), ctrl.telechargerPiece);

// Académie
router.get('/bourse/dossiers', authentifier, academie, ctrl.listerDossiers);
router.get('/bourse/export', authentifier, academie, ctrl.exporter);
router.get('/bourse/dossiers/:eleveId', authentifier, academie, ctrl.dossierEtudiant);
router.post('/bourse/dossiers/:eleveId/pieces', authentifier, academie, binaire, ctrl.deposerPourEtudiant);
router.post('/bourse/dossiers/:eleveId/decision', authentifier, academie, ctrl.deciderDossier);
router.post('/bourse/pieces/:id/examiner', authentifier, academie, ctrl.examinerPiece);

module.exports = router;
