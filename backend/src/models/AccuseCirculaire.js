const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Lecture et accusé de réception d'une circulaire par un établissement : le
// Ministère voit qui l'a lue, et quand.
class AccuseCirculaire extends Model {}

AccuseCirculaire.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    circulaireId: { type: DataTypes.INTEGER, allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    lueLe: { type: DataTypes.DATE, allowNull: true },
    accuseLe: { type: DataTypes.DATE, allowNull: true },
    accuseParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  {
    sequelize, modelName: 'AccuseCirculaire', tableName: 'accuses_circulaires',
    indexes: [{ unique: true, fields: ['circulaireId', 'etablissementId'] }],
  }
);

module.exports = AccuseCirculaire;
