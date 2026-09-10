const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Paiement extends Model {}

Paiement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    montant: { type: DataTypes.FLOAT, allowNull: false },
    datePaiement: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    modePaiement: {
      type: DataTypes.ENUM('especes', 'mobile_money', 'virement'),
      allowNull: false,
    },
    statut: {
      type: DataTypes.ENUM('valide', 'invalide'),
      allowNull: false,
      defaultValue: 'valide',
    },
  },
  { sequelize, modelName: 'Paiement', tableName: 'paiements' }
);

module.exports = Paiement;
