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
    // Compensation entre UE d'un semestre et passage avec dette : choix de
    // l'école, désactivés tant qu'elle ne les a pas réglés.
    compensationActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    noteMinCompensation: { type: DataTypes.FLOAT, allowNull: true },
    passageDetteActif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    creditsMinPassagePct: { type: DataTypes.FLOAT, allowNull: true },
    // Dernière fois que l'école a téléchargé l'archive de ses données
    // (Paramètres > Récupérer les données) : vérifié avant toute suppression.
    dernierExportLe: { type: DataTypes.DATE, allowNull: true },
    // Abonnement et quotas fixés par le superadmin (vides = sans limite).
    // À la date de fin dépassée, l'école perd l'accès comme si elle était suspendue.
    quotaEtudiants: { type: DataTypes.INTEGER, allowNull: true },
    quotaPersonnel: { type: DataTypes.INTEGER, allowNull: true },
    abonnementOffre: { type: DataTypes.STRING(80), allowNull: true },
    abonnementFin: { type: DataTypes.DATEONLY, allowNull: true },
    // Tutelle : Ministère de l'Enseignement supérieur. Province (déduite de
    // la ville, modifiable), type d'établissement et agrément en vigueur ;
    // l'historique des décisions est dans decisions_agrement.
    province: { type: DataTypes.STRING(40), allowNull: true },
    typeEtablissement: {
      type: DataTypes.STRING(30), allowNull: false, defaultValue: 'institut_superieur',
      validate: { isIn: [['universite_publique', 'universite_privee', 'institut_superieur', 'grande_ecole']] },
    },
    agrementStatut: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: 'dossier_depose',
      validate: { isIn: [['dossier_depose', 'habilite', 'autorise', 'cree_par_texte', 'mise_en_demeure', 'suspendu', 'ferme']] },
    },
    agrementNumero: { type: DataTypes.STRING(60), allowNull: true },
    agrementDate: { type: DataTypes.DATEONLY, allowNull: true },
    agrementExpiration: { type: DataTypes.DATEONLY, allowNull: true },
    // Grille de conformité tenue par le ministère (convention avec l'État,
    // quitus fiscal, locaux, équipements, capacité d'accueil...).
    conformite: { type: DataTypes.JSONB, allowNull: true },
    // Style des documents officiels propre à l'école (Paramètres) : modèle de
    // mise en page et couleur d'accent ; vide = marine EduSphere.
    modeleDocuments: {
      type: DataTypes.STRING(20), allowNull: true,
      validate: { isIn: [['classique', 'moderne', 'prestige']] },
    },
    couleurDocuments: { type: DataTypes.STRING(7), allowNull: true },
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
