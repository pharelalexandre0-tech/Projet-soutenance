const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Semestre extends Model {}

Semestre.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    libelle: { type: DataTypes.STRING, allowNull: false },
    anneeScolaire: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: 'Semestre', tableName: 'semestres' }
);

module.exports = Semestre;
