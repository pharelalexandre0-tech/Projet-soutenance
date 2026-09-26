// Exécuter quotidiennement (cron / tâche planifiée) : `npm run check:impayes`.
// Correspond au premier "swimlane" du diagramme d'activité 9 (Système),
// indépendant de toute requête HTTP.
require('dotenv').config();
const { sequelize } = require('../models');
const { verifierImpayesService } = require('../services/impayesService');
const { publier } = require('../services/evenementsService');

(async () => {
  await sequelize.authenticate();
  const resultat = await verifierImpayesService();
  console.log('Vérification des impayés effectuée :', resultat);
  // Les écrans Finance et Étudiant ouverts se mettent à jour.
  if (resultat.nombreMarquesImpayes > 0) await publier(null, 'donnees');
  await sequelize.close();
})().catch((err) => {
  console.error('Erreur lors de la vérification des impayés :', err);
  process.exit(1);
});
