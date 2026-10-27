const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Registre des documents officiels émis (bulletin, reçu, fiche de paie,
// procès-verbal, listes, emplois du temps). Chaque PDF porte un code de
// vérification et un QR code qui renvoient à cette ligne : n'importe qui
// peut confirmer en ligne qu'un document est authentique, qu'il n'a pas été
// remplacé par une version plus récente ni annulé par l'école.
//
// `signature` : signature Ed25519 de la plateforme sur le contenu certifié
// (vérifiable avec la clé publique servie par /api/verification/cle-publique).
// `empreintes` : SHA-256 des fichiers PDF remis, pour contrôler qu'un
// fichier reçu est bien l'original, octet pour octet.
class CertificationDocument extends Model {}

CertificationDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(14), allowNull: false, unique: true },
    // Identifie le document logique (un bulletin d'un élève pour un
    // semestre...) : une nouvelle version remplace la précédente.
    cle: { type: DataTypes.STRING(120), allowNull: false },
    typeDocument: { type: DataTypes.STRING(30), allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: true },
    titre: { type: DataTypes.STRING(200), allowNull: false },
    titulaire: { type: DataTypes.STRING(160), allowNull: true },
    // [[libellé, valeur], ...] affichés sur la page de vérification.
    elements: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    empreinteContenu: { type: DataTypes.STRING(64), allowNull: false },
    signature: { type: DataTypes.TEXT, allowNull: false },
    empreintes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    emisLe: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    emisParId: { type: DataTypes.INTEGER, allowNull: true },
    statut: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'valide', validate: { isIn: [['valide', 'remplace', 'annule']] } },
    remplaceLe: { type: DataTypes.DATE, allowNull: true },
    annuleLe: { type: DataTypes.DATE, allowNull: true },
    motifAnnulation: { type: DataTypes.STRING(300), allowNull: true },
    nombreVerifications: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    derniereVerification: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'CertificationDocument',
    tableName: 'certifications_documents',
    indexes: [{ fields: ['cle', 'statut'] }, { fields: ['etablissementId', 'emisLe'] }],
  }
);

module.exports = CertificationDocument;
