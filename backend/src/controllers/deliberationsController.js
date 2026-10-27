const { Classe, Semestre, Eleve, Deliberation, DecisionJury, Notification } = require('../models');
const { calculerBulletinsClasse } = require('../services/moyenneService');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { journaliserAudit } = require('../services/auditService');
const { pvDeliberationPDF } = require('../services/documentsOfficielsService');

// Délibérations du jury par classe et par semestre.
const DECISIONS = ['admis', 'admis_jury', 'rattrapage'];
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

async function contexte(req) {
  const { classeId, semestreId } = req.params;
  const [classe, semestre] = await Promise.all([Classe.findByPk(classeId), Semestre.findByPk(semestreId)]);
  const etab = req.utilisateur.etablissementId;
  if (!classe || !semestre || classe.etablissementId !== etab || semestre.etablissementId !== etab) {
    const err = new Error('classe ou semestre introuvable');
    err.status = 404;
    throw err;
  }
  const deliberation = await Deliberation.findOne({ where: { classeId: classe.id, semestreId: semestre.id }, include: [DecisionJury] });
  return { classe, semestre, deliberation };
}

// Lignes du jury : résultat calculé par les règles de validation et
// décision retenue (enregistrée, ou calculée par défaut).
async function lignesJury(classe, semestre, deliberation) {
  const eleves = await Eleve.findAll({ where: { classeId: classe.id }, order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  const calculs = await calculerBulletinsClasse(eleves.map((e) => e.id), semestre.id);
  const enregistrees = new Map((deliberation?.DecisionJuries || []).map((d) => [d.eleveId, d]));
  return eleves.map((e) => {
    const c = calculs.get(e.id);
    const evalue = c.detailParUE.length > 0;
    const decisionCalculee = c.admisCalcule ? 'admis' : 'rattrapage';
    const d = enregistrees.get(e.id);
    return {
      eleveId: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule, evalue,
      moyenne: c.moyenneGenerale, creditsValides: c.creditsValides, creditsTotal: c.creditsTotal,
      uesNonValidees: c.detailParUE.filter((u) => !u.valide).map((u) => u.code || u.ue),
      decisionCalculee, decision: d?.decision || decisionCalculee, motif: d?.motif || '',
    };
  });
}

async function consulter(req, res) {
  const { classe, semestre, deliberation } = await contexte(req);
  const lignes = await lignesJury(classe, semestre, deliberation);
  const evalues = lignes.filter((l) => l.evalue);
  return res.json({
    classe: { id: classe.id, nom: classe.nom, niveau: classe.niveau },
    semestre: { id: semestre.id, libelle: semestre.libelle, anneeScolaire: semestre.anneeScolaire },
    deliberation: deliberation ? { ...deliberation.toJSON(), DecisionJuries: undefined } : { statut: 'ouverte', nouvelle: true },
    lignes,
    stats: {
      evalues: evalues.length,
      admis: evalues.filter((l) => l.decision !== 'rattrapage').length,
      parJury: evalues.filter((l) => l.decision === 'admis_jury').length,
      rattrapage: evalues.filter((l) => l.decision === 'rattrapage').length,
    },
  });
}

async function enregistrer(req, res) {
  const { classe, semestre } = await contexte(req);
  let { deliberation } = await contexte(req);
  if (deliberation?.statut === 'close') return res.status(409).json({ erreur: 'délibération close : rouvrez-la avant de modifier les décisions' });
  const { dateSeance, president, membres, observations, decisions = [] } = req.body || {};
  for (const d of decisions) {
    if (!DECISIONS.includes(d.decision)) return res.status(400).json({ erreur: 'décision invalide' });
    if (d.decision === 'admis_jury' && String(d.motif || '').trim().length < 5) return res.status(400).json({ erreur: 'motivez chaque admission par décision du jury' });
  }
  if (!deliberation) {
    deliberation = await Deliberation.create({ etablissementId: req.utilisateur.etablissementId, classeId: classe.id, semestreId: semestre.id });
  }
  await deliberation.update({
    dateSeance: dateSeance || null, president: president || null, membres: membres || null, observations: observations || null,
  });
  const lignes = await lignesJury(classe, semestre, null);
  const parEleve = new Map(lignes.map((l) => [l.eleveId, l]));
  for (const d of decisions) {
    const l = parEleve.get(Number(d.eleveId));
    if (!l || !l.evalue) continue;
    // Un étudiant admis par les règles l'est sans motif ; le jury ne peut
    // que relever un « rattrapage » en « admis par décision du jury ».
    const decision = l.decisionCalculee === 'admis' ? 'admis' : d.decision === 'admis' ? 'admis_jury' : d.decision;
    const [ligne] = await DecisionJury.findOrCreate({
      where: { deliberationId: deliberation.id, eleveId: l.eleveId },
      defaults: { decisionCalculee: l.decisionCalculee, decision, motif: d.motif || null, moyenne: l.moyenne, creditsValides: l.creditsValides },
    });
    await ligne.update({ decisionCalculee: l.decisionCalculee, decision, motif: decision === 'admis_jury' ? String(d.motif).trim().slice(0, 300) : null, moyenne: l.moyenne, creditsValides: l.creditsValides });
  }
  return consulter(req, res);
}

async function clore(req, res) {
  const { classe, semestre, deliberation } = await contexte(req);
  if (!deliberation) return res.status(400).json({ erreur: 'enregistrez d’abord la séance du jury' });
  if (deliberation.statut === 'close') return res.status(409).json({ erreur: 'délibération déjà close' });
  if (!deliberation.president) return res.status(400).json({ erreur: 'indiquez le président du jury avant de clore' });
  // Décisions manquantes : la décision calculée est retenue.
  const lignes = await lignesJury(classe, semestre, deliberation);
  for (const l of lignes.filter((x) => x.evalue)) {
    await DecisionJury.findOrCreate({
      where: { deliberationId: deliberation.id, eleveId: l.eleveId },
      defaults: { decisionCalculee: l.decisionCalculee, decision: l.decision, motif: l.motif || null, moyenne: l.moyenne, creditsValides: l.creditsValides },
    });
  }
  await deliberation.update({ statut: 'close', closeLe: new Date(), closeParNom: nomAgent(req.utilisateur) });
  const comptes = await Eleve.findAll({ where: { classeId: classe.id }, attributes: ['compteEtudiantId'] });
  await Notification.bulkCreate(comptes.filter((e) => e.compteEtudiantId).map((e) => ({
    utilisateurId: e.compteEtudiantId, dateEnvoi: new Date(),
    contenu: `Résultats du ${semestre.libelle} délibérés par le jury : votre bulletin est à jour.`,
  }))).catch(() => {});
  await journaliserAudit(req, { action: 'deliberation_close', cible: `${classe.nom}, ${semestre.libelle}` });
  return consulter(req, res);
}

async function rouvrir(req, res) {
  const { classe, semestre, deliberation } = await contexte(req);
  if (!deliberation || deliberation.statut !== 'close') return res.status(400).json({ erreur: 'la délibération n’est pas close' });
  const motif = String(req.body?.motif || '').trim();
  if (motif.length < 10) return res.status(400).json({ erreur: 'motivez la réouverture (10 caractères au moins)' });
  await deliberation.update({ statut: 'ouverte', closeLe: null, observations: `${deliberation.observations ? `${deliberation.observations}\n` : ''}Réouverte le ${new Date().toLocaleDateString('fr-FR')} : ${motif}` });
  await journaliserAudit(req, { action: 'deliberation_rouverte', cible: `${classe.nom}, ${semestre.libelle}`, details: { motif } });
  return consulter(req, res);
}

async function procesVerbal(req, res) {
  const { classe, semestre, deliberation } = await contexte(req);
  if (!deliberation) return res.status(400).json({ erreur: 'aucune séance enregistrée pour cette classe et ce semestre' });
  const lignes = await lignesJury(classe, semestre, deliberation);
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const pdf = await pvDeliberationPDF({ etablissement, classe, semestre, deliberation, lignes, emisParId: req.utilisateur.id });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="pv-deliberation-${classe.id}-${semestre.id}.pdf"`, 'Access-Control-Expose-Headers': 'Content-Disposition' });
  return res.send(pdf);
}

module.exports = { consulter, enregistrer, clore, rouvrir, procesVerbal };
