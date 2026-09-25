const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Journal des e-mails envoyés par la plateforme (diagnostic du superadmin).
// L'adresse n'y est jamais stockée en clair : seulement sa version masquée.
class JournalEmail extends Model {}

JournalEmail.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    destinataire: { type: DataTypes.STRING, allowNull: false },
    sujet: { type: DataTypes.STRING(300), allowNull: false },
    service: { type: DataTypes.STRING(30), allowNull: false },
    statut: { type: DataTypes.ENUM('envoye', 'simule', 'echec'), allowNull: false },
    erreurs: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  },
  { sequelize, modelName: 'JournalEmail', tableName: 'journal_emails' }
);

module.exports = JournalEmail;
