require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const comptesEphemeresRoutes = require('./routes/comptesEphemeres');
const notesRoutes = require('./routes/notes');
const bulletinsRoutes = require('./routes/bulletins');
const absencesRoutes = require('./routes/absences');
const incidentsRoutes = require('./routes/incidents');
const financeRoutes = require('./routes/finance');
const predictionsRoutes = require('./routes/predictions');
const referenceRoutes = require('./routes/reference');
const notificationsRoutes = require('./routes/notifications');
const superadminRoutes = require('./routes/superadmin');
const { DOSSIER_STOCKAGE } = require('./services/pdfService');

const app = express();

// En prod comme en dev, le navigateur ne parle jamais directement au
// backend : le frontend (Vite en dev, son propre proxy Docker en prod)
// relaie /api en interne, donc toujours same-origin de son point de vue —
// cors() n'a d'effet que si quelqu'un appelle le backend depuis un AUTRE
// site (le seul cas concerné par la protection CORS d'un navigateur).
// Liste blanche plutôt que cors() ouvert à tout site, en profondeur en
// plus du token bearer (pas un cookie) déjà résistant au CSRF classique.
const origineFrontendProd = process.env.FRONTEND_URL || 'https://edusphere-frontend-pryg.onrender.com';
app.use(cors({
  origin(origine, callback) {
    // Pas d'en-tête Origin (curl, le ping keep-alive, un appel serveur à
    // serveur) : ce n'est pas une requête de navigateur, cors() ne
    // s'applique pas à ce cas de toute façon.
    if (!origine || origine === origineFrontendProd || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origine)) {
      return callback(null, true);
    }
    return callback(new Error('origine non autorisée'));
  },
}));
app.use(helmet());
app.use(compression());
// Limite par défaut (100kb) trop basse pour le logo d'établissement,
// envoyé en base64 dans le JSON (~1,4x sa taille binaire) — 3mb laisse une
// marge confortable sur une image déjà bridée à 1mb côté frontend.
app.use(express.json({ limit: '3mb' }));

// Un formulaire de connexion mal protégé accepte des centaines d'essais
// par seconde — large marge (les cold starts Render peuvent multiplier
// les tentatives légitimes) mais assez basse pour freiner un bruteforce.
// Même limiteur pour la réinitialisation de mot de passe : aussi
// sensible (jeton devinable par force brute, ou spam d'e-mails vers un
// tiers si on ne limitait pas les demandes).
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'trop de tentatives — réessaie dans quelques minutes' },
});
app.use(['/api/auth/connexion', '/api/auth/mot-de-passe-oublie', '/api/auth/reinitialiser-mot-de-passe'], limiteurConnexion);

// Bulletins et reçus PDF générés par pdfService (diagrammes 5 et 8).
app.use('/fichiers', express.static(DOSSIER_STOCKAGE));

app.get('/api/sante', (req, res) => res.json({ etat: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/comptes-ephemeres', comptesEphemeresRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/bulletins', bulletinsRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api', referenceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/superadmin', superadminRoutes);

// Gestion d'erreurs générique. `err.status` n'est posé que par du code
// applicatif qui choisit volontairement son message (ex. `err.status =
// 400`) — une exception non prévue (bug, erreur Postgres...) n'a pas ce
// champ, et son `.message` brut ne doit jamais atteindre le client : il
// peut contenir des détails internes (requête SQL, chemin de fichier...).
app.use((err, req, res, next) => {
  console.error(err);
  const exposable = Number.isInteger(err.status);
  res.status(err.status || 500).json({ erreur: exposable ? err.message : 'erreur interne du serveur' });
});

module.exports = app;
