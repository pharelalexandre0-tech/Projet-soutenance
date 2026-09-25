const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Note de version publiée par le superadmin : ce qui a changé dans EduSphere,
// présenté aux utilisateurs dans la fenêtre "Nouveautés" de leur espace.
// `espaces` restreint la note aux rôles concernés (une nouveauté Finance n'a
// rien à dire à un étudiant) ; vide = tout le monde.
class MiseAJour extends Model {}

MiseAJour.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    version: { type: DataTypes.STRING(20), allowNull: false },
    titre: { type: DataTypes.STRING(140), allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('nouveaute', 'amelioration', 'correctif'), allowNull: false, defaultValue: 'nouveaute' },
    statut: { type: DataTypes.ENUM('brouillon', 'publiee'), allowNull: false, defaultValue: 'brouillon' },
    publieeLe: { type: DataTypes.DATE, allowNull: true },
    espaces: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    auteurId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'MiseAJour', tableName: 'mises_a_jour' }
);

module.exports = MiseAJour;
