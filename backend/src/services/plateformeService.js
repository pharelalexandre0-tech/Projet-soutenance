const { Fonctionnalite, ParametrePlateforme, JournalAdministration } = require('../models');
const { CATALOGUE_FONCTIONNALITES } = require('../config/fonctionnalites');

// Heure de démarrage du processus, affichée dans "Mises à jour" (depuis quand
// la version actuelle tourne).
const DEMARRAGE = new Date();

// La maintenance et l'ouverture des modules sont consultées à CHAQUE requête
// authentifiée : un petit cache en mémoire évite deux requêtes SQL de plus
// par appel. Tout changement fait par le superadmin l'invalide aussitôt ;
// le délai ne joue donc que si un autre processus modifiait la base.
const DUREE_CACHE_MS = 10 * 1000;
let cache = null;

async function chargerCache() {
  if (cache && cache.expireA > Date.now()) return cache;
  const [lignes, parametres] = await Promise.all([Fonctionnalite.findAll(), ParametrePlateforme.findAll()]);
  cache = {
    expireA: Date.now() + DUREE_CACHE_MS,
    fonctionnalites: new Map(lignes.map((l) => [l.cle, l.toJSON()])),
    parametres: new Map(parametres.map((p) => [p.cle, p.valeur])),
  };
  return cache;
}

function invaliderCache() {
  cache = null;
}

// Réglage effectif d'un module : la ligne en base si le superadmin l'a déjà
// réglé, sinon la portée par défaut du catalogue.
function reglage(definition, c) {
  const ligne = c.fonctionnalites.get(definition.cle);
  if (ligne) return { portee: ligne.portee, ecoles: Array.isArray(ligne.ecoles) ? ligne.ecoles : [], misAJourLe: ligne.updatedAt };
  return { portee: definition.porteeParDefaut || 'toutes', ecoles: [], misAJourLe: null };
}

function estOuvertePour(r, etablissementId) {
  if (r.portee === 'toutes') return true;
  if (r.portee === 'aucune') return false;
  return r.ecoles.includes(etablissementId);
}

async function reglagesFonctionnalites() {
  const c = await chargerCache();
  return CATALOGUE_FONCTIONNALITES.map((d) => ({ ...d, ...reglage(d, c) }));
}

// { prediction: true, paie: false, ... } pour une école donnée. Un compte
// sans établissement (superadmin) n'a rien à restreindre.
async function fonctionnalitesPour(etablissementId) {
  const c = await chargerCache();
  const resultat = {};
  CATALOGUE_FONCTIONNALITES.forEach((d) => {
    resultat[d.cle] = etablissementId ? estOuvertePour(reglage(d, c), etablissementId) : true;
  });
  return resultat;
}

async function fonctionnaliteOuverte(cle, etablissementId) {
  if (!etablissementId) return true;
  const definition = CATALOGUE_FONCTIONNALITES.find((d) => d.cle === cle);
  if (!definition) return true;
  const c = await chargerCache();
  return estOuvertePour(reglage(definition, c), etablissementId);
}

async function lireParametre(cle) {
  const c = await chargerCache();
  return c.parametres.has(cle) ? c.parametres.get(cle) : null;
}

async function ecrireParametre(cle, valeur) {
  await ParametrePlateforme.upsert({ cle, valeur });
  invaliderCache();
}

async function maintenanceEnCours() {
  const maintenance = await lireParametre('maintenance');
  return maintenance && maintenance.actif ? maintenance : null;
}

// Une annonce dont la date de retrait est passée disparaît d'elle-même,
// sans que le superadmin ait à revenir la retirer à la main.
async function annonceEnCours() {
  const annonce = await lireParametre('annonce');
  if (!annonce || !annonce.actif) return null;
  if (annonce.expireLe && new Date(annonce.expireLe) <= new Date()) return null;
  return annonce;
}

// Réponse commune à tout accès refusé pour cause de maintenance (session,
// connexion, lien de professeur) : `maintenance: true` permet au frontend
// d'afficher l'écran d'attente plutôt qu'une simple erreur.
function repondreMaintenance(res, maintenance) {
  return res.status(503).json({
    erreur: maintenance.message
      ? `EduSphere est en maintenance. ${maintenance.message}`
      : 'EduSphere est en maintenance, réessaie un peu plus tard.',
    maintenance: true,
    finPrevue: maintenance.finPrevue || null,
  });
}

// Une entrée de journal ne doit jamais faire échouer l'action qu'elle
// décrit : l'erreur est seulement consignée côté serveur.
async function journaliser(utilisateur, categorie, libelle) {
  try {
    await JournalAdministration.create({
      auteurId: utilisateur?.id ?? null,
      auteurNom: utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Système',
      categorie,
      libelle: libelle.slice(0, 400),
    });
  } catch (err) {
    console.error("[Journal] impossible d'enregistrer l'entrée :", err.message);
  }
}

module.exports = {
  DEMARRAGE,
  invaliderCache,
  reglagesFonctionnalites,
  fonctionnalitesPour,
  fonctionnaliteOuverte,
  lireParametre,
  ecrireParametre,
  maintenanceEnCours,
  annonceEnCours,
  repondreMaintenance,
  journaliser,
};
