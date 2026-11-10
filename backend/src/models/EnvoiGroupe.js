const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Envoi groupé de documents par e-mail (bulletins, relevés, attestations)
// lancé par l'Académie pour plusieurs étudiants à la fois. Le travail se fait
// en arrière-plan ; l'avancement et le compte rendu par étudiant sont gardés
// ici pour être suivis à l'écran et relus plus tard.
class EnvoiGroupe extends Model {}

EnvoiGroupe.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    document: { type: DataTypes.STRING(30), allowNull: false },
    libelle: { type: DataTypes.STRING(200), allowNull: false },
    total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    traites: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    envoyes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    echecs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // [{ eleveId, nom, statut: 'envoye' | 'ignore' | 'echec', message }]
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'en_cours' },
    creeParId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'EnvoiGroupe', tableName: 'envois_groupes', indexes: [{ fields: ['etablissementId'] }] }
);

module.exports = EnvoiGroupe;
