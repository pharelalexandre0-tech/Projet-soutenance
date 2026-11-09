const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Référentiel national des règles LMD publié par le Ministère : seuil,
// note éliminatoire, compensation, passage avec dette, avec la référence du
// texte officiel. Chaque publication est une nouvelle version ; les
// établissements l'adoptent ou gardent leurs propres valeurs.
class RegleNationale extends Model {}

RegleNationale.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    version: { type: DataTypes.INTEGER, allowNull: false },
    seuilValidation: { type: DataTypes.FLOAT, allowNull: false },
    noteEliminatoire: { type: DataTypes.FLOAT, allowNull: false },
    compensationActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    noteMinCompensation: { type: DataTypes.FLOAT, allowNull: true },
    passageDetteActif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    creditsMinPassagePct: { type: DataTypes.FLOAT, allowNull: true },
    texteReference: { type: DataTypes.STRING(200), allowNull: false },
    commentaire: { type: DataTypes.TEXT, allowNull: true },
    publieParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'RegleNationale', tableName: 'regles_nationales', indexes: [{ unique: true, fields: ['version'] }] }
);

module.exports = RegleNationale;
