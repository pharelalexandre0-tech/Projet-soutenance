const nodemailer = require('nodemailer');

// Sans configuration SMTP (variables d'environnement absentes), on retombe
// sur une simulation journalisée plutôt que de planter — utile en dev local
// ou sur un déploiement où l'e-mail n'a pas encore été branché.
let transporteur = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporteur = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function envoyerEmail(destinataire, sujet, corps) {
  if (!transporteur) {
    console.log(`[Service E-mail] (SMTP non configuré, simulation) À: ${destinataire} | Sujet: ${sujet}\n${corps}\n`);
    return { envoye: true, simule: true };
  }

  await transporteur.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinataire,
    subject: sujet,
    text: corps,
  });
  return { envoye: true };
}

module.exports = { envoyerEmail };
