const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Ce qu'un professeur a envoyé depuis son accès temporaire, tel quel : la
// feuille d'appel complète (présents compris) ou la liste des notes saisies.
// Copie figée, consultable par l'Académie même si les notes ou absences
// sont modifiées ensuite, ou si le professeur est retiré.
class CompteRenduSaisie extends Model {}

CompteRenduSaisie.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tache: { type: DataTypes.ENUM('saisie_notes', 'saisie_absences'), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    professeurNom: { type: DataTypes.STRING, allowNull: true },
    classeNom: { type: DataTypes.STRING, allowNull: true },
    matiereNom: { type: DataTypes.STRING, allowNull: true },
    categorie: { type: DataTypes.STRING(10), allowNull: true },
    evaluationLibelle: { type: DataTypes.STRING, allowNull: true },
    // Appel : { presents, absents, retards }. Notes : { saisies, moyenne, min, max }.
    resume: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    // Appel : [{ eleveId, nom, prenom, matricule, statut }]. Notes : [{ eleveId, nom, prenom, matricule, valeur }].
    lignes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    envoyeLe: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'CompteRenduSaisie', tableName: 'comptes_rendus_saisie' }
);

module.exports = CompteRenduSaisie;
