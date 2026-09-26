// "Planificateur" du diagramme d'activité 7 : à exécuter périodiquement
// (ex. hebdomadaire) via une tâche planifiée -> `npm run check:prediction`.
// Chaque établissement est analysé et notifié séparément (une école ne doit
// jamais recevoir d'alerte sur les élèves d'une autre).
require('dotenv').config();
const { sequelize, Etablissement } = require('../models');
const { executerAnalyseRisque } = require('../controllers/predictionController');
const { publier } = require('../services/evenementsService');

(async () => {
  await sequelize.authenticate();
  const etablissements = await Etablissement.findAll();
  for (const etab of etablissements) {
    const resultat = await executerAnalyseRisque(etab.id);
    console.log(`Analyse de prédiction IA effectuée pour "${etab.nom}" :`, resultat);
    await publier(etab.id, 'predictions');
  }
  await sequelize.close();
})().catch((err) => {
  console.error("Erreur lors de l'analyse de prédiction :", err);
  process.exit(1);
});
