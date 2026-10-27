const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Journal d'audit infalsifiable : chaque entrée contient l'empreinte de la
// précédente (chaînage SHA-256, comme un registre). Supprimer, modifier ou
// insérer une ligne après coup casse la chaîne à cet endroit, ce que la
// vérification signale (services/auditService.verifierChaine).
class JournalAudit extends Model {}

JournalAudit.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    horodatage: { type: DataTypes.DATE, allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: true },
    utilisateurId: { type: DataTypes.INTEGER, allowNull: true },
    role: { type: DataTypes.STRING(20), allowNull: true },
    // Nom affiché au moment des faits (le compte peut changer de nom ou
    // disparaître ensuite).
    auteur: { type: DataTypes.STRING(160), allowNull: true },
    action: { type: DataTypes.STRING(60), allowNull: false },
    cible: { type: DataTypes.STRING(200), allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    empreintePrecedente: { type: DataTypes.STRING(64), allowNull: false },
    empreinte: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'JournalAudit',
    tableName: 'journal_audit',
    timestamps: false,
    indexes: [{ fields: ['etablissementId', 'id'] }, { fields: ['action'] }],
  }
);

module.exports = JournalAudit;
