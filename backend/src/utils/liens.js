// Adresses des pages publiques du frontend envoyées par e-mail. Si
// EPHEMERE_LIEN_BASE_URL n'est pas renseignée sur l'hébergeur, on repart de
// l'adresse du frontend plutôt que d'envoyer un lien "undefined/…".
const FRONTEND = (process.env.FRONTEND_URL || 'https://edusphere-frontend-pryg.onrender.com').replace(/\/$/, '');

function baseAccesTemporaire() {
  return (process.env.EPHEMERE_LIEN_BASE_URL || `${FRONTEND}/acces-temporaire`).replace(/\/$/, '');
}

function lienAccesTemporaire(jeton) {
  return `${baseAccesTemporaire()}/${jeton}`;
}

// Même origine que le lien d'accès temporaire : seul le dernier segment de
// chemin change.
function lienReinitialisation(jeton) {
  return `${baseAccesTemporaire().replace(/\/[^/]*$/, '/reinitialiser-mot-de-passe')}/${jeton}`;
}

module.exports = { lienAccesTemporaire, lienReinitialisation };
