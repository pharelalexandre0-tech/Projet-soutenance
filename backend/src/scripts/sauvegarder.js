// Sauvegarde manuelle de toutes les données : `npm run backup`.
// Écrit un instantané JSON local — jamais commité (voir .gitignore) : le
// dépôt est public, un vrai dump contient noms, e-mails, notes et montants
// financiers réels des établissements. Pense à copier le fichier généré
// vers un endroit sûr (disque externe, stockage cloud privé...) après
// coup — ce script ne fait que produire l'instantané, pas son transport.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const modeles = require('../models');

const DOSSIER_SAUVEGARDES = path.join(__dirname, '..', '..', 'storage', 'sauvegardes');

// Tous les modèles sauf `sequelize` lui-même (ce n'est pas un modèle).
const NOMS_MODELES = Object.keys(modeles).filter((cle) => cle !== 'sequelize');

(async () => {
  await modeles.sequelize.authenticate();

  const instantane = {};
  for (const nom of NOMS_MODELES) {
    instantane[nom] = await modeles[nom].findAll({ raw: true });
  }

  fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const cheminFichier = path.join(DOSSIER_SAUVEGARDES, `sauvegarde-${horodatage}.json`);
  fs.writeFileSync(cheminFichier, JSON.stringify(instantane, null, 2));

  const totalLignes = Object.values(instantane).reduce((s, lignes) => s + lignes.length, 0);
  console.log(`Sauvegarde écrite : ${cheminFichier} (${totalLignes} lignes au total sur ${NOMS_MODELES.length} tables).`);

  await modeles.sequelize.close();
})().catch((err) => {
  console.error('Erreur lors de la sauvegarde :', err);
  process.exit(1);
});
