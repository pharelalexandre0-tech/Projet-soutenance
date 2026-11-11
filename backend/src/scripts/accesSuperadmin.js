require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Utilisateur } = require('../models');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');

// Accès superadmin pour le propriétaire de la plateforme, lancé depuis son
// ordinateur avec l'adresse de la base visée (DATABASE_URL) :
//   - l'adresse n'existe pas : un nouveau superadmin est créé ;
//   - c'est déjà un superadmin : son mot de passe est remplacé.
// Le mot de passe est saisi au clavier sans s'afficher, jamais passé en
// paramètre. Refuse une adresse qui appartient à un autre type de compte.
//   node src/scripts/accesSuperadmin.js votre@adresse.com

function saisieMasquee(question) {
  return new Promise((resoudre) => {
    process.stdout.write(question);
    const entree = process.stdin;
    if (!entree.isTTY) {
      // Entrée redirigée (tests) : lignes lues d'un coup puis servies une à une.
      if (!saisieMasquee.lignes) saisieMasquee.lignes = require('fs').readFileSync(0, 'utf8').split(/\r?\n/);
      process.stdout.write('\n');
      resoudre(saisieMasquee.lignes.shift() || '');
      return;
    }
    let valeur = '';
    entree.setRawMode(true);
    entree.resume();
    entree.setEncoding('utf8');
    const lire = (touche) => {
      if (touche === '\r' || touche === '\n') {
        entree.setRawMode(false);
        entree.pause();
        entree.removeListener('data', lire);
        process.stdout.write('\n');
        resoudre(valeur);
      } else if (touche === '\u0003') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (touche === '\u0008' || touche === '\u007f') {
        valeur = valeur.slice(0, -1);
      } else {
        valeur += touche;
      }
    };
    entree.on('data', lire);
  });
}

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Indique ton adresse e-mail : node src/scripts/accesSuperadmin.js ton@adresse.com');
    process.exitCode = 1;
    return;
  }
  const hote = (String(process.env.DATABASE_URL || '').match(/@([^/:?]+)/) || [])[1] || 'base inconnue';
  console.log(`Base visée : ${hote}`);
  const motDePasse = await saisieMasquee('Nouveau mot de passe (invisible à la saisie) : ');
  const confirmation = await saisieMasquee('Confirme le mot de passe : ');
  if (motDePasse !== confirmation) {
    console.error('Les deux saisies ne correspondent pas : rien n’a été modifié.');
    process.exitCode = 1;
    return;
  }
  const erreur = erreurMotDePasseInvalide(motDePasse);
  if (erreur) {
    console.error(`Mot de passe refusé : ${erreur}.`);
    process.exitCode = 1;
    return;
  }
  const hache = await bcrypt.hash(motDePasse, 10);
  const existant = await Utilisateur.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email) });
  if (existant && existant.role !== 'superadmin') {
    console.error('Cette adresse appartient déjà à un compte qui n’est pas superadmin : choisis-en une autre.');
    process.exitCode = 1;
    return;
  }
  if (existant) {
    await existant.update({ motDePasse: hache, statut: 'actif' });
    console.log(`Mot de passe du superadmin ${email} remplacé.`);
  } else {
    await Utilisateur.create({ nom: 'Administrateur', prenom: 'EduSphere', email, motDePasse: hache, role: 'superadmin' });
    console.log(`Superadmin créé : ${email}.`);
  }
  console.log('Connecte-toi sur le site avec cette adresse : le code de connexion arrivera dans cette boîte mail.');
}

main()
  .catch((err) => {
    console.error('Opération impossible :', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
