const { Op } = require('sequelize');

// Paramétrage d'un établissement, partagé entre l'Académie (ses propres
// réglages) et le superadmin (assistant de création et fiche de l'école).

const CYCLE_LABEL = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const SEMESTRES_PAR_CYCLE = { licence: 6, master: 4, doctorat: 6 };
const CREDITS_PAR_CYCLE = { licence: 180, master: 120, doctorat: 180 };
const NIVEAUX_PAR_CYCLE = { licence: ['Licence 1', 'Licence 2', 'Licence 3'], master: ['Master 1', 'Master 2'], doctorat: ['Doctorat'] };

const erreur = (message, status = 400) => Object.assign(new Error(message), { status });
const nombre = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));
const actif = (v) => v === true || v === 'true';

// Règles de validation : seuil, note éliminatoire, compensation et passage
// avec dette. Les valeurs absentes gardent celles de l'école.
function validerRegles(corps, actuel) {
  const seuil = corps.seuilValidation === undefined ? actuel.seuilValidation : nombre(corps.seuilValidation);
  const eliminatoire = corps.noteEliminatoire === undefined ? actuel.noteEliminatoire : nombre(corps.noteEliminatoire);
  if (!Number.isFinite(seuil) || seuil <= 0 || seuil > 20) throw erreur('le seuil de validation doit être compris entre 0 et 20');
  if (!Number.isFinite(eliminatoire) || eliminatoire < 0 || eliminatoire >= seuil) throw erreur('la note éliminatoire doit être positive et inférieure au seuil de validation');
  const compensationActive = corps.compensationActive === undefined ? actuel.compensationActive : actif(corps.compensationActive);
  const noteMinCompensation = corps.noteMinCompensation === undefined ? actuel.noteMinCompensation : nombre(corps.noteMinCompensation);
  const passageDetteActif = corps.passageDetteActif === undefined ? actuel.passageDetteActif : actif(corps.passageDetteActif);
  const creditsMinPassagePct = corps.creditsMinPassagePct === undefined ? actuel.creditsMinPassagePct : nombre(corps.creditsMinPassagePct);
  if (compensationActive && (noteMinCompensation === null || !Number.isFinite(noteMinCompensation) || noteMinCompensation < eliminatoire || noteMinCompensation >= seuil)) {
    throw erreur('la note minimale de compensation doit être comprise entre la note éliminatoire et le seuil de validation');
  }
  if (passageDetteActif && (creditsMinPassagePct === null || !Number.isFinite(creditsMinPassagePct) || creditsMinPassagePct <= 0 || creditsMinPassagePct >= 100)) {
    throw erreur('la part de crédits exigée pour un passage avec dette doit être comprise entre 1 et 99 %');
  }
  return { seuilValidation: seuil, noteEliminatoire: eliminatoire, compensationActive, noteMinCompensation, passageDetteActif, creditsMinPassagePct };
}

// Quotas et abonnement fixés par le superadmin.
function validerAbonnement(corps) {
  const entier = (v, nomChamp) => {
    const n = nombre(v);
    if (n === null) return null;
    if (!Number.isInteger(n) || n < 1) throw erreur(`${nomChamp} doit être un nombre entier positif, ou vide pour ne pas limiter`);
    return n;
  };
  const champs = {};
  if (corps.quotaEtudiants !== undefined) champs.quotaEtudiants = entier(corps.quotaEtudiants, "le nombre maximal d'étudiants");
  if (corps.quotaPersonnel !== undefined) champs.quotaPersonnel = entier(corps.quotaPersonnel, 'le nombre maximal de comptes du personnel');
  if (corps.abonnementOffre !== undefined) champs.abonnementOffre = String(corps.abonnementOffre || '').trim().slice(0, 80) || null;
  if (corps.abonnementFin !== undefined) {
    const v = String(corps.abonnementFin || '').trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw erreur("la date de fin d'abonnement est invalide");
    champs.abonnementFin = v || null;
  }
  return champs;
}

function abonnementExpire(etablissement) {
  if (!etablissement?.abonnementFin) return false;
  return String(etablissement.abonnementFin) < new Date().toISOString().slice(0, 10);
}

async function verifierQuotaEtudiants(etablissementId, aAjouter = 1) {
  const { Etablissement, Eleve } = require('../models');
  const e = await Etablissement.findByPk(etablissementId, { attributes: ['quotaEtudiants'] });
  if (!e?.quotaEtudiants) return;
  const n = await Eleve.count({ where: { etablissementId } });
  if (n + aAjouter > e.quotaEtudiants) throw erreur(`le nombre maximal d’étudiants prévu par l’abonnement est atteint (${e.quotaEtudiants}) : contactez l’éditeur pour l’augmenter`, 403);
}

async function verifierQuotaPersonnel(etablissementId) {
  const { Etablissement, Utilisateur } = require('../models');
  const e = await Etablissement.findByPk(etablissementId, { attributes: ['quotaPersonnel'] });
  if (!e?.quotaPersonnel) return;
  const n = await Utilisateur.count({ where: { etablissementId, role: { [Op.in]: ['academie', 'finance'] } } });
  if (n + 1 > e.quotaPersonnel) throw erreur(`le nombre maximal de comptes du personnel est atteint (${e.quotaPersonnel})`, 403);
}

