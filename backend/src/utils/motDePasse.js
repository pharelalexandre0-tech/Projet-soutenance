const LONGUEUR_MIN = 10;

// Coût bcrypt des mots de passe du personnel (2^12 tours). Les matricules
// des étudiants gardent le coût 10 : ils sont générés par lots de
// centaines à l'import, et ce n'est pas un secret choisi par l'utilisateur.
const COUT_BCRYPT_PERSONNEL = 12;

// Mots de passe que l'on refuse quelle que soit leur longueur : ce sont les
// premiers qu'essaie un attaquant.
const TROP_COURANTS = ['motdepasse', 'password', 'azertyuiop', 'qwertyuiop', '1234567890', '0123456789', 'edusphere', 'administrateur', 'bienvenue', 'gabon2024', 'gabon2025', 'gabon2026'];

// Le HTML `minLength` sur les formulaires ne protège que le navigateur :
// n'importe qui peut appeler l'API directement (curl, Postman) et poser un
// mot de passe d'un caractère. Chaque point de création/changement de mot
// de passe doit donc revalider côté serveur avec la même règle.
function erreurMotDePasseInvalide(motDePasse, { email = '' } = {}) {
  const mdp = String(motDePasse || '');
  if (mdp.length < LONGUEUR_MIN) return `le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`;
  if (mdp.length > 128) return 'le mot de passe ne doit pas dépasser 128 caractères';
  if (!/[A-Za-zÀ-ÿ]/.test(mdp) || !/\d/.test(mdp)) return 'le mot de passe doit mélanger des lettres et des chiffres';
  const simple = mdp.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (TROP_COURANTS.some((m) => simple.startsWith(m)) || /^(.)\1+$/.test(mdp)) return 'ce mot de passe est trop courant, choisissez-en un autre';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && mdp.toLowerCase().includes(local)) return 'le mot de passe ne doit pas contenir votre adresse e-mail';
  return null;
}

module.exports = { erreurMotDePasseInvalide, COUT_BCRYPT_PERSONNEL, LONGUEUR_MIN };
