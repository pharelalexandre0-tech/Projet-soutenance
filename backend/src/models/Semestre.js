const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Semestre extends Model {}

Semestre.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Deux cycles peuvent chacun avoir un "Semestre 1" — cycle+numero est
    // la vraie identité pédagogique, libelle n'est qu'un texte dérivé des
    // deux pour l'affichage (calculé côté serveur, jamais saisi à la main).
    cycle: { type: DataTypes.ENUM('licence', 'master', 'doctorat'), allowNull: false, defaultValue: 'licence' },
    numero: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1, max: 8 } },
    libelle: { type: DataTypes.STRING, allowNull: false },
    anneeScolaire: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: 'Semestre', tableName: 'semestres' }
);

module.exports = Semestre;
