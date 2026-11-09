const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Paiement mobile money demandé par un étudiant ou son parent. Il devient un
// vrai Paiement (avec reçu certifié) seulement une fois confirmé par le
// fournisseur. « fournisseur = test » : mode test, aucun argent n'est débité.
class PaiementEnLigne extends Model {}

PaiementEnLigne.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    fraisId: { type: DataTypes.INTEGER, allowNull: false },
    montant: { type: DataTypes.FLOAT, allowNull: false },
    operateur: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [['airtel', 'moov']] } },
    telephone: { type: DataTypes.STRING(20), allowNull: false },
    fournisseur: { type: DataTypes.STRING(30), allowNull: false },
    referenceFournisseur: { type: DataTypes.STRING(120), allowNull: true },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'en_attente', validate: { isIn: [['en_attente', 'reussi', 'echoue', 'expire']] } },
    message: { type: DataTypes.STRING(255), allowNull: true },
    paiementId: { type: DataTypes.INTEGER, allowNull: true },
    initieParId: { type: DataTypes.INTEGER, allowNull: true },
    initieParParent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: 'PaiementEnLigne', tableName: 'paiements_en_ligne', indexes: [{ fields: ['etablissementId'] }, { fields: ['eleveId'] }] }
);

module.exports = PaiementEnLigne;
