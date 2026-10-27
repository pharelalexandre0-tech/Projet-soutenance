const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Jetons de session : HS256 avec JWT_SECRET, algorithme imposé à la
// vérification (pas de « alg: none » ni de changement d'algorithme).
const OPTIONS_VERIFICATION = { algorithms: ['HS256'], issuer: 'edusphere', audience: 'session' };

function signSession(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: 'edusphere',
    audience: 'session',
  });
}

function verifySession(token) {
  return jwt.verify(token, process.env.JWT_SECRET, OPTIONS_VERIFICATION);
}

// Jeton d'étape (entre le mot de passe et le code de l'application
// d'authentification) : clé dérivée distincte et audience propre, il
// n'ouvre jamais une session à lui seul.
const cleEtape = () => crypto.createHmac('sha256', process.env.JWT_SECRET).update('edusphere:jeton-etape:v1').digest();

function signEtape(payload, duree = '10m') {
  return jwt.sign(payload, cleEtape(), { algorithm: 'HS256', expiresIn: duree, issuer: 'edusphere', audience: 'etape' });
}

function verifyEtape(token) {
  return jwt.verify(token, cleEtape(), { algorithms: ['HS256'], issuer: 'edusphere', audience: 'etape' });
}

module.exports = { signSession, verifySession, signEtape, verifyEtape };
