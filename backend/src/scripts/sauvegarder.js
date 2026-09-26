// Sauvegarde complète des données : `npm run backup` (ou, pour la base
// d'un hébergeur : DATABASE_URL="<adresse externe>" npm run backup).
// Écrit un instantané JSON de TOUTES les tables, mots de passe hachés et
// documents PDF compris, que `npm run restore` recharge dans n'importe
// quelle autre base PostgreSQL (changement d'hébergeur sans rien perdre).
// Jamais commité (voir .gitignore) : le dépôt est public et un instantané
// contient noms, e-mails, notes et montants réels. Copie-le ensuite vers un
// endroit sûr (disque externe, stockage cloud privé).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const modeles = require('../models');

const DOSSIER_SAUVEGARDES = path.join(__dirname, '..', '..', 'storage', 'sauvegardes');

// Tous les modèles sauf `sequelize` lui-même (ce n'est pas un modèle).
const NOMS_MODELES = Object.keys(modeles).filter((cle) => cle !== 'sequelize');

// Les documents binaires (PDF) sont écrits en base64 plutôt qu'en tableau
// d'octets : fichier quatre fois plus léger.
function remplacer(cle, valeur) {
  if (valeur && valeur.type === 'Buffer' && Array.isArray(valeur.data)) {
    return { $base64: Buffer.from(valeur.data).toString('base64') };
  }
  return valeur;
}

(async () => {
  await modeles.sequelize.authenticate();

  const instantane = { $format: 'edusphere-sauvegarde', $version: 2, $creeLe: new Date().toISOString(), tables: {} };
  for (const nom of NOMS_MODELES) {
    // unscoped() : sans lui, les portées par défaut (ex. Utilisateur, qui
    // masque le mot de passe) retireraient des colonnes de la sauvegarde.
    instantane.tables[nom] = await modeles[nom].unscoped().findAll({ raw: true });
  }

  const chemin = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(DOSSIER_SAUVEGARDES, `sauvegarde-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, JSON.stringify(instantane, remplacer));

  const totalLignes = Object.values(instantane.tables).reduce((s, lignes) => s + lignes.length, 0);
  const taille = (fs.statSync(chemin).size / 1024 / 1024).toFixed(1);
  console.log(`Sauvegarde écrite : ${chemin}`);
  console.log(`${totalLignes} lignes sur ${NOMS_MODELES.length} tables (${taille} Mo).`);

  await modeles.sequelize.close();
})().catch((err) => {
  console.error('Erreur lors de la sauvegarde :', err.message);
  process.exit(1);
});
