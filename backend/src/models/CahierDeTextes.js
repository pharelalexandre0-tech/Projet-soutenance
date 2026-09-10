const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class CahierDeTextes extends Model {}

CahierDeTextes.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    contenuSeance: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, modelName: 'CahierDeTextes', tableName: 'cahiers_de_textes' }
);

module.exports = CahierDeTextes;
