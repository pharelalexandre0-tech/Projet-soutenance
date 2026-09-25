const app = require('./app');
const { sequelize } = require('./models');
const { initialiserActivations } = require('./services/plateformeService');
const { attribuerMatriculesManquants } = require('./services/matriculeService');
const { initialiserPublicationsEmplois } = require('./services/emploiDuTempsService');
const { importerDocumentsExistants } = require('./services/pdfService');
const { reconstituerComptesRendus } = require('./services/compteRenduService');
const { rattacherProfesseursALaPaie } = require('./services/paieService');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await sequelize.authenticate();
    // sync({ alter: true }) : pratique pour un prototype de soutenance,
    // à remplacer par de vraies migrations Sequelize pour la production.
    await sequelize.sync({ alter: true });
    console.log('Connexion à PostgreSQL établie, modèles synchronisés.');
    await initialiserActivations();
    await attribuerMatriculesManquants();
    await initialiserPublicationsEmplois();
    await importerDocumentsExistants();
    await reconstituerComptesRendus();
    await rattacherProfesseursALaPaie();

    app.listen(PORT, () => {
      console.log(`API Plateforme de Gestion Scolaire à l'écoute sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('Impossible de démarrer le serveur :', err);
    process.exit(1);
  }
})();
