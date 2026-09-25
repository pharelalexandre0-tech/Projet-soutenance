const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Documents PDF générés par la plateforme (bulletins, reçus, fiches de
// paie, emplois du temps), conservés dans PostgreSQL plutôt que sur le
// disque du serveur : l'hébergeur efface son disque à chaque déploiement,
// la base, elle, garde tout.
class DocumentPDF extends Model {}

DocumentPDF.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nomFichier: { type: DataTypes.STRING, allowNull: false, unique: true },
    typeDocument: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'document' },
    contenu: { type: DataTypes.BLOB, allowNull: false },
    taille: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'DocumentPDF', tableName: 'documents_pdf' }
);

module.exports = DocumentPDF;
