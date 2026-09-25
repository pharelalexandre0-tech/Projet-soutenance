const {
  sequelize, Etablissement, FonctionnalitePersonnalisee, ActivationFonctionnalite, ParametrePlateforme, JournalAdministration,
} = require('../models');
const { MODULES_INTEGRES } = require('../config/fonctionnalites');

// Heure de démarrage du processus, affichée dans "Mises à jour" (depuis quand
// la version actuelle tourne).
const DEMARRAGE = new Date();

// Les fonctionnalités d'une école et la maintenance sont consultées à CHAQUE
// requête authentifiée : un petit cache en mémoire évite trois requêtes SQL
// de plus par appel. Toute modification faite par le superadmin l'invalide
// aussitôt ; le délai ne joue que si un autre processus modifiait la base.
const DUREE_CACHE_MS = 10 * 1000;
let cache = null;

async function chargerCache() {
  if (cache && cache.expireA > Date.now()) return cache;
  const [activations, personnalisees, parametres] = await Promise.all([
    ActivationFonctionnalite.findAll({ attributes: ['etablissementId', 'cle'] }),
    FonctionnalitePersonnalisee.findAll({ order: [['nom', 'ASC']] }),
    ParametrePlateforme.findAll(),
  ]);
  const parEcole = new Map();
  activations.forEach((a) => {
    if (!parEcole.has(a.etablissementId)) parEcole.set(a.etablissementId, new Set());
    parEcole.get(a.etablissementId).add(a.cle);
  });
  cache = {
    expireA: Date.now() + DUREE_CACHE_MS,
    parEcole,
    personnalisees: personnalisees.map((p) => p.toJSON()),
    parametres: new Map(parametres.map((p) => [p.cle, p.valeur])),
  };
  return cache;
}

function invaliderCache() {
  cache = null;
}

// Tout le catalogue, modules intégrés d'abord, avec pour chaque entrée la
// liste des écoles qui l'ont reçue.
async function catalogue() {
  const c = await chargerCache();
  const ecolesAyant = (cle) => [...c.parEcole.entries()].filter(([, cles]) => cles.has(cle)).map(([id]) => id);
  return [
    ...MODULES_INTEGRES.map((m) => ({ ...m, type: 'module', integree: true, ecoles: ecolesAyant(m.cle) })),
    ...c.personnalisees.map((p) => ({ ...p, integree: false, ecoles: ecolesAyant(p.cle) })),
  ];
}

async function clesDeLEcole(etablissementId) {
  const c = await chargerCache();
  return c.parEcole.get(etablissementId) || new Set();
}

// { prediction: true, paie: false, ... } pour les modules intégrés d'une
// école. Un compte sans établissement (superadmin) n'a rien à restreindre.
async function fonctionnalitesPour(etablissementId) {
  const cles = etablissementId ? await clesDeLEcole(etablissementId) : null;
  const resultat = {};
  MODULES_INTEGRES.forEach((m) => {
    resultat[m.cle] = cles ? cles.has(m.cle) : true;
  });
  return resultat;
}

// Fonctionnalités personnalisées ajoutées à l'école ET destinées à ce rôle :
// chacune devient un onglet de plus dans l'espace de l'utilisateur.
async function extensionsPour(etablissementId, role) {
  if (!etablissementId) return [];
  const c = await chargerCache();
  const cles = c.parEcole.get(etablissementId) || new Set();
  return c.personnalisees
    .filter((p) => cles.has(p.cle) && Array.isArray(p.espaces) && p.espaces.includes(role))
    .map(({ cle, type, nom, description, icone, contenu, url, libelleBouton }) => ({
      cle, type, nom, description, icone, contenu, url, libelleBouton,
    }));
}

async function fonctionnaliteOuverte(cle, etablissementId) {
  if (!etablissementId) return true;
  return (await clesDeLEcole(etablissementId)).has(cle);
}

async function lireParametre(cle) {
  const c = await chargerCache();
  return c.parametres.has(cle) ? c.parametres.get(cle) : null;
}

async function ecrireParametre(cle, valeur) {
  await ParametrePlateforme.upsert({ cle, valeur });
  invaliderCache();
}

// Passage au modèle "école par école" : les écoles déjà affiliées gardent
// exactement ce qu'elles avaient (tous les modules intégrés), une seule
// fois, au premier démarrage de cette version. Les écoles créées ensuite ne
// reçoivent que ce que le superadmin choisit pour elles.
async function initialiserActivations() {
  const deja = await ParametrePlateforme.findByPk('activations_initialisees');
  if (deja) return;
  const ecoles = await Etablissement.findAll({ attributes: ['id'] });
  const lignes = ecoles.flatMap((e) => MODULES_INTEGRES.map((m) => ({ etablissementId: e.id, cle: m.cle })));
  if (lignes.length) await ActivationFonctionnalite.bulkCreate(lignes, { ignoreDuplicates: true });
  // Ancienne table du réglage "toutes les écoles / pilotes", remplacée par
  // les activations école par école.
  try {
    await sequelize.getQueryInterface().dropTable('fonctionnalites');
  } catch {
    // Déjà absente : rien à faire.
  }
  await ParametrePlateforme.upsert({ cle: 'activations_initialisees', valeur: { le: new Date(), ecoles: ecoles.length } });
  invaliderCache();
  console.log(`Fonctionnalités : ${ecoles.length} école(s) initialisée(s) avec les modules intégrés.`);
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
  catalogue,
  clesDeLEcole,
  fonctionnalitesPour,
  extensionsPour,
  fonctionnaliteOuverte,
  initialiserActivations,
  lireParametre,
  ecrireParametre,
  maintenanceEnCours,
  annonceEnCours,
  repondreMaintenance,
  journaliser,
};
