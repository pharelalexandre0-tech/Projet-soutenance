const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Classe extends Model {}

Classe.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    niveau: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: 'Classe', tableName: 'classes' }
);

module.exports = Classe;
