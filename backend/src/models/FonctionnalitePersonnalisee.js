const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Fonctionnalité créée par le superadmin sans écrire de code : une page
// d'information (règlement intérieur, calendrier académique, procédures...)
// ou l'accès à un service en ligne (bibliothèque numérique, plateforme de
// cours, visioconférence...). Elle apparaît comme un onglet de plus dans les
// espaces choisis, uniquement pour les écoles auxquelles on l'ajoute.
class FonctionnalitePersonnalisee extends Model {}

FonctionnalitePersonnalisee.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cle: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('page', 'lien'), allowNull: false },
    nom: { type: DataTypes.STRING(80), allowNull: false },
    description: { type: DataTypes.STRING(300), allowNull: false },
    icone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'FileText' },
    espaces: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    // type 'page' : texte affiché dans l'onglet.
    contenu: { type: DataTypes.TEXT, allowNull: true },
    // type 'lien' : adresse du service et libellé du bouton qui l'ouvre.
    url: { type: DataTypes.STRING(500), allowNull: true },
    libelleBouton: { type: DataTypes.STRING(60), allowNull: true },
    auteurId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'FonctionnalitePersonnalisee', tableName: 'fonctionnalites_personnalisees' }
);

module.exports = FonctionnalitePersonnalisee;
