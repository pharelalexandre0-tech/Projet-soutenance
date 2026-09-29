const fs = require('fs');
const nodemailer = require('nodemailer');

const { emailGenerique } = require('./modelesEmail');

// Chaque envoi est consigné dans PostgreSQL (table journal_emails) : de
// quoi comprendre depuis l'espace superadmin pourquoi un e-mail n'est pas
// arrivé, sans aller lire les journaux du serveur. Adresse masquée : le
// superadmin ne doit pas voir qui, dans une école, reçoit quoi.
const JOURNAL_AFFICHE = 30;
const JOURNAL_CONSERVATION_JOURS = 90;

function masquerAdresse(adresse) {
  const [local, domaine] = String(adresse).split('@');
  if (!domaine) return '***';
  const visible = local.length <= 2 ? local[0] : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domaine}`;
}

async function consigner(destinataire, sujet, service, erreurs) {
  try {
    const { JournalEmail } = require('../models');
    await JournalEmail.create({
      destinataire: masquerAdresse(destinataire),
      sujet: String(sujet).slice(0, 300),
      service,
      statut: service !== 'simulation' ? 'envoye' : erreurs.length ? 'echec' : 'simule',
      erreurs,
    });
    // Ménage occasionnel : on ne garde que les derniers mois.
    if (Math.random() < 0.05) {
      const { Op } = require('sequelize');
      await JournalEmail.destroy({ where: { createdAt: { [Op.lt]: new Date(Date.now() - JOURNAL_CONSERVATION_JOURS * 86400000) } } });
    }
  } catch (err) {
    console.error('[Service E-mail] Journal indisponible :', err.message);
  }
}

async function derniersEnvois() {
  const { JournalEmail } = require('../models');
  const lignes = await JournalEmail.findAll({ order: [['createdAt', 'DESC']], limit: JOURNAL_AFFICHE });
  return lignes.map((l) => ({
    le: l.createdAt,
    destinataire: l.destinataire,
    sujet: l.sujet,
    service: l.service,
    envoye: l.statut === 'envoye',
    erreurs: l.erreurs || [],
  }));
}

// Pièce jointe : contenu en mémoire (PDF lu depuis PostgreSQL) ou, pour
// un ancien appel, chemin sur le disque.
function contenuPiece(p) {
  return p.contenu || fs.readFileSync(p.cheminAbsolu);
}

// Render bloque le SMTP sortant (ports 25/465/587) sur son plan gratuit :
// une API HTTP (port 443, jamais bloqué) est donc la voie prioritaire.
// Ordre : Brevo, puis SendGrid, puis SMTP (dev local ou hébergeur qui
// l'autorise) ; sans aucune configuration, simulation par console.log pour
// ne pas dépendre d'identifiants externes.
let transporteurSMTP = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporteurSMTP = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Sans ça, une connexion qui ne répond jamais (port SMTP bloqué par
    // l'hébergeur, ex. Render) bloquait la requête ~2 minutes avant
    // d'échouer, même défaut que le fetch() de Brevo/SendGrid avant leur
    // AbortSignal.timeout, ici couvert par les propres options de nodemailer.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

// Expéditeur affiché (le nom de l'école) et adresse de réponse (celle de
// l'école) : un message qui porte un nom reconnu et auquel on peut répondre
// est bien mieux traité par les filtres anti-spam qu'un « EduSphere »
// anonyme qui interdit la réponse.
function enTetes(etablissement) {
  const nom = String(etablissement?.nom || 'EduSphere').replace(/["<>]/g, '').slice(0, 70);
  const email = etablissement?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etablissement.email) ? etablissement.email : null;
  return { nom, repondreA: email };
}

// Brevo (API HTTPS). L'expéditeur est une adresse vérifiée dans Brevo
// (Expéditeurs > Ajouter) ; quand c'est une adresse gratuite (@gmail.com),
// Brevo l'envoie sous son propre domaine authentifié (@brevosend.com), ce
// qui passe les contrôles SPF, DKIM et DMARC des messageries. Le nom
// affiché reste celui de l'école et les réponses vont à l'école.
async function envoyerViaBrevo(destinataire, sujet, corps, html, piecesJointes, entetes) {
  // Espaces, retours à la ligne ou guillemets collés avec la clé dans le
  // tableau de bord de l'hébergeur : ignorés.
  const cle = String(process.env.BREVO_API_KEY).trim().replace(/^["']|["']$/g, '');
  // Erreur fréquente : la clé SMTP (xsmtpsib-) au lieu de la clé API (xkeysib-).
  if (cle.startsWith('xsmtpsib-')) {
    throw new Error("BREVO_API_KEY contient une clé SMTP (xsmtpsib-) : il faut une clé API, onglet « Clés API », qui commence par xkeysib-");
  }
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': cle,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: String(process.env.BREVO_FROM).trim(), name: entetes.nom },
      to: [{ email: destinataire }],
      ...(entetes.repondreA && { replyTo: { email: entetes.repondreA, name: entetes.nom } }),
      subject: sujet,
      htmlContent: html,
      textContent: corps,
      // Brevo refuse une liste vide : la clé n'est envoyée qu'avec au moins
      // une pièce jointe (le nom doit porter l'extension, ex. recu.pdf).
      ...(piecesJointes.length > 0 && {
        attachment: piecesJointes.map((p) => ({ name: p.nomFichier, content: contenuPiece(p).toString('base64') })),
      }),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Brevo a refusé l'envoi (${reponse.status}) : ${detail.slice(0, 200)}`);
  }
}

