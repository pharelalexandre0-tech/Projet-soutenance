const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Historique des décisions d'agrément prises par le Ministère pour un
// établissement (agrément, provisoire, suspension, retrait...), avec le
// motif et l'agent qui a signé. Jamais modifié après coup : une nouvelle
// décision s'ajoute.
class DecisionAgrement extends Model {}

DecisionAgrement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    statut: { type: DataTypes.STRING(20), allowNull: false },
    numero: { type: DataTypes.STRING(60), allowNull: true },
    dateEffet: { type: DataTypes.DATEONLY, allowNull: false },
    dateExpiration: { type: DataTypes.DATEONLY, allowNull: true },
    motif: { type: DataTypes.TEXT, allowNull: false },
    decideParId: { type: DataTypes.INTEGER, allowNull: true },
    decideParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'DecisionAgrement', tableName: 'decisions_agrement', indexes: [{ fields: ['etablissementId'] }] }
);

module.exports = DecisionAgrement;
