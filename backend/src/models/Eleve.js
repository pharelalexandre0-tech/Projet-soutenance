const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Eleve extends Model {}

Eleve.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    dateNaissance: { type: DataTypes.DATEONLY, allowNull: true },
    // Numéro d'étudiant attribué automatiquement à l'inscription (sigle de
    // l'établissement, année, numéro d'ordre : ex. CDP-2026-0001). Sert
    // aussi de mot de passe au compte étudiant, qui ne peut pas le changer.
    matricule: { type: DataTypes.STRING(30), allowNull: true, unique: true },
  },
  { sequelize, modelName: 'Eleve', tableName: 'eleves' }
);

module.exports = Eleve;
