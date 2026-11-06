const { Op } = require('sequelize');
const { Classe, Semestre, Eleve, ParcoursEleve, UniteEnseignement, Note, Matiere } = require('../models');
const { calculerBulletin, calculerBulletinsClasse, calculerParcours, clesUE } = require('../services/moyenneService');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { journaliserAudit } = require('../services/auditService');
const { attestationPDF, relevePDF } = require('../services/documentsOfficielsService');

// Scolarité : attestations et relevé officiel (Académie et étudiant),
// passage en année supérieure (Académie).
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

function envoyerPdf(res, pdf, nom) {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nom}.pdf"`, 'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'private, no-store' });
  return res.send(pdf);
}

// L'étudiant (ou son parent) ne demande que son propre dossier ; l'Académie
// tout étudiant de son école.
async function eleveAutorise(req) {
  const where = req.utilisateur.role === 'etudiant'
    ? { compteEtudiantId: req.utilisateur.id }
    : { id: Number(req.query.eleveId), etablissementId: req.utilisateur.etablissementId };
  const eleve = await Eleve.findOne({ where, include: [Classe] });
  if (!eleve) {
    const err = new Error('étudiant introuvable');
    err.status = 404;
    throw err;
  }
  return eleve;
}

// Semestres où l'étudiant a au moins une note, dans l'ordre.
async function semestresNotes(eleve) {
  const notes = await Note.findAll({ where: { eleveId: eleve.id }, attributes: ['matiereId'], include: [{ model: Matiere, attributes: ['id'], include: [{ model: UniteEnseignement, attributes: ['semestreId'] }] }] });
  const ids = [...new Set(notes.map((n) => n.Matiere?.UniteEnseignement?.semestreId).filter(Boolean))];
  return Semestre.findAll({ where: { id: ids }, order: [['anneeScolaire', 'ASC'], ['numero', 'ASC']] });
}

async function anneeCourante(etablissementId) {
  const dernier = await Semestre.findOne({ where: { etablissementId }, order: [['anneeScolaire', 'DESC'], ['numero', 'DESC']] });
  return dernier?.anneeScolaire || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
}

async function attestation(req, res) {
  const eleve = await eleveAutorise(req);
  const type = ['scolarite', 'inscription', 'reussite'].includes(req.query.type) ? req.query.type : 'scolarite';
  if (!eleve.Classe) return res.status(400).json({ erreur: "l'étudiant n'est inscrit dans aucune classe" });
  const etablissement = await obtenirEtablissementDe(eleve.etablissementId);
  let semestre = null;
  let resultat = null;
  if (type === 'reussite') {
    semestre = await Semestre.findOne({ where: { id: req.query.semestreId, etablissementId: eleve.etablissementId } });
    if (!semestre) return res.status(400).json({ erreur: 'choisissez le semestre validé' });
    resultat = await calculerBulletin(eleve.id, semestre.id);
    if (!resultat.detailParUE.length || !resultat.admis) return res.status(400).json({ erreur: "ce semestre n'est pas validé : l'attestation de réussite ne peut pas être délivrée" });
  }
  const anneeScolaire = semestre?.anneeScolaire || await anneeCourante(eleve.etablissementId);
  const pdf = await attestationPDF({ etablissement, eleve, classe: eleve.Classe, type, semestre, resultat, anneeScolaire, emisParId: req.utilisateur.id });
  return envoyerPdf(res, pdf, `attestation-${type}-${eleve.matricule || eleve.id}`);
}

async function releve(req, res) {
  const eleve = await eleveAutorise(req);
  const etablissement = await obtenirEtablissementDe(eleve.etablissementId);
  const semestres = [];
  for (const semestre of await semestresNotes(eleve)) semestres.push({ semestre, calcul: await calculerBulletin(eleve.id, semestre.id) });
  const cumul = await calculerParcours(eleve.id);
  const pdf = await relevePDF({ etablissement, eleve, classe: eleve.Classe, semestres, cumul, emisParId: req.utilisateur.id });
  return envoyerPdf(res, pdf, `releve-de-notes-${eleve.matricule || eleve.id}`);
}

