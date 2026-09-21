const crypto = require('crypto');

// Jeton d'accès temporaire pour les comptes ephemeres (diagramme 4 : Saisie
// des notes via compte ephemere). Genere hors JWT car il doit rester valide
// meme sans session ouverte : le Professeur clique juste un lien recu par
// e-mail.
function genererJetonEphemere() {
  return crypto.randomBytes(24).toString('hex');
}

// Mot de passe temporaire lisible (ex. réinitialisation par l'Académie) —
// même alphabet que le générateur côté frontend (pas de 0/O/1/I/l
// ambigus), mais tiré via crypto.randomInt plutôt que Math.random puisque
// celui-ci finit dans un vrai mot de passe de connexion, pas juste une
// suggestion que l'utilisateur peut changer avant de valider.
function motDePasseAleatoire() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let mot = '';
  for (let i = 0; i < 10; i += 1) mot += alphabet[crypto.randomInt(alphabet.length)];
  return mot;
}

module.exports = { genererJetonEphemere, motDePasseAleatoire };
