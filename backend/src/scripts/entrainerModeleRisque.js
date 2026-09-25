// Entraînement du modèle de prédiction du risque d'échec / de décrochage :
// `npm run train:risque`. Reconstruit la base d'apprentissage dans
// PostgreSQL (cohorte de référence + semestres terminés des
// établissements), compare forêt aléatoire et régression logistique par
// validation croisée, garde le meilleur et l'enregistre comme modèle actif
// (table modeles_ia). Le serveur fait la même chose depuis l'espace
// Académie, bouton « Réentraîner le modèle ».
require('dotenv').config();
const { sequelize } = require('../models');
const { entrainerModele } = require('../services/ia/entrainement');

(async () => {
  await sequelize.sync({ alter: true });
  const modele = await entrainerModele();
  const { comparaison, metriques, donnees } = modele;
  console.log(`Modèle v${modele.version} actif : ${modele.algorithme} (${modele.dureeMs} ms)`);
  console.log(`Données : ${donnees.total} parcours (${donnees.reels} réels), ${donnees.apprentissage} pour l'apprentissage, ${donnees.test} pour le test`);
  console.log('Validation croisée (AUC) : forêt aléatoire', comparaison.foret_aleatoire.validationCroisee.aucMoyenne, '| régression logistique', comparaison.regression_logistique.validationCroisee.aucMoyenne);
  console.log('Test du modèle retenu :', metriques);
  await sequelize.close();
})().catch(async (err) => {
  console.error(err);
  await sequelize.close();
  process.exit(1);
});
