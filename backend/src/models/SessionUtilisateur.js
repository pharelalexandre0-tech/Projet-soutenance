const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Une ligne par connexion ouverte. Le jeton de session porte l'identifiant
// de cette ligne : la session peut ainsi être fermée à distance (appareil
// perdu, départ d'un agent) avant même l'expiration du jeton, et chacun voit
// la liste des appareils connectés à son compte.
class SessionUtilisateur extends Model {}

SessionUtilisateur.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    utilisateurId: { type: DataTypes.INTEGER, allowNull: false },
    // Session ouverte par le parent sur le compte de son enfant.
    parent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    appareil: { type: DataTypes.STRING(160), allowNull: true },
    // Moyen de connexion : mot de passe seul, code e-mail, application TOTP,
    // code de secours.
    methode: { type: DataTypes.STRING(20), allowNull: true },
    derniereActivite: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expireLe: { type: DataTypes.DATE, allowNull: false },
    revoqueeLe: { type: DataTypes.DATE, allowNull: true },
    motifRevocation: { type: DataTypes.STRING(80), allowNull: true },
  },
  {
    sequelize,
    modelName: 'SessionUtilisateur',
    tableName: 'sessions_utilisateurs',
    indexes: [{ fields: ['utilisateurId', 'revoqueeLe'] }],
  }
);

module.exports = SessionUtilisateur;
