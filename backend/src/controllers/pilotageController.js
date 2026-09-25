const { MiseAJour, JournalAdministration, sequelize } = require('../models');
const {
  DEMARRAGE, lireParametre, ecrireParametre, journaliser,
} = require('../services/plateformeService');
const { version: versionPaquet } = require('../../package.json');

// Pilotage de la plateforme par le superadmin : notes de version, annonce,
// maintenance, journal (les fonctionnalités des écoles sont dans
// fonctionnalitesController). Même frontière
// que superadminController : on agit sur la plateforme, jamais sur le
// contenu d'une école.

const ESPACES_NOTES = ['academie', 'finance', 'etudiant', 'parent'];
const TYPES_NOTES = ['nouveaute', 'amelioration', 'correctif'];
const NIVEAUX_ANNONCE = ['info', 'important'];

function erreur400(res, message) {
  return res.status(400).json({ erreur: message });
}

// ---- Notes de version (mises à jour) ------------------------------------------

function lireNote(body) {
  const version = String(body.version || '').trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){1,2}$/.test(version)) return { erreur: 'numéro de version invalide (exemple : 1.4.0)' };
  const titre = String(body.titre || '').trim();
  if (titre.length < 3 || titre.length > 140) return { erreur: 'le titre doit faire entre 3 et 140 caractères' };
  const contenu = String(body.contenu || '').trim();
  if (!contenu || contenu.length > 4000) return { erreur: 'la description est obligatoire (4000 caractères au plus)' };
  if (!TYPES_NOTES.includes(body.type)) return { erreur: 'type de mise à jour invalide' };
  const espaces = Array.isArray(body.espaces) ? [...new Set(body.espaces.filter((e) => ESPACES_NOTES.includes(e)))] : [];
  if (espaces.length === 0) return { erreur: 'choisis au moins un espace qui verra cette mise à jour' };
  // Tous les espaces cochés = [] ("tout le monde"), pour inclure aussi un
  // futur rôle sans avoir à revenir sur les anciennes notes.
  return { donnees: { version, titre, contenu, type: body.type, espaces: espaces.length === ESPACES_NOTES.length ? [] : espaces } };
}

async function listerMisesAJour(req, res) {
  const notes = await MiseAJour.findAll();
  // Brouillons d'abord (le travail en cours), puis l'historique publié du
  // plus récent au plus ancien.
  notes.sort((a, b) => {
    if (a.statut !== b.statut) return a.statut === 'brouillon' ? -1 : 1;
    return new Date(b.publieeLe || b.createdAt) - new Date(a.publieeLe || a.createdAt);
  });
  return res.json({ misesAJour: notes });
}

async function creerMiseAJour(req, res) {
  const { erreur, donnees } = lireNote(req.body);
  if (erreur) return erreur400(res, erreur);
  const publier = Boolean(req.body.publier);
  const note = await MiseAJour.create({
    ...donnees,
    auteurId: req.utilisateur.id,
    statut: publier ? 'publiee' : 'brouillon',
    publieeLe: publier ? new Date() : null,
  });
  await journaliser(req.utilisateur, 'mise-a-jour', publier
    ? `Publication de la version ${note.version} : ${note.titre}`
    : `Brouillon de la version ${note.version} : ${note.titre}`);
  return res.status(201).json({ miseAJour: note });
}

async function modifierMiseAJour(req, res) {
  const note = await MiseAJour.findByPk(req.params.id);
  if (!note) return res.status(404).json({ erreur: 'mise à jour introuvable' });
  const { erreur, donnees } = lireNote(req.body);
  if (erreur) return erreur400(res, erreur);
  await note.update(donnees);
  await journaliser(req.utilisateur, 'mise-a-jour', `Modification de la version ${note.version} : ${note.titre}`);
  return res.json({ miseAJour: note });
}

async function publierMiseAJour(req, res) {
  const note = await MiseAJour.findByPk(req.params.id);
  if (!note) return res.status(404).json({ erreur: 'mise à jour introuvable' });
  if (note.statut === 'publiee') return erreur400(res, 'cette mise à jour est déjà publiée');
  await note.update({ statut: 'publiee', publieeLe: new Date() });
  await journaliser(req.utilisateur, 'mise-a-jour', `Publication de la version ${note.version} : ${note.titre}`);
  return res.json({ miseAJour: note });
}

async function supprimerMiseAJour(req, res) {
  const note = await MiseAJour.findByPk(req.params.id);
  if (!note) return res.status(404).json({ erreur: 'mise à jour introuvable' });
  await note.destroy();
  await journaliser(req.utilisateur, 'mise-a-jour', `Suppression de la version ${note.version} : ${note.titre}`);
  return res.json({ message: 'mise à jour supprimée' });
}

