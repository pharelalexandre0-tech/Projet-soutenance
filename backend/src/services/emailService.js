const fs = require('fs');
const nodemailer = require('nodemailer');

function echapperHtml(texte) {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Troisième passe. V1 (fond gris pleine page, bandeau dégradé) : "bizarre"
// — rendu incohérent d'un client à l'autre. V2 (fond blanc, nom en gras +
// liseré, paragraphes gris uniformes) : "trop IA" — exactement le gabarit
// que produirait n'importe quel générateur générique, aucune identité
// propre. Ce qui manquait aux deux : un vrai point focal. Un e-mail de
// code n'est lu que pour UNE information — le code — le reste n'est que
// contexte ; la mise en avant du code (grand, espacé, encadré) EST le
// design, pas une paragraphe parmi d'autres. Le petit sceau "ES" reprend
// la marque du logo réel sans dépendre d'une image hébergée (fragile par
// e-mail — beaucoup de clients bloquent les images distantes par défaut).
const RE_CODE = /\b(\d{6})\b/;
// Un lien d'accès (compte éphémère, réinitialisation...) mérite le même
// traitement que le code à 6 chiffres : isolé sur sa propre ligne dans le
// texte source, il devient ici un vrai bouton plutôt qu'une URL brute
// perdue au milieu d'un paragraphe — c'est justement ce qui manquait pour
// que l'e-mail ait l'air d'un produit fini plutôt que d'un log technique.
const RE_LIEN = /^(https?:\/\/\S+)$/;

function versHtml(corps) {
  const blocs = echapperHtml(corps)
    .split('\n')
    .map((ligne) => {
      const lienTrouve = ligne.trim().match(RE_LIEN);
      if (lienTrouve) {
        return `<p style="margin:6px 0 18px; text-align:center;"><a href="${lienTrouve[1]}" style="display:inline-block; padding:13px 30px; background-color:#1D5FA8; color:#ffffff; font-size:15px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; text-decoration:none; border-radius:8px;">Ouvrir l'accès</a></p>`;
      }
      const trouve = ligne.match(RE_CODE);
      if (!trouve) {
        return `<p style="margin:0 0 12px; color:#1C2321; font-size:15px; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">${ligne || '&nbsp;'}</p>`;
      }
      const avant = ligne.slice(0, trouve.index);
      const apres = ligne.slice(trouve.index + trouve[0].length);
      return (
        (avant ? `<p style="margin:0 0 6px; color:#1C2321; font-size:15px; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">${avant}</p>` : '') +
        `<p style="margin:6px 0 16px; padding:16px 0; background-color:#E3ECF6; border-radius:8px; text-align:center; color:#164A85; font-size:30px; font-weight:bold; letter-spacing:0.3em; font-family:'Courier New',Courier,monospace;">${trouve[1]}</p>` +
        (apres ? `<p style="margin:0 0 12px; color:#1C2321; font-size:15px; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">${apres}</p>` : '')
      );
    })
    .join('');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head><body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
<tr><td style="padding:28px 28px 18px;">
<table role="presentation" style="border-collapse:collapse;"><tr>
<td style="width:34px; height:34px; background-color:#1D5FA8; border-radius:50%; text-align:center; vertical-align:middle; font-size:0;">
<span style="color:#ffffff; font-size:13px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; line-height:34px;">ES</span>
</td>
<td style="padding-left:10px; color:#0B1E3D; font-size:17px; font-weight:bold; font-family:Arial,Helvetica,sans-serif;">EduSphere</td>
</tr></table>
</td></tr>
<tr><td style="padding:2px 28px 8px;">${blocs}</td></tr>
<tr><td style="padding:18px 28px 26px; color:#6B7370; font-size:12px; font-family:Arial,Helvetica,sans-serif; border-top:1px solid #E2E5E1;">EduSphere — plateforme de gestion scolaire</td></tr>
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
