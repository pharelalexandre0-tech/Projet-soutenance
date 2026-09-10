const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Une ligne par (eleve, matiere) : on y stocke la moyenne de contrôle
// continu et la moyenne d'examen déjà calculées par le professeur/l'Académie
// (pas chaque note individuelle) — la note finale de la matière en est
// dérivée (voir services/moyenneService.js).
class Note extends Model {}

Note.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    moyenneCC: { type: DataTypes.FLOAT, allowNull: true },
    moyenneExamen: { type: DataTypes.FLOAT, allowNull: true },
    // Une matière peut avoir une ligne "normale" et, si elle n'a pas été
    // validée, une seconde ligne "rattrapage" — jamais plus d'une par session.
    session: { type: DataTypes.ENUM('normale', 'rattrapage'), allowNull: false, defaultValue: 'normale' },
  },
  {
    sequelize,
    modelName: 'Note',
    tableName: 'notes',
    indexes: [{ unique: true, fields: ['eleveId', 'matiereId', 'session'] }],
  }
);

module.exports = Note;
