const { Etablissement } = require('../models');

// EduSphere héberge plusieurs écoles : il n'y a jamais de nom d'établissement
// codé en dur, seulement la fiche de l'établissement AUQUEL APPARTIENT
// l'utilisateur connecté — jamais "le premier établissement du système",
// sinon deux écoles verraient le même en-tête sur leurs documents.
async function obtenirEtablissementDe(etablissementId) {
  if (!etablissementId) return null;
  return Etablissement.findByPk(etablissementId);
}

module.exports = { obtenirEtablissementDe };
