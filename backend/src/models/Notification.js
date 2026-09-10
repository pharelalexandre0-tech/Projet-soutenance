const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    contenu: { type: DataTypes.STRING, allowNull: false },
    dateEnvoi: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lu: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: 'Notification', tableName: 'notifications' }
);

module.exports = Notification;
