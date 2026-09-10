const crypto = require('crypto');

// Jeton d'accès temporaire pour les comptes ephemeres (diagramme 4 : Saisie
// des notes via compte ephemere). Genere hors JWT car il doit rester valide
// meme sans session ouverte : le Professeur clique juste un lien recu par
// e-mail.
function genererJetonEphemere() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { genererJetonEphemere };
