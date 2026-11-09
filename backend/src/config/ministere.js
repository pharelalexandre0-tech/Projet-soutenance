// Identité du ministère de tutelle, imprimée sur ses documents officiels et
// affichée dans son espace. Modifiable par variables d'environnement si
// l'intitulé change lors d'un remaniement, sans toucher au code.
const MINISTERE = {
  nom: process.env.MINISTERE_NOM || "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
  sigle: process.env.MINISTERE_SIGLE || 'MESRS',
  devise: 'Union · Travail · Justice',
  ville: 'Libreville',
  pays: 'République Gabonaise',
};

module.exports = { MINISTERE };
