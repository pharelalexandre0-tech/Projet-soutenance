const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Ce que les utilisateurs d'une école produisent dans une fonctionnalité
// personnalisée : une question posée à l'assistant (et sa réponse), un
// formulaire envoyé à l'Académie, ou une ligne du registre tenu par
// l'Académie. Toujours rattaché à une école : une autre école ne le voit
// jamais, le superadmin non plus.
class EntreeExtension extends Model {}

EntreeExtension.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cle: { type: DataTypes.STRING, allowNull: false },
    etablissementId: { type: DataTypes.INTEGER, allowNull: false },
    nature: { type: DataTypes.ENUM('question', 'soumission', 'element'), allowNull: false },
    auteurId: { type: DataTypes.INTEGER, allowNull: true },
    // Nom et espace affichés à l'Académie (le parent passe par le compte de
    // son enfant : "Parent de ..." ).
    auteurNom: { type: DataTypes.STRING(160), allowNull: true },
    auteurEspace: { type: DataTypes.STRING(20), allowNull: true },
    donnees: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    // question : 'repondue' | 'sans-reponse' ; soumission : 'nouvelle' |
    // 'en-cours' | 'traitee' ; element : 'publie'.
    statut: { type: DataTypes.STRING(20), allowNull: false },
    reponseAcademie: { type: DataTypes.STRING(1000), allowNull: true },
  },
  {
    sequelize,
    modelName: 'EntreeExtension',
    tableName: 'entrees_extensions',
    indexes: [{ fields: ['etablissementId', 'cle', 'nature'] }],
  }
);

module.exports = EntreeExtension;
