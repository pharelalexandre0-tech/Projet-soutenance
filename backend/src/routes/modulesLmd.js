const express = require('express');
const ctrl = require('../controllers/modulesLmdController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');
const { exigerFonctionnalite } = require('../middlewares/plateforme');

// Modules LMD complémentaires (chacun activé école par école par le superadmin).
const router = express.Router();
const academie = autoriserRoles('academie');
const etudiant = autoriserRoles('etudiant');
const academieOuEtudiant = autoriserRoles('academie', 'etudiant');
const module_ = (cle) => exigerFonctionnalite(cle);

// Préinscription (Académie)
router.get('/preinscriptions', authentifier, academie, module_('preinscription'), ctrl.listerPreinscriptions);
router.get('/preinscriptions/pieces/:id', authentifier, academie, module_('preinscription'), ctrl.telechargerPiece);
router.put('/preinscriptions/:id', authentifier, academie, module_('preinscription'), ctrl.deciderPreinscription);
router.post('/preinscriptions/:id/inscrire', authentifier, academie, module_('preinscription'), ctrl.inscrireCandidat);

// Anonymat des copies
router.get('/anonymat', authentifier, academie, module_('anonymat'), ctrl.listeAnonymat);
router.post('/anonymat', authentifier, academie, module_('anonymat'), ctrl.genererAnonymat);
router.post('/anonymat/notes', authentifier, academie, module_('anonymat'), ctrl.saisirParNumero);
router.post('/anonymat/lever', authentifier, academie, module_('anonymat'), ctrl.leverAnonymat);

// Mémoires, soutenances, thèses
router.get('/memoires', authentifier, academie, module_('soutenances'), ctrl.listerMemoires);
router.post('/memoires', authentifier, academie, module_('soutenances'), ctrl.enregistrerMemoire);
router.put('/memoires/:id', authentifier, academie, module_('soutenances'), ctrl.enregistrerMemoire);
router.get('/memoires/moi', authentifier, etudiant, module_('soutenances'), ctrl.monMemoire);
router.get('/memoires/:id/pv', authentifier, academieOuEtudiant, module_('soutenances'), ctrl.pvSoutenance);

// Diplômes
router.get('/diplomes/eligibles', authentifier, academie, module_('diplomes'), ctrl.eligibles);
router.post('/diplomes/:eleveId', authentifier, academie, module_('diplomes'), ctrl.delivrerDiplome);
router.get('/diplomes/moi', authentifier, etudiant, module_('diplomes'), ctrl.mesDiplomes);
router.get('/diplomes/:id/pdf', authentifier, academieOuEtudiant, module_('diplomes'), ctrl.pdfDiplome);
router.get('/diplomes/:id/supplement', authentifier, academieOuEtudiant, module_('diplomes'), ctrl.pdfSupplement);

// Mobilité et transferts de crédits
router.get('/transferts', authentifier, academie, module_('mobilite'), ctrl.listerTransferts);
router.post('/transferts', authentifier, academie, module_('mobilite'), ctrl.ajouterTransfert);
router.delete('/transferts/:id', authentifier, academie, module_('mobilite'), ctrl.retirerTransfert);

// Préinscription publique (sans compte) : corps plus grand pour les pièces.
const publique = express.Router();
publique.get('/offres', ctrl.offresPubliques);
publique.post('/', ctrl.deposer);

module.exports = { router, publique };
