const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Le Professeur n'a pas de compte permanent (pas de mot de passe, pas de
// login classique) : c'est une fiche geree par l'Academie, utilisee comme
// cible d'un CompteEphemere quand on lui delegue une tache de saisie.
class Professeur extends Model {}

Professeur.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    matiere: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'Professeur', tableName: 'professeurs' }
);

module.exports = Professeur;
