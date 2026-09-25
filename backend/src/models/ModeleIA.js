const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Modèles de prédiction entraînés, versionnés : paramètres appris (arbres
// ou coefficients), performances mesurées, importance des caractéristiques
// et valeurs de référence. Un seul modèle est actif à la fois.
class ModeleIA extends Model {}

ModeleIA.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    version: { type: DataTypes.INTEGER, allowNull: false },
    algorithme: { type: DataTypes.STRING(40), allowNull: false },
    actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    caracteristiques: { type: DataTypes.JSON, allowNull: false },
    parametres: { type: DataTypes.JSON, allowNull: false },
    modele: { type: DataTypes.JSON, allowNull: false },
    metriques: { type: DataTypes.JSON, allowNull: false },
    comparaison: { type: DataTypes.JSON, allowNull: false },
    importances: { type: DataTypes.JSON, allowNull: false },
    imputation: { type: DataTypes.JSON, allowNull: false },
    reference: { type: DataTypes.JSON, allowNull: false },
    donnees: { type: DataTypes.JSON, allowNull: false },
    entraineLe: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    dureeMs: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'ModeleIA', tableName: 'modeles_ia' }
);

module.exports = ModeleIA;
