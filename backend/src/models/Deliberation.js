const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Séance du jury d'une classe pour un semestre. Tant qu'elle est ouverte,
// le jury peut revoir les décisions calculées ; une fois close, les notes
// de la classe pour ce semestre sont verrouillées et le procès-verbal de
// délibération est un document certifié.
class Deliberation extends Model {}

Deliberation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    classeId: { type: DataTypes.INTEGER, allowNull: false },
    semestreId: { type: DataTypes.INTEGER, allowNull: false },
    statut: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ouverte', validate: { isIn: [['ouverte', 'close']] } },
    dateSeance: { type: DataTypes.DATEONLY, allowNull: true },
    president: { type: DataTypes.STRING(160), allowNull: true },
    membres: { type: DataTypes.TEXT, allowNull: true },
    observations: { type: DataTypes.TEXT, allowNull: true },
    closeLe: { type: DataTypes.DATE, allowNull: true },
    closeParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'Deliberation', tableName: 'deliberations', indexes: [{ unique: true, fields: ['classeId', 'semestreId'] }] }
);

module.exports = Deliberation;
