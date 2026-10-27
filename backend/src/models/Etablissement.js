const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Identité de l'établissement qui utilise la plateforme — une donnée
// paramétrable en base, pas une valeur codée en dur : EduSphere doit
// pouvoir être configuré pour n'importe quelle école au moment de son
// insertion dans le système (voir "Paramètres" côté Académie).
class Etablissement extends Model {}

Etablissement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    sigle: { type: DataTypes.STRING, allowNull: true },
    devise: { type: DataTypes.STRING, allowNull: true },
    ville: { type: DataTypes.STRING, allowNull: false },
    pays: { type: DataTypes.STRING, allowNull: false, defaultValue: 'République Gabonaise' },
    boitePostale: { type: DataTypes.STRING, allowNull: true },
    telephone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    // Stocké en data URI base64 directement en base (pas de stockage
    // fichier séparé à gérer) — un logo d'école reste petit (quelques
    // dizaines de Ko), jamais un flux qui justifierait un vrai stockage
    // objet. Réutilisé sur le bulletin, les reçus et l'emploi du temps PDF.
    logo: { type: DataTypes.TEXT, allowNull: true },
    statut: { type: DataTypes.ENUM('actif', 'suspendu'), allowNull: false, defaultValue: 'actif' },
    // Règles de validation propres à l'école (sur 20) : note à atteindre
    // pour valider une UE (10 en LMD) et note sous laquelle une matière est
    // éliminatoire et bloque son UE (7 par défaut). Réglées dans Paramètres.
    seuilValidation: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 10 },
    noteEliminatoire: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 7 },
    // Dernière fois que l'école a téléchargé l'archive de ses données
    // (Paramètres > Récupérer les données) : vérifié avant toute suppression.
    dernierExportLe: { type: DataTypes.DATE, allowNull: true },
    // Tutelle : Ministère de l'Enseignement supérieur. Province (déduite de
    // la ville, modifiable), type d'établissement et agrément en vigueur ;
    // l'historique des décisions est dans decisions_agrement.
    province: { type: DataTypes.STRING(40), allowNull: true },
    typeEtablissement: {
      type: DataTypes.STRING(30), allowNull: false, defaultValue: 'institut_superieur',
      validate: { isIn: [['universite_publique', 'universite_privee', 'institut_superieur', 'grande_ecole']] },
    },
    agrementStatut: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: 'en_instruction',
      validate: { isIn: [['en_instruction', 'provisoire', 'agree', 'suspendu', 'retire']] },
    },
    agrementNumero: { type: DataTypes.STRING(60), allowNull: true },
    agrementDate: { type: DataTypes.DATEONLY, allowNull: true },
    agrementExpiration: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { sequelize, modelName: 'Etablissement', tableName: 'etablissements' }
);

// Tout logo enregistré est préparé (rogné, centré, 512 px, PNG), quel que
// soit le chemin d'envoi : il remplit ainsi son emplacement partout.
Etablissement.beforeSave((etablissement) => {
  if (!etablissement.logo || !etablissement.changed('logo')) return;
  const { normaliserLogo } = require('../services/logoService');
  try {
    const prepare = normaliserLogo(etablissement.logo);
    if (prepare) etablissement.logo = prepare;
  } catch { /* image illisible : conservée telle quelle */ }
});

module.exports = Etablissement;
