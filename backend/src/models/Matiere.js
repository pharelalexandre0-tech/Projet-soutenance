const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Une Matiere (ex. Python, PHP, Java) appartient a une UE : l'UE est le
// regroupement thematique (ex. "Programmation"), la Matiere est le cours
// concret sur lequel une note est donnee.
class Matiere extends Model {}

Matiere.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false },
    intitule: { type: DataTypes.STRING, allowNull: false },
    coefficient: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
  },
  { sequelize, modelName: 'Matiere', tableName: 'matieres' }
);

module.exports = Matiere;
