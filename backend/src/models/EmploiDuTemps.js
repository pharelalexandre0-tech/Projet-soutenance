const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class EmploiDuTemps extends Model {}

EmploiDuTemps.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jour: { type: DataTypes.STRING, allowNull: false },
    heureDebut: { type: DataTypes.STRING, allowNull: false },
    heureFin: { type: DataTypes.STRING, allowNull: false },
    salle: { type: DataTypes.STRING, allowNull: true },
    matiere: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'EmploiDuTemps', tableName: 'emplois_du_temps' }
);

module.exports = EmploiDuTemps;
