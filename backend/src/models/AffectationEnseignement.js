const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Ce qu'enseigne un professeur : une matière, pour une classe donnée (ou
// pour toutes les classes du semestre quand classeId est vide). Gérée par
// l'Académie depuis l'onglet Professeurs.
class AffectationEnseignement extends Model {}

AffectationEnseignement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    professeurId: { type: DataTypes.INTEGER, allowNull: false },
    matiereId: { type: DataTypes.INTEGER, allowNull: false },
    classeId: { type: DataTypes.INTEGER, allowNull: true },
    volumeHoraire: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AffectationEnseignement',
    tableName: 'affectations_enseignement',
    indexes: [{ fields: ['etablissementId'] }, { unique: true, fields: ['professeurId', 'matiereId', 'classeId'] }],
  }
);

module.exports = AffectationEnseignement;
