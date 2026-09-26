const app = require('./app');
const { sequelize } = require('./models');
const { initialiserActivations } = require('./services/plateformeService');
const { attribuerMatriculesManquants } = require('./services/matriculeService');
const { initialiserPublicationsEmplois } = require('./services/emploiDuTempsService');
const { importerDocumentsExistants } = require('./services/pdfService');
const { reconstituerComptesRendus } = require('./services/compteRenduService');
const { rattacherProfesseursALaPaie } = require('./services/paieService');
const { assurerModeleIA, oublierModele } = require('./services/riskService');
const { migrerComptesParents, fusionnerEspaceParents } = require('./services/migrationParents');
const { demarrerEcoute, abonner } = require('./services/evenementsService');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await sequelize.authenticate();
    await migrerComptesParents(sequelize);
    // sync({ alter: true }) : pratique pour un prototype de soutenance,
    // à remplacer par de vraies migrations Sequelize pour la production.
    await sequelize.sync({ alter: true });
    console.log('Connexion à PostgreSQL établie, modèles synchronisés.');
    await fusionnerEspaceParents();
    await initialiserActivations();
    await attribuerMatriculesManquants();
    await initialiserPublicationsEmplois();
    await importerDocumentsExistants();
    await reconstituerComptesRendus();
    await rattacherProfesseursALaPaie();
    await assurerModeleIA();
    await demarrerEcoute();
    // Modèle réentraîné par le script npm run train:risque : rechargé ici.
    abonner(null, (evenement) => { if (evenement.domaine === 'modele-ia') oublierModele(); });

    app.listen(PORT, () => {
      console.log(`API Plateforme de Gestion Scolaire à l'écoute sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('Impossible de démarrer le serveur :', err);
    process.exit(1);
  }
})();
