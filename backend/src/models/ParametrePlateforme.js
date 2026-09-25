const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Réglages globaux de la plateforme, un par clé ('annonce', 'maintenance') :
// ils ne concernent aucune école en particulier, d'où une simple table
// clé/valeur plutôt qu'une colonne de plus sur Etablissement.
class ParametrePlateforme extends Model {}

ParametrePlateforme.init(
  {
    cle: { type: DataTypes.STRING, primaryKey: true },
    valeur: { type: DataTypes.JSON, allowNull: true },
  },
  { sequelize, modelName: 'ParametrePlateforme', tableName: 'parametres_plateforme' }
);

module.exports = ParametrePlateforme;
