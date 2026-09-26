require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Utilisateur } = require('../models');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');

// Premier compte d'une installation neuve : le superadmin, qui crée ensuite
// les établissements depuis son espace. Non destructif : sans effet si un
// superadmin existe déjà, et ne touche à aucune autre donnée.
//   SUPERADMIN_EMAIL=... SUPERADMIN_MOT_DE_PASSE=... npm run init:superadmin
async function main() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim();
  const motDePasse = process.env.SUPERADMIN_MOT_DE_PASSE || '';
  if (!email || !motDePasse) {
    console.error('Renseigne SUPERADMIN_EMAIL et SUPERADMIN_MOT_DE_PASSE (variables d\'environnement ou fichier .env).');
    process.exitCode = 1;
    return;
  }
  const erreur = erreurMotDePasseInvalide(motDePasse);
  if (erreur) {
    console.error(`Mot de passe refusé : ${erreur}.`);
    process.exitCode = 1;
    return;
  }

  // Crée les tables manquantes d'une base vide, sans modifier les autres.
  await sequelize.sync();
  const existant = await Utilisateur.findOne({ where: { role: 'superadmin' } });
  if (existant) {
    console.log(`Un superadmin existe déjà (${existant.email}) : rien à faire.`);
    return;
  }
  await Utilisateur.create({
    nom: process.env.SUPERADMIN_NOM || 'Administrateur',
    prenom: process.env.SUPERADMIN_PRENOM || 'EduSphere',
    email,
    motDePasse: await bcrypt.hash(motDePasse, 10),
    role: 'superadmin',
  });
  console.log(`Superadmin créé : ${email}. Connecte-toi pour créer le premier établissement.`);
}

main()
  .catch((err) => {
    console.error('Impossible de créer le superadmin :', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