async function envoyerViaSendGrid(destinataire, sujet, corps, html, piecesJointes, entetes) {
  const reponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: destinataire }] }],
      from: { email: process.env.SENDGRID_FROM, name: entetes.nom },
      ...(entetes.repondreA && { reply_to: { email: entetes.repondreA, name: entetes.nom } }),
      subject: sujet,
      // Suivi des clics et des ouvertures coupé : il réécrit chaque lien vers
      // un domaine de SendGrid et ajoute un pixel espion, deux signaux que
      // les filtres anti-spam pénalisent.
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
      // L'alternative texte brut doit être listée avant le HTML (ordre
      // attendu par SendGrid) — les deux ensemble plutôt que HTML seul,
      // meilleur signal anti-spam qu'un message mono-format.
      content: [
        { type: 'text/plain', value: corps },
        { type: 'text/html', value: html },
      ],
      // SendGrid refuse la requête entière si `attachments` est présent
      // mais vide ("must have at least one attachment") : la clé ne doit
      // apparaître que lorsqu'il y a vraiment une pièce jointe.
      ...(piecesJointes.length > 0 && {
        attachments: piecesJointes.map((p) => ({
          content: contenuPiece(p).toString('base64'),
          filename: p.nomFichier,
          disposition: 'attachment',
        })),
      }),
    }),
    signal: AbortSignal.timeout(8000),
  });
  // 202 Accepted sans corps si tout va bien ; le corps d'erreur éventuel
  // (adresse d'expédition pas encore vérifiée, clé invalide...) aide au
  // diagnostic plutôt qu'un simple "ça n'est pas arrivé" silencieux.
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`SendGrid a refusé l'envoi (${reponse.status}) : ${detail}`);
  }
}

// `piecesJointes` (optionnel) : [{ cheminAbsolu, nomFichier }] — un reçu ou
// une fiche de paie jointe en PDF. `options.html` : version HTML déjà mise
// en forme (voir modelesEmail) ; sinon le texte est mis en forme dans le
// cadre générique. Chaque service configuré est essayé dans l'ordre, et on
// passe au suivant en cas d'échec.
// Identité de l'école du destinataire, pour qu'un e-mail générique (absence,
// bulletin, relance...) porte lui aussi son logo et ses coordonnées.
async function etablissementDuDestinataire(email) {
  try {
    const { Utilisateur, Etablissement, Eleve } = require('../models');
    const utilisateur = await Utilisateur.findOne({ where: { email }, attributes: ['etablissementId'] });
    // Adresse d'un parent : l'école de son enfant.
    const etablissementId = utilisateur?.etablissementId
      || (await Eleve.findOne({ where: { emailParent: email }, attributes: ['etablissementId'] }))?.etablissementId;
    return etablissementId ? await Etablissement.findByPk(etablissementId) : null;
  } catch {
    return null;
  }
}

async function envoyerEmail(destinataire, sujet, corps, piecesJointes = [], options = {}) {
  const etablissement = options.etablissement || await etablissementDuDestinataire(destinataire);
  const html = options.html || emailGenerique(corps, { titre: sujet, etablissement });
  const entetes = enTetes(typeof etablissement === 'object' ? etablissement : null);
  const erreurs = [];

  if (process.env.BREVO_API_KEY && process.env.BREVO_FROM) {
    try {
      await envoyerViaBrevo(destinataire, sujet, corps, html, piecesJointes, entetes);
      consigner(destinataire, sujet, 'brevo', erreurs);
      return { envoye: true, service: 'brevo', erreurs };
    } catch (err) {
      // Un e-mail 2FA qui échoue ne doit jamais bloquer la connexion : on
      // passe au service suivant.
      erreurs.push({ service: 'brevo', message: err.message.slice(0, 300) });
      console.error(`[Service E-mail] Échec Brevo pour ${destinataire}, repli :`, err.message);
    }
  }

  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      await envoyerViaSendGrid(destinataire, sujet, corps, html, piecesJointes, entetes);
      consigner(destinataire, sujet, 'sendgrid', erreurs);
      return { envoye: true, service: 'sendgrid', erreurs };
    } catch (err) {
      erreurs.push({ service: 'sendgrid', message: err.message.slice(0, 300) });
      console.error(`[Service E-mail] Échec SendGrid pour ${destinataire}, repli :`, err.message);
    }
  }

  if (transporteurSMTP) {
    try {
      await transporteurSMTP.sendMail({
        from: { name: entetes.nom, address: (String(process.env.SMTP_FROM || '').match(/<([^>]+)>/) || [])[1] || process.env.SMTP_FROM || process.env.SMTP_USER },
        ...(entetes.repondreA && { replyTo: entetes.repondreA }),
        to: destinataire,
        subject: sujet,
        text: corps,
        html,
        attachments: piecesJointes.map((p) => (p.contenu ? { filename: p.nomFichier, content: p.contenu } : { filename: p.nomFichier, path: p.cheminAbsolu })),
      });
      consigner(destinataire, sujet, 'smtp', erreurs);
      return { envoye: true, service: 'smtp', erreurs };
    } catch (err) {
      erreurs.push({ service: 'smtp', message: err.message.slice(0, 300) });
      console.error(`[Service E-mail] Échec SMTP pour ${destinataire}, repli en simulation :`, err.message);
    }
  }

  const suffixePieces = piecesJointes.length ? ` (+ ${piecesJointes.map((p) => p.nomFichier).join(', ')})` : '';
  console.log(`[Service E-mail] (aucun envoi réel, simulation) À: ${destinataire} | Sujet: ${sujet}${suffixePieces}
${corps}
`);
  consigner(destinataire, sujet, 'simulation', erreurs);
  return { envoye: true, simule: true, service: 'simulation', erreurs };
}

module.exports = { envoyerEmail, derniersEnvois };
