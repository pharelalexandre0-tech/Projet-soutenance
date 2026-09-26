const LONGUEUR_MIN = 6;

// Le HTML `minLength` sur les formulaires ne protège que le navigateur —
// n'importe qui peut appeler l'API directement (curl, Postman) et poser un
// mot de passe d'un caractère. Chaque point de création/changement de mot
// de passe doit donc revalider côté serveur avec la même règle.
function erreurMotDePasseInvalide(motDePasse) {
  if (!motDePasse || motDePasse.length < LONGUEUR_MIN) {
    return `le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`;
  }
  return null;
}

module.exports = { erreurMotDePasseInvalide };
