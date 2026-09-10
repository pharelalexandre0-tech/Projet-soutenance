const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Eleve extends Model {}

Eleve.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    dateNaissance: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { sequelize, modelName: 'Eleve', tableName: 'eleves' }
);

module.exports = Eleve;
