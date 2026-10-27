const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Actes de tutelle du Ministère de l'Enseignement supérieur, au-delà de
// l'agrément : habilitation des formations, inspections et leurs
// recommandations, calendrier universitaire national.

// Offre de formation habilitée (licence, master, doctorat) d'un
// établissement, par arrêté, pour une durée donnée.
class HabilitationFormation extends Model {}
HabilitationFormation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    cycle: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['licence', 'master', 'doctorat']] } },
    domaine: { type: DataTypes.STRING(160), allowNull: false },
    mention: { type: DataTypes.STRING(160), allowNull: false },
    specialite: { type: DataTypes.STRING(160), allowNull: true },
    numeroArrete: { type: DataTypes.STRING(80), allowNull: true },
    dateDebut: { type: DataTypes.DATEONLY, allowNull: false },
    dateFin: { type: DataTypes.DATEONLY, allowNull: true },
    statut: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'habilitee', validate: { isIn: [['habilitee', 'en_renouvellement', 'suspendue', 'retiree']] } },
    observations: { type: DataTypes.TEXT, allowNull: true },
    decideParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'HabilitationFormation', tableName: 'habilitations_formations', indexes: [{ fields: ['etablissementId'] }] }
);

// Mission d'inspection dans un établissement : programmation, rapport,
// avis et recommandations dont le Ministère suit la mise en œuvre.
class Inspection extends Model {}
Inspection.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    nature: { type: DataTypes.STRING(16), allowNull: false, validate: { isIn: [['pedagogique', 'administrative', 'financiere', 'conformite']] } },
    objet: { type: DataTypes.STRING(300), allowNull: false },
    inspecteurs: { type: DataTypes.STRING(300), allowNull: false },
    datePrevue: { type: DataTypes.DATEONLY, allowNull: false },
    dateRealisee: { type: DataTypes.DATEONLY, allowNull: true },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'programmee', validate: { isIn: [['programmee', 'realisee', 'cloturee', 'annulee']] } },
    constats: { type: DataTypes.TEXT, allowNull: true },
    avis: { type: DataTypes.STRING(12), allowNull: true, validate: { isIn: [['favorable', 'reserves', 'defavorable']] } },
    creeParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'Inspection', tableName: 'inspections', indexes: [{ fields: ['etablissementId'] }] }
);

class RecommandationInspection extends Model {}
RecommandationInspection.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    inspectionId: { type: DataTypes.INTEGER, allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    texte: { type: DataTypes.TEXT, allowNull: false },
    echeance: { type: DataTypes.DATEONLY, allowNull: true },
    statut: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'a_faire', validate: { isIn: [['a_faire', 'en_cours', 'realisee']] } },
    reponse: { type: DataTypes.TEXT, allowNull: true },
    reponduLe: { type: DataTypes.DATE, allowNull: true },
    reponduParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'RecommandationInspection', tableName: 'recommandations_inspection', indexes: [{ fields: ['etablissementId'] }, { fields: ['inspectionId'] }] }
);

// Calendrier universitaire national : périodes fixées par le Ministère
// pour une année universitaire, publiées à tous les établissements.
class EvenementCalendrier extends Model {}
EvenementCalendrier.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    anneeUniversitaire: { type: DataTypes.STRING(9), allowNull: false },
    nature: { type: DataTypes.STRING(14), allowNull: false, validate: { isIn: [['rentree', 'cours', 'examens', 'deliberations', 'rattrapage', 'vacances', 'autre']] } },
    libelle: { type: DataTypes.STRING(200), allowNull: false },
    dateDebut: { type: DataTypes.DATEONLY, allowNull: false },
    dateFin: { type: DataTypes.DATEONLY, allowNull: true },
    publieLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'EvenementCalendrier', tableName: 'calendrier_national', indexes: [{ fields: ['anneeUniversitaire'] }] }
);

class AccuseCalendrier extends Model {}
AccuseCalendrier.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    anneeUniversitaire: { type: DataTypes.STRING(9), allowNull: false },
    accuseLe: { type: DataTypes.DATE, allowNull: false },
    accuseParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'AccuseCalendrier', tableName: 'accuses_calendrier', indexes: [{ unique: true, fields: ['etablissementId', 'anneeUniversitaire'] }] }
);

module.exports = { HabilitationFormation, Inspection, RecommandationInspection, EvenementCalendrier, AccuseCalendrier };
