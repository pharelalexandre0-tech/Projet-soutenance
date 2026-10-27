const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Dossier de bourse ANBG (Agence nationale des bourses du Gabon) d'un
// étudiant : numéro de boursier, pièces téléversées (PieceBourse), examen
// par l'Académie avant transmission à l'agence.
class DossierBourse extends Model {}

DossierBourse.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eleveId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    numeroBoursier: { type: DataTypes.STRING(40), allowNull: true },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'incomplet', validate: { isIn: [['incomplet', 'soumis', 'a_corriger', 'valide']] } },
    observations: { type: DataTypes.TEXT, allowNull: true },
    soumisLe: { type: DataTypes.DATE, allowNull: true },
    valideLe: { type: DataTypes.DATE, allowNull: true },
    valideParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'DossierBourse', tableName: 'dossiers_bourse', indexes: [{ fields: ['etablissementId', 'statut'] }] }
);

module.exports = DossierBourse;
