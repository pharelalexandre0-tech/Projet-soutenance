const { Op } = require('sequelize');
const { signSession } = require('../utils/jwt');
const { ipDe } = require('./auditService');

const DUREE_SESSION_MS = 8 * 60 * 60 * 1000;
// La dernière activité n'est réécrite qu'au plus toutes les 5 minutes.
const RAFRAICHISSEMENT_MS = 5 * 60 * 1000;

// Navigateur et système lisibles (« Chrome sur Windows ») plutôt que la
// chaîne User-Agent brute.
function decrireAppareil(ua = '') {
  const navigateur = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|node|axios/i.test(ua) ? 'Client technique' : 'Navigateur';
  const systeme = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const application = /EduSphereAndroid|; wv\)/.test(ua) ? ' (application)' : '';
  return `${navigateur}${systeme ? ` sur ${systeme}` : ''}${application}`.slice(0, 160);
}

async function ouvrirSession(req, utilisateur, { parent = false, methode = 'mot_de_passe' } = {}) {
  const { SessionUtilisateur } = require('../models');
  const session = await SessionUtilisateur.create({
    utilisateurId: utilisateur.id,
    parent,
    ip: ipDe(req),
    appareil: decrireAppareil(req.headers['user-agent']),
    methode,
    expireLe: new Date(Date.now() + DUREE_SESSION_MS),
  });
  const token = signSession({ id: utilisateur.id, role: utilisateur.role, jti: session.id, ...(parent && { parent: true }) });
  return { token, session };
}

// Appelé à chaque requête authentifiée : la session doit exister, ne pas
// être fermée ni expirée.
async function sessionValide(payload) {
  if (!payload.jti) return null;
  const { SessionUtilisateur } = require('../models');
  const session = await SessionUtilisateur.findByPk(payload.jti);
  if (!session || session.utilisateurId !== payload.id || session.revoqueeLe || session.expireLe < new Date()) return null;
  if (Date.now() - new Date(session.derniereActivite).getTime() > RAFRAICHISSEMENT_MS) {
    session.update({ derniereActivite: new Date() }).catch(() => {});
  }
  return session;
}

async function revoquerSessions(utilisateurId, { sauf = null, motif = 'fermeture' } = {}) {
  const { SessionUtilisateur } = require('../models');
  const where = { utilisateurId, revoqueeLe: null, expireLe: { [Op.gt]: new Date() } };
  if (sauf) where.id = { [Op.ne]: sauf };
  const [n] = await SessionUtilisateur.update({ revoqueeLe: new Date(), motifRevocation: motif }, { where });
  return n;
}

async function sessionsActives(utilisateurId) {
  const { SessionUtilisateur } = require('../models');
  return SessionUtilisateur.findAll({
    where: { utilisateurId, revoqueeLe: null, expireLe: { [Op.gt]: new Date() } },
    order: [['derniereActivite', 'DESC']],
  });
}

module.exports = { ouvrirSession, sessionValide, revoquerSessions, sessionsActives, decrireAppareil };
