const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class FraisScolarite extends Model {}

FraisScolarite.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    libelle: { type: DataTypes.STRING, allowNull: false },
    montant: { type: DataTypes.FLOAT, allowNull: false },
    montantRegle: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    dateEcheance: { type: DataTypes.DATEONLY, allowNull: false },
    statut: {
      type: DataTypes.ENUM('du', 'partiel', 'solde', 'impaye'),
      allowNull: false,
      defaultValue: 'du',
    },
  },
  { sequelize, modelName: 'FraisScolarite', tableName: 'frais_scolarite' }
);

module.exports = FraisScolarite;
