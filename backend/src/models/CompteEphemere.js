const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Coeur du diagramme de sequence 4 : un acces temporaire, borne a une
// portee precise (classe + UE + evaluation), que l'Academie genere pour un
// Professeur. Pas de session permanente : toute action de saisie passe par
// ici, et le compte est revoque des que la tache est terminee ou que le
// jeton expire.
class CompteEphemere extends Model {
  estValide() {
    return this.statut === 'actif' && new Date() < new Date(this.dateExpiration);
  }
}

CompteEphemere.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jeton: { type: DataTypes.STRING, allowNull: false, unique: true },
    tache: {
      type: DataTypes.ENUM('saisie_notes', 'saisie_absences', 'cahier_de_textes'),
      allowNull: false,
      defaultValue: 'saisie_notes',
    },
    // Portee : classe + matiere + categorie (CC ou Examen) exactes autorisees
    // pour ce jeton. evaluationLibelle est un libelle libre affiche au
    // Professeur (ex. "Devoir surveillé 2"), sans effet sur le calcul.
    categorie: {
      type: DataTypes.ENUM('cc', 'examen'),
      allowNull: false,
      defaultValue: 'cc',
    },
    evaluationLibelle: { type: DataTypes.STRING, allowNull: true },
    dateCreation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    dateExpiration: { type: DataTypes.DATE, allowNull: false },
    statut: {
      type: DataTypes.ENUM('actif', 'revoque', 'expire'),
      allowNull: false,
      defaultValue: 'actif',
    },
    // Rempli quand le professeur envoie sa saisie : distingue un accès
    // terminé normalement d'un accès fermé à la main par l'Académie (un
    // appel sans aucun absent ne laisse sinon aucune trace en base).
    saisieEnvoyeeLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'CompteEphemere', tableName: 'comptes_ephemeres' }
);

module.exports = CompteEphemere;
