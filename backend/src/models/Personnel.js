const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Registre du personnel (enseignant ou non) pour la paie — distinct de
// Professeur (qui gère l'accès pédagogique via compte éphémère) : ici on ne
// s'intéresse qu'à l'identité et au poste pour la fiche de paie.
class Personnel extends Model {}

Personnel.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    poste: { type: DataTypes.STRING, allowNull: false },
    salaireBase: { type: DataTypes.FLOAT, allowNull: true },
    dateEmbauche: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { sequelize, modelName: 'Personnel', tableName: 'personnel' }
);

module.exports = Personnel;
