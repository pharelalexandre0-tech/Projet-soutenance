const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Modules LMD complémentaires : préinscription en ligne, anonymat des copies,
// mémoires et soutenances, diplômes, transferts de crédits.

// Dossier de candidature déposé en ligne par un futur étudiant.
class Preinscription extends Model {}
Preinscription.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    numero: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    formationId: { type: DataTypes.INTEGER, allowNull: true },
    niveauDemande: { type: DataTypes.STRING(40), allowNull: false },
    nom: { type: DataTypes.STRING(120), allowNull: false },
    prenom: { type: DataTypes.STRING(120), allowNull: false },
    dateNaissance: { type: DataTypes.DATEONLY, allowNull: true },
    sexe: { type: DataTypes.STRING(1), allowNull: true },
    email: { type: DataTypes.STRING(160), allowNull: false },
    telephone: { type: DataTypes.STRING(30), allowNull: true },
    nationalite: { type: DataTypes.STRING(80), allowNull: true },
    diplomeAcces: { type: DataTypes.STRING(160), allowNull: true },
    anneeDiplome: { type: DataTypes.STRING(9), allowNull: true },
    mentionDiplome: { type: DataTypes.STRING(40), allowNull: true },
    etablissementOrigine: { type: DataTypes.STRING(200), allowNull: true },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'deposee', validate: { isIn: [['deposee', 'en_examen', 'acceptee', 'refusee', 'inscrite']] } },
    commentaire: { type: DataTypes.TEXT, allowNull: true },
    decideParNom: { type: DataTypes.STRING(160), allowNull: true },
    eleveId: { type: DataTypes.INTEGER, allowNull: true },
    // Inscription en ligne après acceptation : classe, frais, lien personnel (empreinte), paiement.
    classeId: { type: DataTypes.INTEGER, allowNull: true },
    fraisInscription: { type: DataTypes.FLOAT, allowNull: true },
    jetonInscription: { type: DataTypes.STRING(64), allowNull: true },
    jetonExpire: { type: DataTypes.DATE, allowNull: true },
    paiementStatut: { type: DataTypes.STRING(12), allowNull: true },
    paiementReference: { type: DataTypes.STRING(40), allowNull: true },
    operateur: { type: DataTypes.STRING(12), allowNull: true },
    telephone2: { type: DataTypes.STRING(20), allowNull: true },
    fournisseur: { type: DataTypes.STRING(30), allowNull: true },
    inscritLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'Preinscription', tableName: 'preinscriptions', indexes: [{ fields: ['etablissementId'] }] }
);

// Pièces du dossier (identité, diplôme, relevé, photo), gardées en base.
class PieceCandidature extends Model {}
PieceCandidature.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    preinscriptionId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [['identite', 'diplome', 'releve', 'photo', 'autre']] } },
    nomFichier: { type: DataTypes.STRING(200), allowNull: false },
    typeMime: { type: DataTypes.STRING(80), allowNull: false },
    taille: { type: DataTypes.INTEGER, allowNull: false },
    contenu: { type: DataTypes.BLOB, allowNull: false },
  },
  { sequelize, modelName: 'PieceCandidature', tableName: 'pieces_candidature', indexes: [{ fields: ['preinscriptionId'] }] }
);

// Numéro d'anonymat d'un étudiant pour l'examen d'une matière et d'une session.
class NumeroAnonymat extends Model {}
NumeroAnonymat.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    matiereId: { type: DataTypes.INTEGER, allowNull: false },
    session: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'normale' },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    numero: { type: DataTypes.STRING(12), allowNull: false },
    leveLe: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize, modelName: 'NumeroAnonymat', tableName: 'numeros_anonymat',
    indexes: [{ unique: true, fields: ['matiereId', 'session', 'eleveId'] }, { unique: true, fields: ['matiereId', 'session', 'numero'] }],
  }
);

// Mémoire, rapport de stage ou thèse : sujet, encadrement, soutenance, résultat.
class Memoire extends Model {}
Memoire.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(16), allowNull: false, validate: { isIn: [['rapport_stage', 'memoire_licence', 'memoire_master', 'these']] } },
    sujet: { type: DataTypes.STRING(400), allowNull: false },
    encadrant: { type: DataTypes.STRING(160), allowNull: true },
    coEncadrant: { type: DataTypes.STRING(160), allowNull: true },
    statut: { type: DataTypes.STRING(22), allowNull: false, defaultValue: 'sujet_valide', validate: { isIn: [['sujet_valide', 'en_redaction', 'depose', 'soutenance_programmee', 'soutenu', 'ajourne']] } },
    dateDepot: { type: DataTypes.DATEONLY, allowNull: true },
    dateSoutenance: { type: DataTypes.DATE, allowNull: true },
    lieu: { type: DataTypes.STRING(160), allowNull: true },
    jury: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    note: { type: DataTypes.FLOAT, allowNull: true },
    mention: { type: DataTypes.STRING(40), allowNull: true },
    observations: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'Memoire', tableName: 'memoires', indexes: [{ fields: ['etablissementId'] }, { fields: ['eleveId'] }] }
);

// Diplôme délivré à la fin d'un cycle (licence, master, doctorat).
class Diplome extends Model {}
Diplome.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    numero: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    cycle: { type: DataTypes.STRING(10), allowNull: false },
    domaine: { type: DataTypes.STRING(160), allowNull: true },
    specialite: { type: DataTypes.STRING(200), allowNull: true },
    moyenne: { type: DataTypes.FLOAT, allowNull: true },
    mentionObtenue: { type: DataTypes.STRING(40), allowNull: true },
    creditsAcquis: { type: DataTypes.INTEGER, allowNull: false },
    anneeObtention: { type: DataTypes.STRING(9), allowNull: true },
    dateDelivrance: { type: DataTypes.DATEONLY, allowNull: false },
    delivreParNom: { type: DataTypes.STRING(160), allowNull: true },
  },
  { sequelize, modelName: 'Diplome', tableName: 'diplomes', indexes: [{ fields: ['etablissementId'] }, { unique: true, fields: ['eleveId', 'cycle'] }] }
);

// Crédits obtenus dans un autre établissement et reconnus (mobilité, transfert).
class CreditExterne extends Model {}
CreditExterne.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    etablissementOrigine: { type: DataTypes.STRING(200), allowNull: false },
    pays: { type: DataTypes.STRING(80), allowNull: true },
    code: { type: DataTypes.STRING(40), allowNull: true },
    intitule: { type: DataTypes.STRING(200), allowNull: false },
    credits: { type: DataTypes.INTEGER, allowNull: false },
    note: { type: DataTypes.FLOAT, allowNull: true },
    cycle: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'licence' },
    numeroSemestre: { type: DataTypes.INTEGER, allowNull: false },
    anneeScolaire: { type: DataTypes.STRING(9), allowNull: true },
    decideParNom: { type: DataTypes.STRING(160), allowNull: true },
    observations: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'CreditExterne', tableName: 'credits_externes', indexes: [{ fields: ['eleveId'] }] }
);

module.exports = { Preinscription, PieceCandidature, NumeroAnonymat, Memoire, Diplome, CreditExterne };
