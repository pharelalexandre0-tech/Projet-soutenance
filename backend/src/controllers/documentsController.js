const { Op } = require('sequelize');
const { Classe, Semestre, Eleve, Absence, EmploiDuTemps, UniteEnseignement, Matiere } = require('../models');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { calculerBulletinsClasse, reglesEtablissement } = require('../services/moyenneService');
const docs = require('../services/documentsAcademieService');

// Téléchargements de l'Académie : listes de présence, récapitulatif des
// présences, procès-verbal des résultats, emplois du temps. Toujours limités
// à l'école du compte connecté.

const TYPES = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

function envoyer(res, contenu, nom, format) {
  res.set({
    'Content-Type': TYPES[format],
    'Content-Disposition': `attachment; filename="${nom}.${format}"`,
    'Content-Length': contenu.length,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  return res.send(contenu);
}

const propre = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
const aujourdhui = () => new Date().toISOString().slice(0, 10);

// Une classe de l'école, ou toutes (« toutes »), avec leurs élèves.
async function classesDemandees(req) {
  const etablissementId = req.utilisateur.etablissementId;
  const { classeId } = req.query;
  const where = classeId === 'toutes' ? { etablissementId } : { id: classeId, etablissementId };
  const classes = await Classe.findAll({ where, order: [['niveau', 'ASC'], ['nom', 'ASC']] });
  const eleves = await Eleve.findAll({ where: { classeId: classes.map((c) => c.id) }, order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  return classes.map((classe) => ({ classe, eleves: eleves.filter((e) => e.classeId === classe.id) }));
}

async function semestreDeLEcole(req) {
  const semestre = await Semestre.findByPk(req.query.semestreId);
  return semestre && semestre.etablissementId === req.utilisateur.etablissementId ? semestre : null;
}

async function listePresence(req, res) {
  const classes = await classesDemandees(req);
  if (!classes.length) return res.status(404).json({ erreur: 'classe introuvable' });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const { date, cours, enseignant } = req.query;
  const pdf = await docs.listePresencePDF({ etablissement, classes, date: date || null, cours, enseignant });
  const nom = classes.length > 1 ? 'toutes-les-classes' : propre(classes[0].classe.nom);
  return envoyer(res, pdf, `liste-de-presence-${nom}-${date || aujourdhui()}`, 'pdf');
}

async function recapitulatifPresences(req, res) {
  const [premiere] = await classesDemandees(req);
  if (!premiere || req.query.classeId === 'toutes') return res.status(404).json({ erreur: 'classe introuvable' });
  const { du, au } = req.query;
  const date = {};
  if (du) date[Op.gte] = du;
  if (au) date[Op.lte] = au;
  const absences = await Absence.findAll({
    where: { eleveId: premiere.eleves.map((e) => e.id), ...(du || au ? { date } : {}) },
    order: [['date', 'ASC']], raw: true,
  });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const format = req.query.format === 'xlsx' ? 'xlsx' : 'pdf';
  const donnees = { etablissement, classe: premiere.classe, eleves: premiere.eleves, absences, du, au };
  const contenu = format === 'xlsx' ? docs.recapitulatifPresencesXlsx(donnees) : await docs.recapitulatifPresencesPDF(donnees);
  return envoyer(res, contenu, `recapitulatif-presences-${propre(premiere.classe.nom)}-${aujourdhui()}`, format);
}

async function resultats(req, res) {
  const [premiere] = await classesDemandees(req);
  const semestre = await semestreDeLEcole(req);
  if (!premiere || req.query.classeId === 'toutes' || !semestre) return res.status(404).json({ erreur: 'classe ou semestre introuvable' });
  let ues = await UniteEnseignement.findAll({ where: { semestreId: semestre.id }, include: [Matiere], order: [['code', 'ASC']] });
  const calculs = await calculerBulletinsClasse(premiere.eleves.map((e) => e.id), semestre.id);
  // Les UE appartiennent au semestre, pas à la classe : seules celles où la
  // classe a des notes entrent dans le procès-verbal (toutes si aucune).
  const notees = new Set([...calculs.values()].flatMap((c) => c.detailParUE.map((d) => d.code)));
  if (notees.size) ues = ues.filter((u) => notees.has(u.code));
  const regles = await reglesEtablissement(req.utilisateur.etablissementId);
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const format = req.query.format === 'xlsx' ? 'xlsx' : 'pdf';
  const donnees = { etablissement, classe: premiere.classe, semestre, ues, eleves: premiere.eleves, calculs, regles, ordre: req.query.ordre === 'alphabetique' ? 'alphabetique' : 'merite' };
  const contenu = format === 'xlsx' ? docs.procesVerbalXlsx(donnees) : await docs.procesVerbalPDF(donnees);
  return envoyer(res, contenu, `resultats-${propre(premiere.classe.nom)}-${propre(semestre.libelle)}`, format);
}

async function emploisDuTemps(req, res) {
  const classes = await classesDemandees(req);
  const semestre = await semestreDeLEcole(req);
  if (!classes.length || !semestre) return res.status(404).json({ erreur: 'classe ou semestre introuvable' });
  const creneaux = await EmploiDuTemps.findAll({
    where: { classeId: classes.map((c) => c.classe.id) },
    order: [['jour', 'ASC'], ['heureDebut', 'ASC']], raw: true,
  });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const pages = classes.map(({ classe }) => ({ classe, creneaux: creneaux.filter((c) => c.classeId === classe.id && (!c.semestreId || c.semestreId === semestre.id)) }));
  const pdf = await docs.emploisDuTempsPDF({ etablissement, semestre, pages });
  const nom = classes.length > 1 ? 'toutes-les-classes' : propre(classes[0].classe.nom);
  return envoyer(res, pdf, `emploi-du-temps-${nom}-${propre(semestre.libelle)}`, 'pdf');
}

module.exports = { listePresence, recapitulatifPresences, resultats, emploisDuTemps };