// Maquette LMD : une formation, les semestres du cycle pour l'année et, si
// demandé, une classe par niveau rattachée à la formation. Rien n'est créé
// en double : un semestre ou une classe déjà présents sont réutilisés.
async function creerMaquette(etablissementId, corps) {
  const { Formation, Semestre, Classe, Etablissement } = require('../models');
  const cycle = ['licence', 'master', 'doctorat'].includes(corps.cycle) ? corps.cycle : null;
  if (!cycle) throw erreur('choisissez le cycle : licence, master ou doctorat');
  const anneeScolaire = String(corps.anneeScolaire || '').trim();
  if (!/^\d{4}-\d{4}$/.test(anneeScolaire)) throw erreur("l'année universitaire doit être au format 2026-2027");
  const mention = String(corps.mention || '').trim();
  if (!mention) throw erreur('indiquez la mention de la formation');
  const parcours = String(corps.parcours || '').trim() || null;
  const etablissement = await Etablissement.findByPk(etablissementId, { attributes: ['sigle'] });

  let formation = await Formation.findOne({ where: { etablissementId, cycle, mention, parcours } });
  if (!formation) {
    formation = await Formation.create({
      etablissementId, cycle, mention, parcours, domaine: String(corps.domaine || '').trim() || null,
      creditsRequis: nombre(corps.creditsRequis) || CREDITS_PAR_CYCLE[cycle],
    });
  }
  const semestres = [];
  for (let numero = 1; numero <= SEMESTRES_PAR_CYCLE[cycle]; numero += 1) {
    const [s] = await Semestre.findOrCreate({
      where: { etablissementId, cycle, numero, anneeScolaire },
      defaults: { libelle: `${CYCLE_LABEL[cycle]}, Semestre ${numero}` },
    });
    semestres.push(s);
  }
  const classes = [];
  if (corps.avecClasses !== false && corps.avecClasses !== 'false') {
    const prefixe = [mention, parcours].filter(Boolean).join(' ');
    for (const niveau of NIVEAUX_PAR_CYCLE[cycle]) {
      const court = niveau.replace(/^Licence /, 'L').replace(/^Master /, 'M');
      const nom = `${court} ${prefixe}`.trim();
      let classe = await Classe.findOne({ where: { etablissementId, nom, niveau } });
      if (!classe) classe = await Classe.create({ etablissementId, nom, niveau, formationId: formation.id });
      else if (!classe.formationId) await classe.update({ formationId: formation.id });
      classes.push(classe);
    }
  }
  return { formation, semestres, classes, sigle: etablissement?.sigle || null };
}

// UE et matières d'un semestre, une ligne par matière (même format que
// l'import de l'Académie). Une UE déjà présente est complétée.
async function importerStructure(etablissementId, { semestreId, formationId, lignes }) {
  const { Semestre, UniteEnseignement, Matiere, Formation } = require('../models');
  const semestre = await Semestre.findOne({ where: { id: semestreId, etablissementId } });
  if (!semestre) throw erreur('semestre introuvable', 404);
  let fId = null;
  if (formationId) {
    const f = await Formation.findOne({ where: { id: formationId, etablissementId } });
    if (!f) throw erreur('formation introuvable');
    fId = f.id;
  }
  if (!Array.isArray(lignes) || !lignes.length) throw erreur('le fichier ne contient aucune ligne');
  let uesCreees = 0;
  let matieresCreees = 0;
  const erreurs = [];
  for (const [i, l] of lignes.entries()) {
    const codeUE = String(l.codeUE || '').trim();
    const intituleUE = String(l.intituleUE || '').trim();
    const credits = Number(l.credits);
    const codeMatiere = String(l.codeMatiere || '').trim();
    const intituleMatiere = String(l.matiere || '').trim();
    const coefficient = Number(String(l.coefficient ?? 1).replace(',', '.')) || 1;
    if (!codeUE || !intituleUE || !Number.isInteger(credits) || credits < 1 || !codeMatiere || !intituleMatiere) {
      erreurs.push(`ligne ${i + 2} incomplète`);
      continue;
    }
    let ue = await UniteEnseignement.findOne({ where: { semestreId: semestre.id, code: codeUE, formationId: fId } });
    if (!ue) {
      ue = await UniteEnseignement.create({ semestreId: semestre.id, formationId: fId, code: codeUE, intitule: intituleUE, credits, coefficient: credits });
      uesCreees += 1;
    }
    const existe = await Matiere.findOne({ where: { uniteEnseignementId: ue.id, code: codeMatiere } });
    if (!existe) {
      await Matiere.create({ uniteEnseignementId: ue.id, code: codeMatiere, intitule: intituleMatiere, coefficient });
      matieresCreees += 1;
    }
  }
  return { uesCreees, matieresCreees, erreurs };
}

module.exports = {
  CYCLE_LABEL, validerRegles, validerAbonnement, abonnementExpire, verifierQuotaEtudiants, verifierQuotaPersonnel, creerMaquette, importerStructure,
};
