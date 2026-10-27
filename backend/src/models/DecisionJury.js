const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Décision du jury pour un étudiant : la décision calculée par les règles
// de validation, et celle retenue par le jury (identique, ou « admis par
// décision du jury » avec un motif). Jamais « ajourné » : un semestre non
// validé mène au rattrapage.
class DecisionJury extends Model {}

DecisionJury.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deliberationId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    decisionCalculee: { type: DataTypes.STRING(15), allowNull: false },
    decision: { type: DataTypes.STRING(15), allowNull: false, validate: { isIn: [['admis', 'admis_jury', 'rattrapage']] } },
    motif: { type: DataTypes.STRING(300), allowNull: true },
    moyenne: { type: DataTypes.FLOAT, allowNull: true },
    creditsValides: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'DecisionJury', tableName: 'decisions_jury', indexes: [{ unique: true, fields: ['deliberationId', 'eleveId'] }] }
);

module.exports = DecisionJury;
