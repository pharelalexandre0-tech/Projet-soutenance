const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Réclamation d'un étudiant (ou de son parent) sur une note. L'Académie
// l'accepte (et corrige la note, ancienne et nouvelle valeur gardées) ou
// la rejette, toujours avec une réponse motivée.
class ReclamationNote extends Model {}

ReclamationNote.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    matiereId: { type: DataTypes.INTEGER, allowNull: false },
    categorie: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['cc', 'examen']] } },
    session: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'normale' },
    motif: { type: DataTypes.TEXT, allowNull: false },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'en_attente', validate: { isIn: [['en_attente', 'acceptee', 'rejetee']] } },
    reponse: { type: DataTypes.TEXT, allowNull: true },
    ancienneValeur: { type: DataTypes.FLOAT, allowNull: true },
    nouvelleValeur: { type: DataTypes.FLOAT, allowNull: true },
    deposeeParParent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    traiteeParNom: { type: DataTypes.STRING(160), allowNull: true },
    traiteeLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'ReclamationNote', tableName: 'reclamations_notes', indexes: [{ fields: ['etablissementId', 'statut'] }] }
);

module.exports = ReclamationNote;
