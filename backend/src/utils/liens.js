// Adresses des pages publiques du frontend envoyées par e-mail. Si
// EPHEMERE_LIEN_BASE_URL n'est pas renseignée sur l'hébergeur, on repart de
// l'adresse du frontend plutôt que d'envoyer un lien "undefined/…".
const FRONTEND = (process.env.FRONTEND_URL || 'https://edusphere-frontend-pryg.onrender.com').replace(/\/$/, '');
// Adresse publique de l'API (Render la fournit dans RENDER_EXTERNAL_URL) :
// sert aux images des e-mails, qu'un client de messagerie doit pouvoir
// télécharger lui-même.
const BACKEND = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://edusphere-backend-fh30.onrender.com').replace(/\/$/, '');

function baseAccesTemporaire() {
  return (process.env.EPHEMERE_LIEN_BASE_URL || `${FRONTEND}/acces-temporaire`).replace(/\/$/, '');
}

function origineFrontend() {
  try {
    return new URL(baseAccesTemporaire()).origin;
  } catch {
    return FRONTEND;
  }
}

function lienAccesTemporaire(jeton) {
  return `${baseAccesTemporaire()}/${jeton}`;
}

// Même origine que le lien d'accès temporaire : seul le dernier segment de
// chemin change.
function lienReinitialisation(jeton) {
  return `${baseAccesTemporaire().replace(/\/[^/]*$/, '/reinitialiser-mot-de-passe')}/${jeton}`;
}

function lienPlateforme() {
  return `${origineFrontend()}/`;
}

// Logo de l'établissement servi en image (les messageries bloquent les
// images intégrées en data URI) ; celui d'EduSphere est un fichier statique
// du frontend.
function urlLogoEtablissement(etablissement) {
  if (!etablissement?.id || !etablissement?.logo) return null;
  const version = String(etablissement.logo.length);
  return `${BACKEND}/api/plateforme/etablissements/${etablissement.id}/logo?v=${version}`;
}

function urlLogoEduSphere() {
  return `${origineFrontend()}/logo-edusphere.png`;
}

module.exports = {
  lienAccesTemporaire, lienReinitialisation, lienPlateforme, urlLogoEtablissement, urlLogoEduSphere,
};
