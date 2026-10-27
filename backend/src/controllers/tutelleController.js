const { Op } = require('sequelize');
const XLSX = require('xlsx');
const {
  Etablissement, Utilisateur, Notification, HabilitationFormation, Inspection, RecommandationInspection, EvenementCalendrier, AccuseCalendrier,
} = require('../models');
const { lireNational } = require('../services/ministereService');
const { journaliserAudit } = require('../services/auditService');
const { donneesNationales } = require('./ministereController');
const docs = require('../services/documentsTutelleService');

// Actes de tutelle du Ministère : habilitation des formations, inspections
// et suivi de leurs recommandations, calendrier universitaire national,
// registre, classement et annuaire statistique (PDF certifiés et Excel).
// Côté établissement : consultation, réponses aux recommandations et
// accusé de réception du calendrier.

const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();
const texte = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);
const dateValide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const NATURES_CAL = ['rentree', 'cours', 'examens', 'deliberations', 'rattrapage', 'vacances', 'autre'];

function anneeCourante() {
  const d = new Date();
  const debut = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}

async function prevenirAcademie(etablissementId, contenu) {
  const academies = await Utilisateur.findAll({ where: { etablissementId, role: 'academie' }, attributes: ['id'] });
  await Notification.bulkCreate(academies.map((u) => ({ utilisateurId: u.id, dateEnvoi: new Date(), contenu: contenu.slice(0, 250) }))).catch(() => {});
}

function envoyerFichier(res, contenu, nom, type) {
  res.set({
    'Content-Type': type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nom}-${new Date().toISOString().slice(0, 10)}.${type}"`,
    'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'private, no-store',
  });
  return res.send(contenu);
}

const xlsx = (lignes, nomFeuille) => {
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ Information: 'Aucune donnée' }]), nomFeuille);
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' });
};

