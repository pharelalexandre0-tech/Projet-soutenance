const fs = require('fs');
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

async function envoyerViaResend(destinataire, sujet, corps, piecesJointes) {
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
      attachments: piecesJointes.map((p) => ({
        filename: p.nomFichier,
        content: fs.readFileSync(p.cheminAbsolu).toString('base64'),
      })),
    }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${detail}`);
  }
}

// `piecesJointes` (optionnel) : [{ cheminAbsolu, nomFichier }] — un reçu ou
// une fiche de paie jointe en PDF, pas seulement un chemin mentionné dans
// le texte du message.
async function envoyerEmail(destinataire, sujet, corps, piecesJointes = []) {
  if (process.env.RESEND_API_KEY) {
    try {
      await envoyerViaResend(destinataire, sujet, corps, piecesJointes);
      return { envoye: true };
    } catch (err) {
      // Le mode sandbox de Resend (aucun domaine vérifié) refuse tout
      // destinataire qui n'est pas le compte vérifié — ex. un compte de
      // démo comme academie@ecole.ga. Un e-mail 2FA qui échoue à cause de
      // cette limite ne doit jamais bloquer la connexion : on retombe sur
      // la simulation console plutôt que de laisser l'erreur remonter.
      console.error(`[Service E-mail] Échec Resend pour ${destinataire}, repli en simulation :`, err.message);
    }
  }

  if (transporteurSMTP) {
    await transporteurSMTP.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: sujet,
      text: corps,
      attachments: piecesJointes.map((p) => ({ filename: p.nomFichier, path: p.cheminAbsolu })),
    });
    return { envoye: true };
  }

  const suffixePieces = piecesJointes.length ? ` (+ ${piecesJointes.map((p) => p.nomFichier).join(', ')})` : '';
  console.log(`[Service E-mail] (aucun envoi configuré, simulation) À: ${destinataire} | Sujet: ${sujet}${suffixePieces}\n${corps}\n`);
  return { envoye: true, simule: true };
}

module.exports = { envoyerEmail };
