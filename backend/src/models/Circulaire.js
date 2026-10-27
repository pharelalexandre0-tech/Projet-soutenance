const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Circulaire du Ministère adressée aux établissements : à tous, ou à une
// sélection (provinces, types d'établissement, établissements précis).
// `cible` : { toutes: true } ou { provinces: [], types: [], etablissements: [] }.
class Circulaire extends Model {}

Circulaire.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    titre: { type: DataTypes.STRING(200), allowNull: false },
    objet: { type: DataTypes.STRING(300), allowNull: true },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    priorite: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'information', validate: { isIn: [['information', 'instruction', 'urgent']] } },
    cible: { type: DataTypes.JSON, allowNull: false, defaultValue: { toutes: true } },
    echeance: { type: DataTypes.DATEONLY, allowNull: true },
    publieeLe: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    auteurId: { type: DataTypes.INTEGER, allowNull: true },
    auteurNom: { type: DataTypes.STRING(160), allowNull: true },
    signataire: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'Circulaire', tableName: 'circulaires' }
);

module.exports = Circulaire;
