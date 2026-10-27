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
// 12 caractères dont au moins deux chiffres : conforme à la règle des mots
// de passe du personnel (utils/motDePasse).
function motDePasseAleatoire() {
  const lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const chiffres = '23456789';
  const alphabet = lettres + chiffres;
  const mot = [chiffres[crypto.randomInt(chiffres.length)], chiffres[crypto.randomInt(chiffres.length)], lettres[crypto.randomInt(lettres.length)]];
  while (mot.length < 12) mot.push(alphabet[crypto.randomInt(alphabet.length)]);
  for (let i = mot.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [mot[i], mot[j]] = [mot[j], mot[i]];
  }
  return mot.join('');
}

module.exports = { genererJetonEphemere, motDePasseAleatoire };
