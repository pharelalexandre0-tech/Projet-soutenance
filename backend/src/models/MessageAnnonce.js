const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class MessageAnnonce extends Model {}

MessageAnnonce.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    titre: { type: DataTypes.STRING, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    dateEnvoi: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    type: {
      type: DataTypes.ENUM('message', 'annonce', 'convocation'),
      allowNull: false,
      defaultValue: 'message',
    },
  },
  { sequelize, modelName: 'MessageAnnonce', tableName: 'messages_annonces' }
);

module.exports = MessageAnnonce;