// Ce qui tourne réellement en production : dernière version annoncée,
// commit déployé (fourni par Render), depuis quand le serveur tourne, et
// l'état de la base. Aucune variable secrète n'en sort.
async function obtenirSysteme(req, res) {
  const debut = Date.now();
  let baseOk = true;
  try {
    await sequelize.query('SELECT 1');
  } catch {
    baseOk = false;
  }
  const latenceMs = Date.now() - debut;
  const derniere = await MiseAJour.findOne({ where: { statut: 'publiee' }, order: [['publieeLe', 'DESC']] });

  return res.json({
    version: derniere?.version || versionPaquet,
    versionPublieeLe: derniere?.publieeLe || null,
    commit: process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : null,
    branche: process.env.RENDER_GIT_BRANCH || null,
    hebergement: process.env.RENDER ? 'Render' : 'Serveur local',
    demarreLe: DEMARRAGE,
    node: process.version,
    memoireMo: Math.round(process.memoryUsage().rss / 1024 / 1024),
    baseDeDonnees: { ok: baseOk, latenceMs },
  });
}

// ---- Annonce et maintenance ---------------------------------------------------

function lireDateOptionnelle(valeur) {
  if (!valeur) return { date: null };
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return { erreur: 'date invalide' };
  return { date };
}

async function obtenirDiffusion(req, res) {
  const [annonce, maintenance] = await Promise.all([lireParametre('annonce'), lireParametre('maintenance')]);
  const annonceExpiree = Boolean(annonce?.actif && annonce.expireLe && new Date(annonce.expireLe) <= new Date());
  return res.json({
    annonce: annonce ? { ...annonce, actif: Boolean(annonce.actif) && !annonceExpiree, expiree: annonceExpiree } : { actif: false },
    maintenance: maintenance || { actif: false },
  });
}

async function publierAnnonce(req, res) {
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 300) return erreur400(res, "le message de l'annonce est obligatoire (300 caractères au plus)");
  const niveau = NIVEAUX_ANNONCE.includes(req.body.niveau) ? req.body.niveau : 'info';
  const { date: expireLe, erreur } = lireDateOptionnelle(req.body.expireLe);
  if (erreur) return erreur400(res, erreur);
  if (expireLe && expireLe <= new Date()) return erreur400(res, 'la date de retrait doit être dans le futur');

  await ecrireParametre('annonce', {
    actif: true, message, niveau, expireLe, publieeLe: new Date(),
    auteur: `${req.utilisateur.prenom} ${req.utilisateur.nom}`,
  });
  await journaliser(req.utilisateur, 'annonce', `Annonce publiée : ${message}`);
  return obtenirDiffusion(req, res);
}

async function retirerAnnonce(req, res) {
  const annonce = await lireParametre('annonce');
  // Le texte reste en mémoire (actif: false) pour pouvoir le republier tel
  // quel ou le retoucher, au lieu de devoir tout ressaisir.
  await ecrireParametre('annonce', { ...(annonce || {}), actif: false });
  await journaliser(req.utilisateur, 'annonce', 'Annonce retirée');
  return obtenirDiffusion(req, res);
}

async function definirMaintenance(req, res) {
  const precedente = (await lireParametre('maintenance')) || {};
  const message = String(req.body.message || '').trim().slice(0, 300);

  if (req.body.actif) {
    const { date: finPrevue, erreur } = lireDateOptionnelle(req.body.finPrevue);
    if (erreur) return erreur400(res, erreur);
    await ecrireParametre('maintenance', {
      actif: true, message, finPrevue, depuis: new Date(),
      auteur: `${req.utilisateur.prenom} ${req.utilisateur.nom}`,
    });
    await journaliser(req.utilisateur, 'maintenance', `Maintenance activée${message ? ` : ${message}` : ''}`);
  } else {
    await ecrireParametre('maintenance', {
      actif: false, message: message || precedente.message || '', finPrevue: null,
      depuis: null, termineeLe: new Date(),
    });
    await journaliser(req.utilisateur, 'maintenance', 'Maintenance terminée, plateforme rouverte');
  }
  return obtenirDiffusion(req, res);
}

// ---- Journal d'activité -------------------------------------------------------

async function listerJournal(req, res) {
  const limite = Math.min(Number(req.query.limite) || 300, 500);
  const where = req.query.categorie ? { categorie: String(req.query.categorie) } : {};
  const entrees = await JournalAdministration.findAll({ where, order: [['createdAt', 'DESC']], limit: limite });
  return res.json({ entrees });
}

module.exports = {
  listerMisesAJour,
  creerMiseAJour,
  modifierMiseAJour,
  publierMiseAJour,
  supprimerMiseAJour,
  obtenirSysteme,
  obtenirDiffusion,
  publierAnnonce,
  retirerAnnonce,
  definirMaintenance,
  listerJournal,
};
