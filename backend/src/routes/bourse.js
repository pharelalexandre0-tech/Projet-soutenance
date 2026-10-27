const express = require('express');
const ctrl = require('../controllers/bourseController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();
// Le dossier ANBG est celui de l'étudiant lui-même : pas de session parent.
const etudiantSeul = autoriserRoles('etudiant');
const etudiant = (req, res, next) => etudiantSeul(req, res, () => (req.sessionParent
  ? res.status(403).json({ erreur: 'le dossier de bourse est réservé à l’étudiant' })
  : next()));
const academie = autoriserRoles('academie');
// Fichier envoyé tel quel (corps binaire), 6 Mo au plus avant contrôle.
const binaire = express.raw({ type: () => true, limit: '6mb' });

// Étudiant
router.get('/bourse/moi', authentifier, etudiant, ctrl.monDossier);
router.put('/bourse/moi', authentifier, etudiant, ctrl.majMonDossier);
router.post('/bourse/moi/pieces', authentifier, etudiant, binaire, ctrl.deposerMaPiece);
router.post('/bourse/moi/pieces/generer', authentifier, etudiant, ctrl.genererPiece);
router.delete('/bourse/moi/pieces/:id', authentifier, etudiant, ctrl.retirerMaPiece);
router.post('/bourse/moi/soumettre', authentifier, etudiant, ctrl.soumettre);
router.get('/bourse/pieces/:id/fichier', authentifier, etudiant, ctrl.telechargerPiece);

// Académie : liste des boursiers de l'établissement, en lecture seule.
// Le dossier et ses pièces restent l'affaire de l'étudiant et de l'ANBG.
router.get('/bourse/boursiers', authentifier, academie, ctrl.listerBoursiers);
router.get('/bourse/export', authentifier, academie, ctrl.exporter);

module.exports = router;
