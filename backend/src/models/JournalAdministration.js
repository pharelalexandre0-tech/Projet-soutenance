const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Traçabilité des actions du superadmin (qui a suspendu telle école, ouvert
// tel module, déclenché une maintenance...). Uniquement des actions sur la
// plateforme elle-même : jamais le contenu d'une école. Le nom de l'auteur
// est recopié au moment de l'action pour que l'entrée reste lisible même si
// son compte disparaît ensuite.
class JournalAdministration extends Model {}

JournalAdministration.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    auteurId: { type: DataTypes.INTEGER, allowNull: true },
    auteurNom: { type: DataTypes.STRING, allowNull: false },
    categorie: { type: DataTypes.STRING(30), allowNull: false },
    libelle: { type: DataTypes.STRING(400), allowNull: false },
  },
  { sequelize, modelName: 'JournalAdministration', tableName: 'journal_administration', updatedAt: false }
);

module.exports = JournalAdministration;
