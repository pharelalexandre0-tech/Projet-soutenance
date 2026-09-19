const fs = require('fs');
const nodemailer = require('nodemailer');

function echapperHtml(texte) {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Gabarit HTML minimal et volontairement sobre — première version (fond
// gris pleine page, bandeau dégradé, texte joint par <br>) jugée "bizarre"
// à l'usage : le dégradé passe mal selon les clients, et une couleur
// posée sur le <td> plutôt que sur chaque ligne peut se perdre en route
// (Gmail retouche parfois les styles en ligne). Repris plus près des
// e-mails transactionnels standards (fond blanc uni, liseré de couleur
// sous le nom plutôt qu'un bandeau, couleur redéclarée sur CHAQUE
// paragraphe) pour rester lisible partout sans surprise.
function versHtml(corps) {
  const paragraphes = echapperHtml(corps)
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px; color:#1C2321; font-size:15px; line-height:1.7; font-family:Arial,Helvetica,sans-serif;">${l || '&nbsp;'}</p>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
<tr><td style="padding:24px 28px 16px; border-bottom:3px solid #1D5FA8;">
<span style="color:#1D5FA8; font-size:18px; font-weight:bold; font-family:Arial,Helvetica,sans-serif;">EduSphere</span>
</td></tr>
<tr><td style="padding:22px 28px 6px;">${paragraphes}</td></tr>
<tr><td style="padding:14px 28px 22px; color:#6B7370; font-size:12px; font-family:Arial,Helvetica,sans-serif; border-top:1px solid #E2E5E1;">EduSphere — plateforme de gestion scolaire</td></tr>
</table>
</body></html>`;
}

// Render bloque le SMTP sortant (ports 25/465/587) sur son plan gratuit —
// une API HTTP (port 443, jamais bloqué) est donc la voie prioritaire.
// SendGrid passe avant Resend : sa "Single Sender Verification" ne vérifie
// qu'UNE adresse d'expédition (clic sur un lien reçu par mail, aucun DNS)
// et envoie ensuite vers n'importe quel destinataire réel — alors que le
// mode sandbox de Resend (sans domaine vérifié) refuse tout destinataire
// qui n'est pas exactement le compte vérifié, alias compris. SMTP reste
// utilisable en dev local ou sur un hébergeur qui l'autorise ; sans aucune
// config, simulation par console.log pour ne pas dépendre d'identifiants
// externes.
let transporteurSMTP = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporteurSMTP = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Sans ça, une connexion qui ne répond jamais (port SMTP bloqué par
    // l'hébergeur, ex. Render) bloquait la requête ~2 minutes avant
    // d'échouer — même défaut que le fetch() de Resend/SendGrid avant leur
    // AbortSignal.timeout, ici couvert par les propres options de nodemailer.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

async function envoyerViaSendGrid(destinataire, sujet, corps, piecesJointes) {
  const reponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: destinataire }] }],
      from: { email: process.env.SENDGRID_FROM, name: 'EduSphere' },
      subject: sujet,
      // L'alternative texte brut doit être listée avant le HTML (ordre
      // attendu par SendGrid) — les deux ensemble plutôt que HTML seul,
      // meilleur signal anti-spam qu'un message mono-format.
      content: [
        { type: 'text/plain', value: corps },
        { type: 'text/html', value: versHtml(corps) },
      ],
      // SendGrid refuse la requête entière si `attachments` est présent
      // mais vide ("must have at least one attachment") — la clé ne doit
      // apparaître que lorsqu'il y a vraiment une pièce jointe, jamais en
      // tableau vide comme pour Resend (qui l'accepte sans problème).
      ...(piecesJointes.length > 0 && {
        attachments: piecesJointes.map((p) => ({
          content: fs.readFileSync(p.cheminAbsolu).toString('base64'),
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
      html: versHtml(corps),
      attachments: piecesJointes.map((p) => ({
        filename: p.nomFichier,
        content: fs.readFileSync(p.cheminAbsolu).toString('base64'),
      })),
    }),
    // `fetch` n'a par défaut aucune limite de temps — un Resend qui traîne
    // (ou un simple souci réseau sortant) bloquait la requête entière au
    // lieu de basculer vers le repli, y compris pour la 2FA qui dépend de
    // cet appel avant de répondre au navigateur.
    signal: AbortSignal.timeout(8000),
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
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      await envoyerViaSendGrid(destinataire, sujet, corps, piecesJointes);
      return { envoye: true };
    } catch (err) {
      console.error(`[Service E-mail] Échec SendGrid pour ${destinataire}, repli :`, err.message);
    }
  }

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
    try {
      await transporteurSMTP.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: destinataire,
        subject: sujet,
        text: corps,
        html: versHtml(corps),
        attachments: piecesJointes.map((p) => ({ filename: p.nomFichier, path: p.cheminAbsolu })),
      });
      return { envoye: true };
    } catch (err) {
      // Jamais laissé remonter tel quel (voir le repli Resend ci-dessus,
      // même raisonnement) : une 2FA qui échoue à cause d'un SMTP
      // injoignable ne doit jamais planter la connexion en 500.
      console.error(`[Service E-mail] Échec SMTP pour ${destinataire}, repli en simulation :`, err.message);
    }
  }

  const suffixePieces = piecesJointes.length ? ` (+ ${piecesJointes.map((p) => p.nomFichier).join(', ')})` : '';
  console.log(`[Service E-mail] (aucun envoi configuré, simulation) À: ${destinataire} | Sujet: ${sujet}${suffixePieces}\n${corps}\n`);
  return { envoye: true, simule: true };
}

module.exports = { envoyerEmail };
