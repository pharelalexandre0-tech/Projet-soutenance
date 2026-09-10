const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Recu extends Model {}

Recu.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numero: { type: DataTypes.STRING, allowNull: false, unique: true },
    dateEmission: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fichierPDF: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'Recu', tableName: 'recus' }
);

module.exports = Recu;
