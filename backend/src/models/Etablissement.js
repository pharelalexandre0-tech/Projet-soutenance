const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Identité de l'établissement qui utilise la plateforme — une donnée
// paramétrable en base, pas une valeur codée en dur : EduSphere doit
// pouvoir être configuré pour n'importe quelle école au moment de son
// insertion dans le système (voir "Paramètres" côté Académie).
class Etablissement extends Model {}

Etablissement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    sigle: { type: DataTypes.STRING, allowNull: true },
    devise: { type: DataTypes.STRING, allowNull: true },
    ville: { type: DataTypes.STRING, allowNull: false },
    pays: { type: DataTypes.STRING, allowNull: false, defaultValue: 'République Gabonaise' },
    boitePostale: { type: DataTypes.STRING, allowNull: true },
    telephone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    statut: { type: DataTypes.ENUM('actif', 'suspendu'), allowNull: false, defaultValue: 'actif' },
  },
  { sequelize, modelName: 'Etablissement', tableName: 'etablissements' }
);

module.exports = Etablissement;
