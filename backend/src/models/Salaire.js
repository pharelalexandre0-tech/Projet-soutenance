const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Salaire extends Model {}

Salaire.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    montant: { type: DataTypes.FLOAT, allowNull: false },
    periode: { type: DataTypes.STRING, allowNull: false },
    statut: { type: DataTypes.ENUM('prevu', 'verse'), allowNull: false, defaultValue: 'prevu' },
    dateVersement: { type: DataTypes.DATEONLY, allowNull: true },
    fichierPDF: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'Salaire', tableName: 'salaires' }
);

module.exports = Salaire;
