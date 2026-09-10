require('dotenv').config();
const { Sequelize } = require('sequelize');

// Les hôtes distants (ex. Render) exigent SSL ; les hôtes locaux/Docker
// (localhost, 127.0.0.1, le service "db" de docker-compose) n'en ont pas.
const hoteLocal = /localhost|127\.0\.0\.1|@db[:/]/.test(process.env.DATABASE_URL || '');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: hoteLocal
    ? {}
    : { ssl: { require: true, rejectUnauthorized: false } },
});

module.exports = sequelize;
