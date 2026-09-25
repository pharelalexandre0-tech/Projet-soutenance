const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// État d'ouverture d'un module du catalogue (config/fonctionnalites.js).
// Une seule ligne par module, créée au premier réglage du superadmin : tant
// qu'elle n'existe pas, c'est la portée par défaut du catalogue qui
// s'applique. `ecoles` ne sert qu'en portée 'selection' (écoles pilotes).
class Fonctionnalite extends Model {}

Fonctionnalite.init(
  {
    cle: { type: DataTypes.STRING, primaryKey: true },
    portee: { type: DataTypes.ENUM('toutes', 'selection', 'aucune'), allowNull: false, defaultValue: 'toutes' },
    ecoles: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  },
  { sequelize, modelName: 'Fonctionnalite', tableName: 'fonctionnalites' }
);

module.exports = Fonctionnalite;