// Fiches nationales enrichies des actes de tutelle (formations habilitées,
// dernière inspection, recommandations ouvertes).
async function fichesTutelle() {
  const { fiches } = await donneesNationales();
  const habilitations = await HabilitationFormation.findAll({ attributes: ['etablissementId', 'statut'] });
  const inspections = await Inspection.findAll({ attributes: ['etablissementId', 'dateRealisee', 'datePrevue', 'statut'] });
  const recos = await RecommandationInspection.findAll({ where: { statut: { [Op.ne]: 'realisee' } }, attributes: ['etablissementId'] });
  return fiches.map((f) => {
    const realisees = inspections.filter((i) => i.etablissementId === f.id && i.dateRealisee).map((i) => i.dateRealisee).sort();
    return {
      ...f,
      formationsHabilitees: habilitations.filter((h) => h.etablissementId === f.id && h.statut !== 'retiree').length,
      derniereInspection: realisees[realisees.length - 1] || null,
      inspectionsProgrammees: inspections.filter((i) => i.etablissementId === f.id && i.statut === 'programmee').length,
      recommandationsOuvertes: recos.filter((r) => r.etablissementId === f.id).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Registre, classement, annuaire : consultation et téléchargements
// ---------------------------------------------------------------------------
async function registre(req, res) {
  const fiches = await fichesTutelle();
  if (req.query.format === 'pdf') return envoyerFichier(res, await docs.registrePDF(fiches, req.utilisateur), 'registre-national', 'pdf');
  if (req.query.format === 'xlsx') return envoyerFichier(res, xlsx(docs.lignesRegistre(fiches), 'Registre national'), 'registre-national', 'xlsx');
  return res.json({ etablissements: fiches });
}

async function classement(req, res) {
  const critere = docs.CRITERES[req.query.critere] ? req.query.critere : 'reussite';
  const fiches = await fichesTutelle();
  if (req.query.format === 'pdf') return envoyerFichier(res, await docs.classementPDF(fiches, critere, req.utilisateur), `classement-${critere}`, 'pdf');
  const classes = docs.classer(fiches, critere);
  if (req.query.format === 'xlsx') return envoyerFichier(res, xlsx(docs.lignesClassement(classes), 'Classement'), `classement-${critere}`, 'xlsx');
  return res.json({ critere, classement: classes });
}

async function annuaire(req, res) {
  const { fiches } = await donneesNationales();
  const effectifs = await lireNational('SELECT * FROM vue_ministere_effectifs');
  const habilitations = await HabilitationFormation.findAll({ attributes: ['cycle', 'statut'] });
  const a = docs.annuaire(fiches, effectifs, habilitations);
  if (req.query.format === 'pdf') return envoyerFichier(res, await docs.annuairePDF(a, req.utilisateur), 'annuaire-statistique', 'pdf');
  if (req.query.format === 'xlsx') return envoyerFichier(res, docs.annuaireXlsx(a), 'annuaire-statistique', 'xlsx');
  return res.json(a);
}

// ---------------------------------------------------------------------------
// Habilitations des formations
// ---------------------------------------------------------------------------
async function listerHabilitations(req, res) {
  const where = {};
  if (req.query.etablissementId) where.etablissementId = Number(req.query.etablissementId);
  const habilitations = await HabilitationFormation.findAll({ where, include: [{ model: Etablissement, attributes: ['id', 'nom', 'sigle', 'province'] }], order: [['dateDebut', 'DESC']] });
  return res.json({ habilitations });
}

function controlerHabilitation(b) {
  if (!['licence', 'master', 'doctorat'].includes(b.cycle)) return 'cycle invalide';
  if (!String(b.domaine || '').trim() || !String(b.mention || '').trim()) return 'le domaine et la mention sont obligatoires';
  if (!dateValide(b.dateDebut)) return 'date de début invalide';
  if (b.dateFin && (!dateValide(b.dateFin) || b.dateFin <= b.dateDebut)) return 'la date de fin doit suivre la date de début';
  if (b.statut && !['habilitee', 'en_renouvellement', 'suspendue', 'retiree'].includes(b.statut)) return 'statut invalide';
  return null;
}

async function creerHabilitation(req, res) {
  const b = req.body || {};
  const etablissement = await Etablissement.findByPk(b.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  const erreur = controlerHabilitation(b);
  if (erreur) return res.status(400).json({ erreur });
  const habilitation = await HabilitationFormation.create({
    etablissementId: etablissement.id, cycle: b.cycle, domaine: texte(b.domaine, 160), mention: texte(b.mention, 160), specialite: texte(b.specialite, 160),
    numeroArrete: texte(b.numeroArrete, 80), dateDebut: b.dateDebut, dateFin: b.dateFin || null, statut: b.statut || 'habilitee',
    observations: texte(b.observations, 2000), decideParNom: nomAgent(req.utilisateur),
  });
  await prevenirAcademie(etablissement.id, `Ministère : formation habilitée, ${docs.LIBELLES_CYCLE[b.cycle]} ${habilitation.mention}${habilitation.numeroArrete ? ` (arrêté ${habilitation.numeroArrete})` : ''}.`);
  await journaliserAudit(req, { action: 'habilitation_formation', cible: etablissement.nom, details: { cycle: b.cycle, mention: habilitation.mention }, etablissementId: etablissement.id });
  return res.status(201).json({ habilitation });
}

async function modifierHabilitation(req, res) {
  const habilitation = await HabilitationFormation.findByPk(req.params.id);
  if (!habilitation) return res.status(404).json({ erreur: 'habilitation introuvable' });
  const b = { ...habilitation.toJSON(), ...req.body };
  const erreur = controlerHabilitation(b);
  if (erreur) return res.status(400).json({ erreur });
  const avant = habilitation.statut;
  await habilitation.update({
    cycle: b.cycle, domaine: texte(b.domaine, 160), mention: texte(b.mention, 160), specialite: texte(b.specialite, 160), numeroArrete: texte(b.numeroArrete, 80),
    dateDebut: b.dateDebut, dateFin: b.dateFin || null, statut: b.statut, observations: texte(b.observations, 2000), decideParNom: nomAgent(req.utilisateur),
  });
  if (avant !== habilitation.statut) {
    await prevenirAcademie(habilitation.etablissementId, `Ministère : formation ${habilitation.mention} désormais « ${docs.LIBELLES_HABILITATION[habilitation.statut]} ».`);
  }
  await journaliserAudit(req, { action: 'habilitation_modifiee', cible: habilitation.mention, details: { statut: habilitation.statut }, etablissementId: habilitation.etablissementId });
  return res.json({ habilitation });
}

// ---------------------------------------------------------------------------
// Inspections et recommandations
// ---------------------------------------------------------------------------
async function listerInspections(req, res) {
  const where = {};
  if (req.query.etablissementId) where.etablissementId = Number(req.query.etablissementId);
  const inspections = await Inspection.findAll({
    where, include: [{ model: Etablissement, attributes: ['id', 'nom', 'sigle', 'province'] }, { model: RecommandationInspection }],
    order: [['datePrevue', 'DESC']],
  });
  return res.json({ inspections });
}

async function programmerInspection(req, res) {
  const b = req.body || {};
  const etablissement = await Etablissement.findByPk(b.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  if (!Object.keys(docs.LIBELLES_NATURE).includes(b.nature)) return res.status(400).json({ erreur: 'nature de mission invalide' });
  if (String(b.objet || '').trim().length < 10) return res.status(400).json({ erreur: "précisez l'objet de la mission (10 caractères au moins)" });
  if (!String(b.inspecteurs || '').trim()) return res.status(400).json({ erreur: 'indiquez les inspecteurs' });
  if (!dateValide(b.datePrevue)) return res.status(400).json({ erreur: 'date de la mission invalide' });
  const annee = new Date().getFullYear();
  const n = await Inspection.count({ where: { reference: { [Op.like]: `INSP/${annee}/%` } } });
  const inspection = await Inspection.create({
    reference: `INSP/${annee}/${String(n + 1).padStart(3, '0')}`, etablissementId: etablissement.id, nature: b.nature,
    objet: texte(b.objet, 300), inspecteurs: texte(b.inspecteurs, 300), datePrevue: b.datePrevue, creeParNom: nomAgent(req.utilisateur),
  });
  await prevenirAcademie(etablissement.id, `Ministère : mission d'inspection ${docs.LIBELLES_NATURE[b.nature].toLowerCase()} programmée le ${new Date(b.datePrevue).toLocaleDateString('fr-FR')} (${inspection.reference}).`);
  await journaliserAudit(req, { action: 'inspection_programmee', cible: etablissement.nom, details: { reference: inspection.reference }, etablissementId: etablissement.id });
  return res.status(201).json({ inspection });
}

// Compte rendu : constats, avis, recommandations (remplacées en bloc tant
// que la mission n'est pas clôturée), ou annulation.
async function rendreInspection(req, res) {
  const inspection = await Inspection.findByPk(req.params.id, { include: [RecommandationInspection] });
  if (!inspection) return res.status(404).json({ erreur: 'inspection introuvable' });
  if (inspection.statut === 'cloturee') return res.status(409).json({ erreur: 'mission clôturée, plus modifiable' });
  const b = req.body || {};
  if (b.statut === 'annulee') {
    await inspection.update({ statut: 'annulee' });
    return res.json({ inspection });
  }
  if (!dateValide(b.dateRealisee)) return res.status(400).json({ erreur: 'date de réalisation invalide' });
  if (String(b.constats || '').trim().length < 20) return res.status(400).json({ erreur: 'consignez les constats (20 caractères au moins)' });
  if (!Object.keys(docs.LIBELLES_AVIS).includes(b.avis)) return res.status(400).json({ erreur: 'avis invalide' });
  const recommandations = (Array.isArray(b.recommandations) ? b.recommandations : [])
    .map((r) => ({ texte: texte(r.texte, 1000), echeance: dateValide(r.echeance) ? r.echeance : null })).filter((r) => r.texte);
  await inspection.update({ dateRealisee: b.dateRealisee, constats: String(b.constats).trim(), avis: b.avis, statut: 'realisee' });
  // Les recommandations déjà traitées par l'établissement sont conservées.
  await RecommandationInspection.destroy({ where: { inspectionId: inspection.id, reponse: null } });
  await RecommandationInspection.bulkCreate(recommandations.map((r) => ({ ...r, inspectionId: inspection.id, etablissementId: inspection.etablissementId })));
  await prevenirAcademie(inspection.etablissementId, `Ministère : rapport d'inspection ${inspection.reference} rendu (avis ${docs.LIBELLES_AVIS[b.avis].toLowerCase()}), ${recommandations.length} recommandation(s) à mettre en œuvre.`);
  await journaliserAudit(req, { action: 'inspection_rendue', cible: inspection.reference, details: { avis: b.avis, recommandations: recommandations.length }, etablissementId: inspection.etablissementId });
  return res.json({ inspection: await Inspection.findByPk(inspection.id, { include: [RecommandationInspection] }) });
}

async function cloturerInspection(req, res) {
  const inspection = await Inspection.findByPk(req.params.id);
  if (!inspection || inspection.statut !== 'realisee') return res.status(409).json({ erreur: 'seule une mission réalisée peut être clôturée' });
  await inspection.update({ statut: 'cloturee' });
  await journaliserAudit(req, { action: 'inspection_cloturee', cible: inspection.reference, etablissementId: inspection.etablissementId });
  return res.json({ inspection });
}

async function suivreRecommandation(req, res) {
  const reco = await RecommandationInspection.findByPk(req.params.id);
  if (!reco) return res.status(404).json({ erreur: 'recommandation introuvable' });
  if (!['a_faire', 'en_cours', 'realisee'].includes(req.body?.statut)) return res.status(400).json({ erreur: 'statut invalide' });
  await reco.update({ statut: req.body.statut });
  return res.json({ recommandation: reco });
}

async function rapportInspection(req, res) {
  const inspection = await Inspection.findByPk(req.params.id, { include: [RecommandationInspection] });
  const autorise = inspection && (req.utilisateur.role === 'ministere' || inspection.etablissementId === req.utilisateur.etablissementId);
  if (!autorise || !inspection.dateRealisee) return res.status(404).json({ erreur: 'rapport indisponible' });
  const etablissement = await Etablissement.findByPk(inspection.etablissementId);
  const pdf = await docs.rapportInspectionPDF(inspection, etablissement, inspection.RecommandationInspections, req.utilisateur);
  return envoyerFichier(res, pdf, `rapport-inspection-${inspection.reference.replace(/\//g, '-')}`, 'pdf');
}

// ---------------------------------------------------------------------------
// Calendrier universitaire national
// ---------------------------------------------------------------------------
async function calendrier(req, res) {
  const annee = /^\d{4}-\d{4}$/.test(req.query.annee || '') ? req.query.annee : anneeCourante();
  const evenements = await EvenementCalendrier.findAll({ where: { anneeUniversitaire: annee }, order: [['dateDebut', 'ASC']] });
  const accuses = await AccuseCalendrier.findAll({ where: { anneeUniversitaire: annee } });
  const etablissements = await Etablissement.findAll({ attributes: ['id', 'nom', 'province'], order: [['nom', 'ASC']] });
  const parEtab = new Map(accuses.map((a) => [a.etablissementId, a]));
  return res.json({
    annee, evenements,
    publie: evenements.some((e) => e.publieLe),
    accuses: etablissements.map((e) => ({ id: e.id, nom: e.nom, province: e.province, accuseLe: parEtab.get(e.id)?.accuseLe || null, accuseParNom: parEtab.get(e.id)?.accuseParNom || null })),
  });
}

async function ajouterEvenement(req, res) {
  const b = req.body || {};
  if (!/^\d{4}-\d{4}$/.test(b.anneeUniversitaire || '')) return res.status(400).json({ erreur: 'année universitaire invalide (ex. 2026-2027)' });
  if (!NATURES_CAL.includes(b.nature)) return res.status(400).json({ erreur: 'nature invalide' });
  if (String(b.libelle || '').trim().length < 3) return res.status(400).json({ erreur: 'libellé trop court' });
  if (!dateValide(b.dateDebut) || (b.dateFin && (!dateValide(b.dateFin) || b.dateFin < b.dateDebut))) return res.status(400).json({ erreur: 'dates invalides' });
  const evenement = await EvenementCalendrier.create({ anneeUniversitaire: b.anneeUniversitaire, nature: b.nature, libelle: texte(b.libelle, 200), dateDebut: b.dateDebut, dateFin: b.dateFin || null });
  return res.status(201).json({ evenement });
}

async function retirerEvenement(req, res) {
  const evenement = await EvenementCalendrier.findByPk(req.params.id);
  if (!evenement) return res.status(404).json({ erreur: 'période introuvable' });
  await evenement.destroy();
  return res.json({ ok: true });
}

// Publication (ou republication après modification) : tous les
// établissements sont prévenus et doivent accuser réception à nouveau.
async function publierCalendrier(req, res) {
  const annee = req.body?.anneeUniversitaire;
  const evenements = await EvenementCalendrier.findAll({ where: { anneeUniversitaire: annee } });
  if (!evenements.length) return res.status(400).json({ erreur: 'ajoutez au moins une période avant de publier' });
  await EvenementCalendrier.update({ publieLe: new Date() }, { where: { anneeUniversitaire: annee } });
  await AccuseCalendrier.destroy({ where: { anneeUniversitaire: annee } });
  const academies = await Utilisateur.findAll({ where: { role: 'academie' }, attributes: ['id'] });
  await Notification.bulkCreate(academies.map((u) => ({ utilisateurId: u.id, dateEnvoi: new Date(), contenu: `Ministère : calendrier universitaire national ${annee} publié. Merci d'en accuser réception.` }))).catch(() => {});
  await journaliserAudit(req, { action: 'calendrier_publie', cible: annee, details: { periodes: evenements.length } });
  return res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Côté établissement (Académie)
// ---------------------------------------------------------------------------
async function tutelleEtablissement(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const annee = anneeCourante();
  const [habilitations, inspections, evenements, accuse] = await Promise.all([
    HabilitationFormation.findAll({ where: { etablissementId }, order: [['cycle', 'ASC'], ['mention', 'ASC']] }),
    Inspection.findAll({ where: { etablissementId, statut: { [Op.ne]: 'annulee' } }, include: [RecommandationInspection], order: [['datePrevue', 'DESC']] }),
    EvenementCalendrier.findAll({ where: { anneeUniversitaire: annee, publieLe: { [Op.ne]: null } }, order: [['dateDebut', 'ASC']] }),
    AccuseCalendrier.findOne({ where: { etablissementId, anneeUniversitaire: annee } }),
  ]);
  return res.json({ annee, habilitations, inspections, calendrier: { evenements, accuseLe: accuse?.accuseLe || null } });
}

async function repondreRecommandation(req, res) {
  const reco = await RecommandationInspection.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!reco) return res.status(404).json({ erreur: 'recommandation introuvable' });
  const reponse = String(req.body?.reponse || '').trim();
  if (reponse.length < 10) return res.status(400).json({ erreur: 'décrivez les mesures prises (10 caractères au moins)' });
  const statut = ['en_cours', 'realisee'].includes(req.body?.statut) ? req.body.statut : 'en_cours';
  await reco.update({ reponse: reponse.slice(0, 2000), statut, reponduLe: new Date(), reponduParNom: nomAgent(req.utilisateur) });
  await journaliserAudit(req, { action: 'recommandation_repondue', cible: `recommandation ${reco.id}`, details: { statut } });
  return res.json({ recommandation: reco });
}

async function accuserCalendrier(req, res) {
  const annee = anneeCourante();
  if (!(await EvenementCalendrier.count({ where: { anneeUniversitaire: annee, publieLe: { [Op.ne]: null } } }))) return res.status(404).json({ erreur: 'aucun calendrier publié' });
  const [accuse] = await AccuseCalendrier.findOrCreate({
    where: { etablissementId: req.utilisateur.etablissementId, anneeUniversitaire: annee },
    defaults: { accuseLe: new Date(), accuseParNom: nomAgent(req.utilisateur) },
  });
  return res.json({ accuseLe: accuse.accuseLe });
}

module.exports = {
  registre, classement, annuaire, listerHabilitations, creerHabilitation, modifierHabilitation,
  listerInspections, programmerInspection, rendreInspection, cloturerInspection, suivreRecommandation, rapportInspection,
  calendrier, ajouterEvenement, retirerEvenement, publierCalendrier,
  tutelleEtablissement, repondreRecommandation, accuserCalendrier, anneeCourante,
};
