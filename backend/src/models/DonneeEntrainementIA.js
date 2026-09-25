const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Base d'apprentissage du modèle de prédiction : un parcours d'élève par
// ligne (signaux observés en cours de semestre) et son issue connue
// (1 = semestre non validé, 0 = validé). Origine « historique_simule » pour
// la cohorte de référence, « etablissement » pour les dossiers réels.
class DonneeEntrainementIA extends Model {}

DonneeEntrainementIA.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    origine: { type: DataTypes.STRING(30), allowNull: false },
    caracteristiques: { type: DataTypes.JSON, allowNull: false },
    etiquette: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: true },
    semestreId: { type: DataTypes.INTEGER, allowNull: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'DonneeEntrainementIA', tableName: 'donnees_entrainement_ia' }
);

module.exports = DonneeEntrainementIA;
