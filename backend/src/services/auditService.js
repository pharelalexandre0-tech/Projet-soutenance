const { sha256 } = require('../utils/chiffrement');

// Journal d'audit chaîné (modèle JournalAudit). L'écriture se fait sous un
// verrou PostgreSQL (pg_advisory_xact_lock) : deux requêtes simultanées ne
// peuvent pas lire la même « dernière empreinte » et fourcher la chaîne.
const VERROU = 718203;
const ORIGINE = '0'.repeat(64);

// Forme canonique d'une entrée : ce qui est haché, champ par champ.
function canonique(e) {
  return JSON.stringify([
    new Date(e.horodatage).toISOString(), e.etablissementId ?? null, e.utilisateurId ?? null, e.role ?? null, e.auteur ?? null,
    e.action, e.cible ?? null, e.details ?? null, e.ip ?? null, e.empreintePrecedente,
  ]);
}

const ipDe = (req) => (req ? String(require('../utils/ipClient').ipClient(req)).slice(0, 64) : null);

// `auteur` : l'utilisateur connecté (req.utilisateur) ou un compte précis
// (connexion, échec de connexion). Ne fait jamais échouer l'action
// journalisée : une panne du journal est signalée dans les logs serveur.
async function journaliserAudit(req, { action, cible = null, details = null, utilisateur = null, etablissementId }) {
  const u = utilisateur || req?.utilisateur || null;
  const { JournalAudit } = require('../models');
  const sequelize = require('../config/db');
  try {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SELECT pg_advisory_xact_lock(${VERROU})`, { transaction });
      const derniere = await JournalAudit.findOne({ order: [['id', 'DESC']], attributes: ['empreinte'], transaction });
      const entree = {
        horodatage: new Date(),
        etablissementId: etablissementId !== undefined ? etablissementId : (u?.etablissementId ?? null),
        utilisateurId: u?.id ?? null,
        role: u?.role ?? null,
        auteur: u ? `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email : null,
        action,
        cible: cible ? String(cible).slice(0, 200) : null,
        details,
        ip: ipDe(req),
        empreintePrecedente: derniere?.empreinte || ORIGINE,
      };
      entree.empreinte = sha256(canonique(entree));
      await JournalAudit.create(entree, { transaction });
    });
  } catch (err) {
    console.error('Journal d\'audit : écriture impossible', err.message);
  }
}

// Relit toute la chaîne. Renvoie { integre, entrees, rupture } où rupture
// désigne la première entrée dont l'empreinte ou le lien ne correspond pas.
async function verifierChaine() {
  const { JournalAudit } = require('../models');
  let precedente = ORIGINE;
  let entrees = 0;
  const TAILLE = 2000;
  for (let decalage = 0; ; decalage += TAILLE) {
    const lot = await JournalAudit.findAll({ order: [['id', 'ASC']], limit: TAILLE, offset: decalage, raw: true });
    for (const e of lot) {
      const attendue = sha256(canonique(e));
      if (e.empreintePrecedente !== precedente || e.empreinte !== attendue) {
        return { integre: false, entrees, rupture: { id: Number(e.id), horodatage: e.horodatage, action: e.action, raison: e.empreintePrecedente !== precedente ? 'lien rompu (entrée supprimée ou insérée)' : 'contenu modifié' } };
      }
      precedente = e.empreinte;
      entrees += 1;
    }
    if (lot.length < TAILLE) break;
  }
  return { integre: true, entrees, rupture: null };
}

// Toute modification réussie (création, modification, suppression) est
// inscrite au journal : qui, quand, depuis quelle adresse, sur quelle
// ressource. Le contenu envoyé n'est jamais recopié (ni notes, ni données
// personnelles), seulement l'adresse de la ressource touchée.
const VERBES = { POST: 'creation', PUT: 'modification', PATCH: 'modification', DELETE: 'suppression' };
// Connexion, mot de passe, sessions : journalisés explicitement par
// authController, avec plus de détails.
const NON_AUDITEES = /^\/api\/((auth|sante|evenements|notifications)(\/|$)|plateforme\/nouveautes)/;

function auditerModifications(req, res, next) {
  if (!VERBES[req.method] || NON_AUDITEES.test(req.originalUrl)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || (!req.utilisateur && !req.compteEphemere)) return;
    const chemin = req.originalUrl.split('?')[0].slice(0, 180);
    const domaine = chemin.split('/')[2] || 'donnees';
    const { etablissementDeLaRequete } = require('./evenementsService');
    etablissementDeLaRequete(req)
      .then((etablissementId) => journaliserAudit(req, {
        action: VERBES[req.method],
        cible: `${req.method} ${chemin}`,
        details: { domaine, ...(req.compteEphemere && { accesTemporaire: req.compteEphemere.id }) },
        etablissementId,
      }))
      .catch(() => {});
  });
  return next();
}

module.exports = { journaliserAudit, verifierChaine, ipDe, auditerModifications };
