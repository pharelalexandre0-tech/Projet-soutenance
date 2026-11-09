const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Avis rendus par la Commission pour l'Enseignement Supérieur Privé (CESP)
// sur un établissement : habilitation à fonder, autorisation d'ouverture,
// renouvellement ou contrôle. Le ministère s'appuie sur cet avis avant de
// proposer le décret. Jamais modifié après coup : un nouvel avis s'ajoute.
class AvisCesp extends Model {}

AvisCesp.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    session: { type: DataTypes.DATEONLY, allowNull: false },
    objet: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [['habilitation', 'autorisation', 'renouvellement', 'controle']] } },
    avis: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [['favorable', 'reserves', 'defavorable']] } },
    observations: { type: DataTypes.TEXT, allowNull: false },
    rapporteur: { type: DataTypes.STRING(160), allowNull: true },
    saisiParId: { type: DataTypes.INTEGER, allowNull: true },
    saisiParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'AvisCesp', tableName: 'avis_cesp', indexes: [{ fields: ['etablissementId'] }] }
);

module.exports = AvisCesp;
