const { Op } = require('sequelize');
const {
  Professeur, AffectationEnseignement, Matiere, UniteEnseignement, Semestre, Classe, CompteEphemere,
} = require('../models');
const { journaliserAudit } = require('../services/auditService');

// Onglet Professeurs de l'Académie : la fiche de chaque professeur, ses
// coordonnées, son statut, et les enseignements qui lui sont confiés
// (matière, et classe le cas échéant).

const STATUTS = ['permanent', 'vacataire'];
const texte = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

async function professeurDeLEcole(req) {
  const professeur = await Professeur.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!professeur) {
    const err = new Error('professeur introuvable');
    err.status = 404;
    throw err;
  }
  return professeur;
}

// Matières de l'établissement (via leur UE et son semestre).
async function matieresDeLEcole(etablissementId) {
  return Matiere.findAll({
    include: [{ model: UniteEnseignement, required: true, include: [{ model: Semestre, required: true, where: { etablissementId } }] }],
    order: [['intitule', 'ASC']],
  });
}

function vueAffectation(a) {
  const ue = a.Matiere?.UniteEnseignement;
  return {
    id: a.id,
    matiereId: a.matiereId,
    matiere: a.Matiere?.intitule || '',
    code: a.Matiere?.code || '',
    ue: ue?.intitule || '',
    semestre: ue?.Semestre ? `${ue.Semestre.libelle} · ${ue.Semestre.anneeScolaire}` : '',
    classeId: a.classeId,
    classe: a.Classe?.nom || 'Toutes les classes',
    volumeHoraire: a.volumeHoraire,
  };
}

const INCLUSION_AFFECTATION = [
  { model: Matiere, include: [{ model: UniteEnseignement, include: [Semestre] }] },
  { model: Classe },
];

async function lister(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const professeurs = await Professeur.findAll({ where: { etablissementId }, order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  const affectations = await AffectationEnseignement.findAll({ where: { etablissementId }, include: INCLUSION_AFFECTATION });
  const actifs = await CompteEphemere.count({
    where: { professeurId: professeurs.map((p) => p.id), statut: 'actif', dateExpiration: { [Op.gt]: new Date() } },
    group: ['professeurId'],
  });
  const liensActifs = Object.fromEntries(actifs.map((a) => [a.professeurId, Number(a.count)]));
  return res.json({
    professeurs: professeurs.map((p) => {
      const siennes = affectations.filter((a) => a.professeurId === p.id).map(vueAffectation);
      return {
        ...p.toJSON(),
        affectations: siennes,
        nbMatieres: new Set(siennes.map((a) => a.matiereId)).size,
        nbClasses: new Set(siennes.map((a) => a.classeId).filter(Boolean)).size,
        liensActifs: liensActifs[p.id] || 0,
      };
    }),
  });
}

async function fiche(req, res) {
  const professeur = await professeurDeLEcole(req);
  const affectations = await AffectationEnseignement.findAll({ where: { professeurId: professeur.id }, include: INCLUSION_AFFECTATION });
  const liens = await CompteEphemere.findAll({
    where: { professeurId: professeur.id },
    attributes: ['id', 'tache', 'statut', 'dateCreation', 'dateExpiration', 'saisieEnvoyeeLe'],
    include: [{ model: Matiere, attributes: ['intitule'] }],
    order: [['dateCreation', 'DESC']],
    limit: 8,
  });
  return res.json({
    professeur,
    affectations: affectations.map(vueAffectation),
    liens: liens.map((l) => ({
      id: l.id, type: l.tache, matiere: l.Matiere?.intitule || '', creeLe: l.dateCreation, expireLe: l.dateExpiration,
      statut: l.statut === 'actif' && new Date(l.dateExpiration) < new Date() ? 'expire' : l.statut, envoyeLe: l.saisieEnvoyeeLe,
    })),
  });
}

async function modifier(req, res) {
  const professeur = await professeurDeLEcole(req);
  const { nom, prenom, email } = req.body || {};
  if (!String(nom || '').trim() || !String(prenom || '').trim()) return res.status(400).json({ erreur: 'le nom et le prénom sont obligatoires' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return res.status(400).json({ erreur: 'adresse e-mail invalide' });
  const statut = req.body.statut || null;
  if (statut && !STATUTS.includes(statut)) return res.status(400).json({ erreur: 'statut invalide' });
  try {
    await professeur.update({
      nom: texte(nom, 80), prenom: texte(prenom, 80), email: String(email).trim().toLowerCase(),
      telephone: texte(req.body.telephone, 30), grade: texte(req.body.grade, 80), matiere: texte(req.body.matiere, 120), statut,
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre professeur' });
    throw e;
  }
  return res.json({ professeur });
}

async function options(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const matieres = await matieresDeLEcole(etablissementId);
  const classes = await Classe.findAll({ where: { etablissementId }, attributes: ['id', 'nom', 'niveau'], order: [['nom', 'ASC']] });
  return res.json({
    matieres: matieres.map((m) => ({
      id: m.id, intitule: m.intitule, code: m.code, ue: m.UniteEnseignement.intitule,
      semestre: `${m.UniteEnseignement.Semestre.libelle} · ${m.UniteEnseignement.Semestre.anneeScolaire}`,
    })),
    classes,
  });
}

async function ajouterAffectation(req, res) {
  const professeur = await professeurDeLEcole(req);
  const etablissementId = req.utilisateur.etablissementId;
  const matiereId = Number(req.body.matiereId);
  const classeId = req.body.classeId ? Number(req.body.classeId) : null;
  const matiere = (await matieresDeLEcole(etablissementId)).find((m) => m.id === matiereId);
  if (!matiere) return res.status(404).json({ erreur: 'matière introuvable' });
  if (classeId && !(await Classe.count({ where: { id: classeId, etablissementId } }))) return res.status(404).json({ erreur: 'classe introuvable' });
  const volume = req.body.volumeHoraire ? Math.round(Number(req.body.volumeHoraire)) : null;
  if (volume != null && (!Number.isFinite(volume) || volume < 1 || volume > 600)) return res.status(400).json({ erreur: 'volume horaire invalide (1 à 600 heures)' });
  const existe = await AffectationEnseignement.findOne({ where: { professeurId: professeur.id, matiereId, classeId } });
  if (existe) return res.status(409).json({ erreur: 'cet enseignement est déjà confié à ce professeur' });
  await AffectationEnseignement.create({ etablissementId, professeurId: professeur.id, matiereId, classeId, volumeHoraire: volume });
  await journaliserAudit(req, { action: 'affectation_enseignement', cible: `${professeur.prenom} ${professeur.nom}`, details: { matiere: matiere.intitule } });
  return fiche(req, res);
}

async function retirerAffectation(req, res) {
  const professeur = await professeurDeLEcole(req);
  const n = await AffectationEnseignement.destroy({ where: { id: req.params.affectationId, professeurId: professeur.id } });
  if (!n) return res.status(404).json({ erreur: 'enseignement introuvable' });
  return fiche(req, res);
}

// Erreurs « métier » (404 du professeur) renvoyées proprement.
const sur = (fn) => (req, res, next) => fn(req, res).catch((e) => (e.status ? res.status(e.status).json({ erreur: e.message }) : next(e)));

module.exports = {
  lister: sur(lister), fiche: sur(fiche), modifier: sur(modifier), options: sur(options),
  ajouterAffectation: sur(ajouterAffectation), retirerAffectation: sur(retirerAffectation),
};
