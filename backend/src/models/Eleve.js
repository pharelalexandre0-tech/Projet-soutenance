const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Eleve extends Model {}

Eleve.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    dateNaissance: { type: DataTypes.DATEONLY, allowNull: true },
    // Numéro d'étudiant attribué automatiquement à l'inscription (sigle de
    // l'établissement, code de 2 caractères, numéro d'ordre : ex.
    // CDP-2N-0001). Sert
    // aussi de mot de passe au compte étudiant, qui ne peut pas le changer.
    matricule: { type: DataTypes.STRING(30), allowNull: true, unique: true },
    // Le parent n'a pas de compte à lui : il ouvre le compte étudiant de son
    // enfant avec cette adresse et le même mot de passe (le matricule). Les
    // e-mails destinés à la famille partent aussi à cette adresse.
    emailParent: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  },
  { sequelize, modelName: 'Eleve', tableName: 'eleves' }
);

module.exports = Eleve;
