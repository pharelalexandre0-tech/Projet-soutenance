const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Parcours d'un étudiant d'une année à l'autre : classe quittée, décision
// de fin d'année (passage, redoublement, sortie) et classe d'arrivée.
class ParcoursEleve extends Model {}

ParcoursEleve.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    anneeScolaire: { type: DataTypes.STRING(20), allowNull: true },
    classeDepart: { type: DataTypes.STRING(160), allowNull: true },
    niveauDepart: { type: DataTypes.STRING(60), allowNull: true },
    decision: { type: DataTypes.STRING(15), allowNull: false, validate: { isIn: [['passage', 'redoublement', 'sortie']] } },
    classeArriveeId: { type: DataTypes.INTEGER, allowNull: true },
    classeArrivee: { type: DataTypes.STRING(160), allowNull: true },
    moyenneAnnuelle: { type: DataTypes.FLOAT, allowNull: true },
    decideParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'ParcoursEleve', tableName: 'parcours_eleves', indexes: [{ fields: ['eleveId'] }] }
);

module.exports = ParcoursEleve;
