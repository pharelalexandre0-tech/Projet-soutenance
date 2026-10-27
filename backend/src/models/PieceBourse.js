const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Pièce d'un dossier de bourse ANBG (PDF ou image), conservée dans
// PostgreSQL avec son empreinte SHA-256. Le contenu n'est jamais renvoyé
// dans une liste : seulement par le téléchargement contrôlé.
class PieceBourse extends Model {}

PieceBourse.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    dossierId: { type: DataTypes.INTEGER, allowNull: false },
    eleveId: { type: DataTypes.INTEGER, allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(30), allowNull: false },
    nomFichier: { type: DataTypes.STRING(200), allowNull: false },
    mime: { type: DataTypes.STRING(40), allowNull: false },
    taille: { type: DataTypes.INTEGER, allowNull: false },
    contenu: { type: DataTypes.BLOB, allowNull: false },
    empreinte: { type: DataTypes.STRING(64), allowNull: false },
    statut: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'depose', validate: { isIn: [['depose', 'valide', 'refuse']] } },
    commentaire: { type: DataTypes.STRING(400), allowNull: true },
    origine: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'etudiant' },
    examineParNom: { type: DataTypes.STRING(160), allowNull: true },
    examineLe: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize, modelName: 'PieceBourse', tableName: 'pieces_bourse',
    defaultScope: { attributes: { exclude: ['contenu'] } },
    scopes: { avecContenu: { attributes: {} } },
    indexes: [{ fields: ['dossierId'] }],
  }
);

module.exports = PieceBourse;
