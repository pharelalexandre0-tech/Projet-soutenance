// Restauration d'une sauvegarde (`npm run backup`) dans la base désignée par
// DATABASE_URL, par exemple celle d'un nouvel hébergeur :
//   DATABASE_URL="<adresse de la nouvelle base>" npm run restore -- chemin/sauvegarde.json --remplacer
// La base cible reçoit les tables si elles n'existent pas encore, puis son
// contenu est REMPLACÉ par celui de la sauvegarde (d'où l'option
// --remplacer, obligatoire). Tout se fait dans une transaction : en cas
// d'erreur, la base reste telle qu'elle était.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const modeles = require('../models');

const { sequelize } = modeles;
const NOMS_MODELES = Object.keys(modeles).filter((cle) => cle !== 'sequelize');
const PAQUET = 500;

function relire(cle, valeur) {
  if (valeur && typeof valeur === 'object' && typeof valeur.$base64 === 'string') return Buffer.from(valeur.$base64, 'base64');
  if (valeur && valeur.type === 'Buffer' && Array.isArray(valeur.data)) return Buffer.from(valeur.data);
  return valeur;
}

// Ordre d'insertion : une table après celles qu'elle référence.
function ordreInsertion() {
  const ordre = [];
  const vus = new Set();
  function visiter(nom, pile = new Set()) {
    if (vus.has(nom) || pile.has(nom)) return;
    pile.add(nom);
    Object.values(modeles[nom].associations)
      .filter((a) => a.associationType === 'BelongsTo' && a.target.name !== nom)
      .forEach((a) => visiter(a.target.name, pile));
    vus.add(nom);
    ordre.push(nom);
  }
  NOMS_MODELES.forEach((nom) => visiter(nom));
  return ordre;
}

(async () => {
  const fichier = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!fichier) throw new Error('indique le fichier de sauvegarde : npm run restore -- chemin/sauvegarde.json --remplacer');
  const cible = new URL(process.env.DATABASE_URL);
  if (!process.argv.includes('--remplacer')) {
    console.log(`Le contenu de la base « ${cible.pathname.slice(1)} » (${cible.hostname}) sera remplacé par la sauvegarde.`);
    console.log('Relance la commande avec --remplacer pour confirmer.');
    return;
  }

  const brut = JSON.parse(fs.readFileSync(path.resolve(fichier), 'utf8'), relire);
  const tables = brut.tables || brut; // ancien format : les tables à la racine
  await sequelize.authenticate();
  // Base neuve : crée les tables manquantes, sans modifier les autres.
  await sequelize.sync();

  const ordre = ordreInsertion();
  const resume = [];
  await sequelize.transaction(async (transaction) => {
    const noms = ordre.map((nom) => `"${modeles[nom].getTableName()}"`).join(', ');
    await sequelize.query(`TRUNCATE ${noms} RESTART IDENTITY CASCADE`, { transaction });

    for (const nom of ordre) {
      const Modele = modeles[nom];
      const lignes = tables[nom] || [];
      for (let i = 0; i < lignes.length; i += PAQUET) {
        await Modele.unscoped().bulkCreate(lignes.slice(i, i + PAQUET), {
          transaction, validate: false, hooks: false, silent: true,
        });
      }
      // Les prochains identifiants reprennent après le plus grand restauré.
      if (Modele.rawAttributes.id?.autoIncrement) {
        const table = Modele.getTableName();
        await sequelize.query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`,
          { transaction }
        );
      }
      resume.push(`${nom} ${lignes.length}`);
    }
  });

  const total = ordre.reduce((s, nom) => s + (tables[nom] || []).length, 0);
  console.log(`Restauration terminée dans « ${cible.pathname.slice(1)} » : ${total} lignes, ${ordre.length} tables.`);
  console.log(resume.join(' | '));
  console.log('Redémarre le serveur de cette base : il complète ce qui en dépend (modèle d\'IA en mémoire, etc.).');
})()
  .catch((err) => {
    console.error('Restauration impossible, la base n\'a pas été modifiée :', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
