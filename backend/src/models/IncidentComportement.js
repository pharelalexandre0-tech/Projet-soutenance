const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Troisième signal du module IA (notes, absences, comportement) — jusqu'ici
// seuls les deux premiers existaient réellement dans le calcul de risque.
class IncidentComportement extends Model {}

IncidentComportement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    gravite: { type: DataTypes.ENUM('mineur', 'majeur'), allowNull: false, defaultValue: 'mineur' },
    // Date à laquelle le parent a été prévenu (notification et e-mail).
    parentInformeLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'IncidentComportement', tableName: 'incidents_comportement' }
);

module.exports = IncidentComportement;
