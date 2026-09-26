const { EventEmitter } = require('events');
const { Client } = require('pg');
const sequelize = require('../config/db');

// Mise à jour en direct des écrans : chaque modification enregistrée
// (inscription, note, absence, paiement, publication...) produit un
// événement, relayé aux navigateurs ouverts de la même école par un flux
// SSE (routes/evenements.js). Les pages rechargent alors leurs données,
// sans recherche ni changement d'onglet.
//
// Les événements passent par PostgreSQL (NOTIFY / LISTEN) plutôt que par la
// seule mémoire du serveur : un script lancé à part (vérification des
// impayés, analyse de risque, jeu de démonstration) ou une seconde
// instance de l'API les diffusent aussi. Un événement ne porte jamais de
// donnée scolaire : seulement l'école et le domaine concernés.

const CANAL_PG = 'edusphere_evenements';
const CANAL_PLATEFORME = 'plateforme';
// Tous les événements, pour le superadmin (ses tableaux de bord comptent
// les écoles, élèves, e-mails...). Il ne reçoit que l'école et le domaine
// touchés, jamais le contenu.
const CANAL_TOUT = 'tout';
const bus = new EventEmitter();
bus.setMaxListeners(0);

function canalEcole(etablissementId) {
  return `ecole:${etablissementId}`;
}

function diffuserLocalement(evenement) {
  bus.emit(evenement.etablissementId ? canalEcole(evenement.etablissementId) : CANAL_PLATEFORME, evenement);
  bus.emit(CANAL_TOUT, evenement);
}

// `etablissementId` nul : changement de la plateforme (maintenance,
// annonce, fonctionnalités), diffusé à toutes les écoles.
async function publier(etablissementId, domaine) {
  const evenement = { etablissementId: etablissementId || null, domaine, le: Date.now() };
  try {
    await sequelize.query('SELECT pg_notify(:canal, :charge)', {
      replacements: { canal: CANAL_PG, charge: JSON.stringify(evenement) },
    });
    if (!ecoute) diffuserLocalement(evenement);
  } catch {
    diffuserLocalement(evenement);
  }
}

// Abonnement d'un flux SSE : les événements de son école et ceux de la
// plateforme (ou tous, pour le superadmin). Renvoie la fonction de
// désabonnement.
function abonner(etablissementId, ecouteur, { tout = false } = {}) {
  const canaux = tout ? [CANAL_TOUT] : [CANAL_PLATEFORME, ...(etablissementId ? [canalEcole(etablissementId)] : [])];
  canaux.forEach((c) => bus.on(c, ecouteur));
  return () => canaux.forEach((c) => bus.off(c, ecouteur));
}

// Connexion PostgreSQL dédiée à l'écoute (une connexion en LISTEN ne peut
// pas servir aux requêtes du pool de Sequelize).
let ecoute = null;
let relance = null;

function optionsConnexion() {
  const url = process.env.DATABASE_URL || '';
  const local = /localhost|127\.0\.0\.1|@db[:/]/.test(url);
  return { connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) };
}

function programmerRelance() {
  ecoute = null;
  if (relance) return;
  relance = setTimeout(() => { relance = null; demarrerEcoute(); }, 5000);
}

async function demarrerEcoute() {
  const client = new Client(optionsConnexion());
  client.on('notification', (message) => {
    try { diffuserLocalement(JSON.parse(message.payload)); } catch { /* charge illisible : ignorée */ }
  });
  client.on('error', () => { client.end().catch(() => {}); programmerRelance(); });
  client.on('end', programmerRelance);
  try {
    await client.connect();
    await client.query(`LISTEN ${CANAL_PG}`);
    const reprise = ecoute === null && relance === null;
    ecoute = client;
    // Après une coupure, des événements ont pu se perdre : chaque écran
    // recharge ses données une fois.
    if (reprise) diffuserLocalement({ etablissementId: null, domaine: 'resynchronisation', le: Date.now() });
  } catch (err) {
    console.error('[Temps réel] Écoute PostgreSQL indisponible, nouvel essai dans 5 s :', err.message);
    programmerRelance();
  }
}

// Après chaque requête qui modifie des données (POST, PUT, PATCH, DELETE
// réussis), un événement pour l'école concernée. Le domaine est le premier
// segment de l'adresse (/api/notes/... -> notes).
const METHODES_MODIFICATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Actions qui ne concernent que la personne connectée (connexion, lecture
// de ses notifications ou des nouveautés) : rien à diffuser.
const ROUTES_SANS_EVENEMENT = /^\/api\/((auth|sante|evenements|notifications)(\/|$)|plateforme\/nouveautes)/;

function diffuserModifications(req, res, next) {
  if (!METHODES_MODIFICATION.has(req.method) || ROUTES_SANS_EVENEMENT.test(req.originalUrl)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const domaine = (req.originalUrl.split('?')[0].split('/')[2] || 'donnees');
    etablissementDeLaRequete(req)
      .then((etablissementId) => {
        // Superadmin (sans école) : changement de plateforme, pour tous.
        if (etablissementId || req.utilisateur?.role === 'superadmin') publier(etablissementId, domaine);
      })
      .catch(() => {});
  });
  return next();
}

async function etablissementDeLaRequete(req) {
  if (req.utilisateur) return req.utilisateur.etablissementId || null;
  // Accès temporaire d'un professeur : l'école de la classe du lien.
  if (req.compteEphemere) {
    const { Classe } = require('../models');
    const classe = await Classe.findByPk(req.compteEphemere.classeId, { attributes: ['etablissementId'] });
    return classe?.etablissementId || null;
  }
  return null;
}

module.exports = { publier, abonner, demarrerEcoute, diffuserModifications };
