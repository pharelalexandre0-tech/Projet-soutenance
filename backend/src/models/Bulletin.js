const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Bulletin extends Model {}

Bulletin.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    moyenneGenerale: { type: DataTypes.FLOAT, allowNull: false },
    creditsValides: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    dateGeneration: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    statut: { type: DataTypes.ENUM('genere', 'envoye'), allowNull: false, defaultValue: 'genere' },
    fichierPDF: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'Bulletin', tableName: 'bulletins' }
);

module.exports = Bulletin;
