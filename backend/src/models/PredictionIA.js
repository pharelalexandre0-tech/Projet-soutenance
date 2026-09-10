const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class PredictionIA extends Model {}

PredictionIA.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scoreRisque: { type: DataTypes.FLOAT, allowNull: false },
    niveauRisque: {
      type: DataTypes.ENUM('faible', 'moyen', 'eleve'),
      allowNull: false,
    },
    dateCalcul: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    facteursCles: { type: DataTypes.TEXT, allowNull: true },
    alerteGeneree: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: 'PredictionIA', tableName: 'predictions_ia' }
);

module.exports = PredictionIA;
