const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Formation (maquette) d'une école : une mention, éventuellement un parcours,
// dans un cycle. Les classes et les UE s'y rattachent ; une UE sans formation
// reste commune à toutes les classes de l'école.
class Formation extends Model {}

Formation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    cycle: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'licence', validate: { isIn: [['licence', 'master', 'doctorat']] } },
    domaine: { type: DataTypes.STRING(160), allowNull: true },
    mention: { type: DataTypes.STRING(160), allowNull: false },
    parcours: { type: DataTypes.STRING(160), allowNull: true },
    // Crédits à réunir pour obtenir le diplôme (180 en licence, 120 en master
    // par défaut ; 120 pour un DUT, par exemple).
    creditsRequis: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 180, validate: { min: 1, max: 600 } },
  },
  { sequelize, modelName: 'Formation', tableName: 'formations', indexes: [{ fields: ['etablissementId'] }] }
);

module.exports = Formation;
