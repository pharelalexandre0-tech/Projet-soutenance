const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Absence extends Model {}

Absence.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    // Distinct de "justifie" : un retard peut lui aussi être justifié ou
    // non, indépendamment du fait que ce soit une absence complète ou un
    // simple retard en début de cours.
    type: { type: DataTypes.ENUM('absence', 'retard'), allowNull: false, defaultValue: 'absence' },
    justifie: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    motif: { type: DataTypes.STRING, allowNull: true },
    cours: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'Absence', tableName: 'absences' }
);

module.exports = Absence;
