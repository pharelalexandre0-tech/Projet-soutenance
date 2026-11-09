const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Saisies faites hors ligne puis envoyées au retour du réseau : chaque envoi
// porte une clé unique. Si le serveur l'a déjà traitée (réponse perdue en
// route), la même réponse est rendue sans rien enregistrer deux fois.
class RequeteIdempotente extends Model {}

RequeteIdempotente.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cle: { type: DataTypes.STRING(80), allowNull: false },
    route: { type: DataTypes.STRING(160), allowNull: false },
    statut: { type: DataTypes.INTEGER, allowNull: false },
    reponse: { type: DataTypes.JSONB, allowNull: true },
  },
  { sequelize, modelName: 'RequeteIdempotente', tableName: 'requetes_idempotentes', indexes: [{ unique: true, fields: ['cle', 'route'] }] }
);

module.exports = RequeteIdempotente;
