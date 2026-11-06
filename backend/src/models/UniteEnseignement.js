const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Unite d'Enseignement (systeme LMD) - appelee ListeEnseignement / UE dans
// le diagramme de classes.
class UniteEnseignement extends Model {}

UniteEnseignement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false },
    intitule: { type: DataTypes.STRING, allowNull: false },
    credits: { type: DataTypes.INTEGER, allowNull: false },
    coefficient: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
  },
  {
    sequelize, modelName: 'UniteEnseignement', tableName: 'unites_enseignement',
    indexes: [{ unique: true, name: 'ue_semestre_code_formation', fields: ['semestreId', 'code', 'formationId'] }],
  }
);

module.exports = UniteEnseignement;
