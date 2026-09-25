const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Version publiée de l'emploi du temps d'une classe. L'Académie compose sa
// grille librement (brouillon : table emplois_du_temps) ; les étudiants et
// les parents ne voient que la copie figée ici au moment de la publication,
// et sont prévenus à chaque nouvelle publication.
class PublicationEmploiDuTemps extends Model {}

PublicationEmploiDuTemps.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // [{ jour, heureDebut, heureFin, matiere, salle }]
    creneaux: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    publieLe: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    nbDestinataires: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  { sequelize, modelName: 'PublicationEmploiDuTemps', tableName: 'publications_emplois_du_temps' }
);

module.exports = PublicationEmploiDuTemps;