// Semestres validés de l'étudiant (pour proposer l'attestation de réussite).
async function semestresValides(req, res) {
  const eleve = await eleveAutorise(req);
  const liste = [];
  for (const semestre of await semestresNotes(eleve)) {
    const c = await calculerBulletin(eleve.id, semestre.id);
    liste.push({ id: semestre.id, libelle: semestre.libelle, anneeScolaire: semestre.anneeScolaire, valide: c.detailParUE.length > 0 && c.admis, moyenne: c.moyenneGenerale });
  }
  return res.json({ semestres: liste });
}

// ---------------------------------------------------------------------------
// Passage en année supérieure
// ---------------------------------------------------------------------------

// Parcours LMD de l'étudiant : crédits cumulés, UE acquises et UE à repasser.
function sansCles({ cles, ...ligne }) { return ligne; }
async function parcours(req, res) {
  const eleve = await eleveAutorise(req);
  const p = await calculerParcours(eleve.id);
  return res.json({ ...p, dettes: p.dettes.map(sansCles), semestres: p.semestres.map((s) => ({ ...s, ues: s.ues.map(sansCles) })) });
}

// Étudiants passés avec dette dans une autre classe et qui doivent encore
// cette UE : ajoutés à la saisie des notes de la classe qui la suit.
async function dettesUE(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const ue = await UniteEnseignement.findByPk(req.query.ueId, { include: [Semestre] });
  if (!ue || ue.Semestre?.etablissementId !== etablissementId) return res.status(404).json({ erreur: 'unité d’enseignement introuvable' });
  const lignes = await ParcoursEleve.findAll({ where: { etablissementId, decision: 'passage_dette' }, attributes: ['eleveId'] });
  const ids = [...new Set(lignes.map((l) => l.eleveId))];
  if (!ids.length) return res.json({ eleves: [] });
  const where = { id: ids, etablissementId };
  if (req.query.classeId) where.classeId = { [Op.ne]: Number(req.query.classeId) };
  const eleves = await Eleve.findAll({ where, include: [Classe], order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  const cles = clesUE(ue.Semestre, ue.code, ue.intitule);
  const cache = {};
  const resultat = [];
  for (const e of eleves) {
    const p = await calculerParcours(e.id, cache);
    if (p.dettes.some((d) => d.cles.some((c) => cles.includes(c)))) {
      resultat.push({ id: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule, classeId: e.classeId, classeNom: e.Classe?.nom || '', dette: true });
    }
  }
  return res.json({ eleves: resultat });
}

// Proposition pour une classe : chaque étudiant, ses semestres de l'année et
// la décision annuelle, modifiable avant validation. Passage si tout est
// acquis ; passage avec dette si l'école l'autorise et que l'étudiant atteint
// sa part minimale de crédits de l'année ; sinon redoublement.
async function propositionPassage(req, res) {
  const classe = await Classe.findOne({ where: { id: req.params.classeId, etablissementId: req.utilisateur.etablissementId } });
  if (!classe) return res.status(404).json({ erreur: 'classe introuvable' });
  const annee = req.query.anneeScolaire || await anneeCourante(req.utilisateur.etablissementId);
  const semestres = await Semestre.findAll({ where: { etablissementId: req.utilisateur.etablissementId, anneeScolaire: annee }, order: [['numero', 'ASC']] });
  const eleves = await Eleve.findAll({ where: { classeId: classe.id }, order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  const parSemestre = [];
  for (const s of semestres) parSemestre.push({ semestre: s, calculs: await calculerBulletinsClasse(eleves.map((e) => e.id), s.id) });
  const classes = await Classe.findAll({ where: { etablissementId: req.utilisateur.etablissementId, id: { [Op.ne]: classe.id } }, order: [['niveau', 'ASC'], ['nom', 'ASC']] });
  const cache = {};
  const lignes = [];
  for (const e of eleves) {
    const resultats = parSemestre.map(({ semestre, calculs }) => {
      const c = calculs.get(e.id);
      return { semestreId: semestre.id, libelle: semestre.libelle, evalue: c.detailParUE.length > 0, admis: c.admis, moyenne: c.moyenneGenerale, decisionJury: c.decisionJury, creditsValides: c.creditsValides, creditsTotal: c.creditsTotal };
    });
    const evalues = resultats.filter((r) => r.evalue);
    const moyenneAnnuelle = evalues.length ? Math.round((evalues.reduce((s, r) => s + r.moyenne, 0) / evalues.length) * 100) / 100 : null;
    const creditsAnnee = evalues.reduce((s, r) => s + r.creditsValides, 0);
    const creditsAnneeTotal = evalues.reduce((s, r) => s + r.creditsTotal, 0);
    const p = await calculerParcours(e.id, cache);
    const dettesAnciennes = p.dettes.filter((d) => d.anneeScolaire !== annee);
    const tout = evalues.length > 0 && evalues.every((r) => r.admis);
    const seuilDette = p.regles.passageDetteActif && p.regles.creditsMinPassagePct != null
      && creditsAnneeTotal > 0 && (creditsAnnee / creditsAnneeTotal) * 100 >= p.regles.creditsMinPassagePct;
    let proposition = 'redoublement';
    if (tout && !dettesAnciennes.length) proposition = 'passage';
    else if (evalues.length && seuilDette) proposition = 'passage_dette';
    lignes.push({
      eleveId: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule, resultats, moyenneAnnuelle, proposition,
      creditsAnnee, creditsAnneeTotal, creditsAcquis: p.creditsAcquis, creditsRequis: p.creditsRequis,
      uesDues: p.dettes.map((d) => d.code || d.intitule),
    });
  }
  return res.json({
    classe: { id: classe.id, nom: classe.nom, niveau: classe.niveau }, anneeScolaire: annee,
    semestres: semestres.map((s) => ({ id: s.id, libelle: s.libelle })),
    regles: cache.regles || null,
    classes: classes.map((c) => ({ id: c.id, nom: c.nom, niveau: c.niveau })),
    lignes,
    historique: await ParcoursEleve.findAll({ where: { etablissementId: req.utilisateur.etablissementId, classeDepart: classe.nom }, order: [['createdAt', 'DESC']], limit: 200 }),
  });
}

// Validation : chaque étudiant reçoit sa décision ; ceux qui passent sont
// affectés à la classe choisie ; le parcours garde la trace de tout.
async function appliquerPassage(req, res) {
  const classe = await Classe.findOne({ where: { id: req.params.classeId, etablissementId: req.utilisateur.etablissementId } });
  if (!classe) return res.status(404).json({ erreur: 'classe introuvable' });
  const { affectations = [], anneeScolaire, classeSuperieureId } = req.body || {};
  const superieure = classeSuperieureId ? await Classe.findOne({ where: { id: classeSuperieureId, etablissementId: req.utilisateur.etablissementId } }) : null;
  const passe = (d) => d === 'passage' || d === 'passage_dette';
  if (affectations.some((a) => passe(a.decision)) && !superieure) return res.status(400).json({ erreur: 'choisissez la classe d’arrivée des étudiants admis' });
  const eleves = new Map((await Eleve.findAll({ where: { classeId: classe.id } })).map((e) => [e.id, e]));
  let passes = 0;
  for (const a of affectations) {
    const eleve = eleves.get(Number(a.eleveId));
    if (!eleve || !['passage', 'passage_dette', 'redoublement', 'sortie'].includes(a.decision)) continue;
    await ParcoursEleve.create({
      etablissementId: req.utilisateur.etablissementId, eleveId: eleve.id, anneeScolaire: anneeScolaire || null,
      classeDepart: classe.nom, niveauDepart: classe.niveau, decision: a.decision,
      classeArriveeId: passe(a.decision) ? superieure.id : a.decision === 'redoublement' ? classe.id : null,
      classeArrivee: passe(a.decision) ? superieure.nom : a.decision === 'redoublement' ? classe.nom : null,
      moyenneAnnuelle: a.moyenneAnnuelle ?? null, decideParNom: nomAgent(req.utilisateur),
    });
    if (passe(a.decision)) { await eleve.update({ classeId: superieure.id }); passes += 1; }
  }
  await journaliserAudit(req, { action: 'passage_annee', cible: classe.nom, details: { passes, total: affectations.length, vers: superieure?.nom || null } });
  return res.json({ passes, total: affectations.length });
}

module.exports = { parcours, dettesUE, attestation, releve, semestresValides, propositionPassage, appliquerPassage };
