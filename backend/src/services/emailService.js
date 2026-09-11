const nodemailer = require('nodemailer');

// Render bloque le SMTP sortant (ports 25/465/587) sur son plan gratuit —
// Resend (API HTTP, port 443, jamais bloqué) est donc la voie prioritaire.
// SMTP reste utilisable en dev local ou sur un hébergeur qui l'autorise ;
// sans aucune des deux config, simulation par console.log pour ne pas
// dépendre d'identifiants externes.
let transporteurSMTP = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporteurSMTP = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function envoyerViaResend(destinataire, sujet, corps) {
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'EduSphere <onboarding@resend.dev>',
      to: destinataire,
      subject: sujet,
      text: corps,
    }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${detail}`);
  }
}

async function envoyerEmail(destinataire, sujet, corps) {
  if (process.env.RESEND_API_KEY) {
    await envoyerViaResend(destinataire, sujet, corps);
    return { envoye: true };
  }

  if (transporteurSMTP) {
    await transporteurSMTP.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: sujet,
      text: corps,
    });
    return { envoye: true };
  }

  console.log(`[Service E-mail] (aucun envoi configuré, simulation) À: ${destinataire} | Sujet: ${sujet}\n${corps}\n`);
  return { envoye: true, simule: true };
}

module.exports = { envoyerEmail };
