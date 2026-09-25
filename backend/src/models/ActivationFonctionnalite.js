const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Une fonctionnalité (module intégré ou personnalisée, repérée par sa clé)
// ajoutée à une école précise. Pas de ligne = l'école ne l'a pas : chaque
// école ne reçoit que ce dont elle a besoin.
class ActivationFonctionnalite extends Model {}

ActivationFonctionnalite.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    cle: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: 'ActivationFonctionnalite',
    tableName: 'activations_fonctionnalites',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['etablissementId', 'cle'] }],
  }
);

module.exports = ActivationFonctionnalite;
