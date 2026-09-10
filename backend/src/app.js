require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const comptesEphemeresRoutes = require('./routes/comptesEphemeres');
const notesRoutes = require('./routes/notes');
const bulletinsRoutes = require('./routes/bulletins');
const absencesRoutes = require('./routes/absences');
const financeRoutes = require('./routes/finance');
const predictionsRoutes = require('./routes/predictions');
const referenceRoutes = require('./routes/reference');
const notificationsRoutes = require('./routes/notifications');
const superadminRoutes = require('./routes/superadmin');
const { DOSSIER_STOCKAGE } = require('./services/pdfService');

const app = express();

app.use(cors());
app.use(express.json());

// Bulletins et reçus PDF générés par pdfService (diagrammes 5 et 8).
app.use('/fichiers', express.static(DOSSIER_STOCKAGE));

app.get('/api/sante', (req, res) => res.json({ etat: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/comptes-ephemeres', comptesEphemeresRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/bulletins', bulletinsRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api', referenceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/superadmin', superadminRoutes);

// Gestion d'erreurs générique.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ erreur: err.message || 'erreur interne du serveur' });
});

module.exports = app;
