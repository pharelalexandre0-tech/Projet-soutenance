// Modèles des e-mails envoyés par EduSphere. Chaque message suit la même
// structure qu'un e-mail de service professionnel : en-tête de marque,
// titre, formule d'appel, contexte, l'élément à utiliser (code ou bouton),
// sa durée de validité, un avertissement de sécurité, une signature et un
// pied de page qui dit pourquoi on reçoit ce message. Tableaux et styles en
// ligne : c'est ce que les clients de messagerie affichent de façon fiable.

const COULEURS = {
  marine: '#0B1E3D',
  bleu: '#1D5FA8',
  texte: '#1C2321',
  texteClair: '#5F6765',
  bordure: '#E2E5E1',
  fond: '#F4F6F8',
  codeFond: '#F1F5FA',
  codeBordure: '#D6E2F0',
  or: '#F0AD2E',
};
const POLICE = "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;";

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function paragraphe(html, marge = '0 0 16px') {
  return `<p style="margin:${marge}; ${POLICE} font-size:15px; line-height:1.65; color:${COULEURS.texte};">${html}</p>`;
}

function blocCode(code, validite) {
  const espace = `${code.slice(0, 3)}&nbsp;${code.slice(3)}`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px; border-collapse:separate;">
  <tr><td align="center" style="background-color:${COULEURS.codeFond}; border:1px solid ${COULEURS.codeBordure}; border-radius:10px; padding:22px 16px;">
    <div style="font-family:'Courier New',Courier,monospace; font-size:34px; font-weight:bold; letter-spacing:6px; color:${COULEURS.marine};">${espace}</div>
    ${validite ? `<div style="${POLICE} font-size:13px; color:${COULEURS.texteClair}; margin-top:8px;">${validite}</div>` : ''}
  </td></tr>
</table>`;
}

function bouton(libelle, lien) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px; border-collapse:separate;">
  <tr><td style="background-color:${COULEURS.bleu}; border-radius:8px;">
    <a href="${echapper(lien)}" style="display:inline-block; padding:14px 28px; ${POLICE} font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">${libelle}</a>
  </td></tr>
</table>`;
}

function lienDeSecours(lien) {
  return `<p style="margin:0 0 22px; ${POLICE} font-size:13px; line-height:1.6; color:${COULEURS.texteClair};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${echapper(lien)}" style="color:${COULEURS.bleu}; word-break:break-all;">${echapper(lien)}</a></p>`;
}

function encadreSecurite(html) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px; border-collapse:separate;">
  <tr><td style="background-color:${COULEURS.fond}; border-left:3px solid ${COULEURS.or}; border-radius:6px; padding:14px 16px; ${POLICE} font-size:13.5px; line-height:1.6; color:${COULEURS.texte};">${html}</td></tr>
</table>`;
}

// Cadre commun : en-tête de marque, contenu, signature, pied de page.
function cadre({ titre, contenu, etablissement, preEntete }) {
  const annee = new Date().getFullYear();
  const pourQui = etablissement
    ? `pour le compte de ${echapper(etablissement)}`
    : 'dans le cadre de votre compte';
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(titre || 'EduSphere')}</title></head>
<body style="margin:0; padding:0; background-color:${COULEURS.fond};">
${preEntete ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${echapper(preEntete)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COULEURS.fond};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border:1px solid ${COULEURS.bordure}; border-radius:12px; border-collapse:separate;">
    <tr><td style="padding:22px 32px; border-bottom:1px solid ${COULEURS.bordure};">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px; height:36px; background-color:${COULEURS.marine}; border-radius:50%; text-align:center; vertical-align:middle;">
          <span style="${POLICE} font-size:13px; font-weight:bold; color:#ffffff; line-height:36px;">ES</span>
        </td>
        <td style="padding-left:12px; ${POLICE}">
          <div style="font-size:17px; font-weight:bold; color:${COULEURS.marine};">EduSphere</div>
          ${etablissement ? `<div style="font-size:12.5px; color:${COULEURS.texteClair}; margin-top:2px;">${echapper(etablissement)}</div>` : ''}
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;">
      ${titre ? `<h1 style="margin:0 0 20px; ${POLICE} font-size:22px; line-height:1.3; font-weight:bold; color:${COULEURS.texte};">${echapper(titre)}</h1>` : ''}
      ${contenu}
      ${paragraphe(`Cordialement,<br><strong>L'équipe EduSphere</strong>`, '8px 0 28px')}
    </td></tr>
    <tr><td style="padding:18px 32px; background-color:#FAFBFC; border-top:1px solid ${COULEURS.bordure}; border-radius:0 0 12px 12px; ${POLICE} font-size:12px; line-height:1.6; color:${COULEURS.texteClair};">
      Cet e-mail vous a été envoyé automatiquement par EduSphere ${pourQui}. Merci de ne pas y répondre directement.
    </td></tr>
  </table>
  <div style="${POLICE} font-size:12px; color:${COULEURS.texteClair}; margin-top:16px;">© ${annee} EduSphere, plateforme de gestion scolaire</div>
</td></tr>
</table>
</body></html>`;
}

function salutation(prenom) {
  return prenom ? `Bonjour ${echapper(prenom)},` : 'Bonjour,';
}

const ESPACES = {
  academie: "l'espace Académie",
  finance: "l'espace Finance",
  etudiant: "l'espace Étudiant",
  parent: "l'espace Parents",
  superadmin: "l'espace d'administration",
};

// Code de double authentification (étudiants et parents).
function emailCodeConnexion({ prenom, code, minutes, etablissement, role }) {
  const espace = ESPACES[role] || 'votre espace';
  const lieu = etablissement ? `${espace} de ${etablissement}` : espace;
  const sujet = 'Votre code de connexion EduSphere';
  const texte = [
    salutation(prenom),
    '',
    `Pour terminer votre connexion à ${lieu}, saisissez le code de vérification suivant :`,
    '',
    `    ${code}`,
    '',
    `Ce code est valable ${minutes} minutes et ne peut être utilisé qu'une seule fois.`,
    '',
    "Vous n'êtes pas à l'origine de cette tentative de connexion ? Ignorez simplement ce message : sans ce code, personne ne peut accéder à votre compte. Ne communiquez jamais ce code, même à un membre de l'administration.",
    '',
    'Cordialement,',
    "L'équipe EduSphere",
  ].join('\n');
  const html = cadre({
    titre: 'Confirmez votre connexion',
    etablissement,
    preEntete: `Votre code de connexion est ${code}, valable ${minutes} minutes.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`Pour terminer votre connexion à ${echapper(lieu)}, saisissez le code de vérification ci-dessous dans la page de connexion.`),
      blocCode(code, `Valable ${minutes} minutes, pour une seule utilisation`),
      encadreSecurite("<strong>Vous n'êtes pas à l'origine de cette demande ?</strong> Ignorez simplement ce message : sans ce code, personne ne peut accéder à votre compte. Ne communiquez jamais ce code, même à un membre de l'administration."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Lien de réinitialisation du mot de passe (hors étudiants).
function emailReinitialisation({ prenom, email, lien, minutes, etablissement }) {
  const sujet = 'Réinitialisation de votre mot de passe EduSphere';
  const texte = [
    salutation(prenom),
    '',
    `Nous avons reçu une demande de réinitialisation du mot de passe du compte EduSphere associé à l'adresse ${email}.`,
    '',
    `Pour choisir un nouveau mot de passe, ouvrez le lien suivant (valable ${minutes} minutes, pour une seule utilisation) :`,
    lien,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.",
    '',
    'Cordialement,',
    "L'équipe EduSphere",
  ].join('\n');
  const html = cadre({
    titre: 'Réinitialisation de votre mot de passe',
    etablissement,
    preEntete: `Choisissez un nouveau mot de passe. Lien valable ${minutes} minutes.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`Nous avons reçu une demande de réinitialisation du mot de passe du compte EduSphere associé à l'adresse <strong>${echapper(email)}</strong>.`),
      paragraphe('Pour choisir un nouveau mot de passe, cliquez sur le bouton ci-dessous :', '0 0 8px'),
      bouton('Choisir un nouveau mot de passe', lien),
      paragraphe(`Ce lien est valable <strong>${minutes} minutes</strong> et ne peut servir qu'une seule fois.`, '0 0 12px'),
      lienDeSecours(lien),
      encadreSecurite("<strong>Vous n'avez rien demandé ?</strong> Ignorez ce message : votre mot de passe actuel reste inchangé et personne ne peut le modifier sans ce lien."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Un étudiant n'a pas de mot de passe à réinitialiser : c'est son matricule.
function emailRappelMatricule({ prenom, matricule, etablissement }) {
  const sujet = 'Vos informations de connexion EduSphere';
  const texte = [
    salutation(prenom),
    '',
    'Vous avez demandé à réinitialiser votre mot de passe EduSphere.',
    '',
    `Le mot de passe d'un compte étudiant est son numéro de matricule : ${matricule}`,
    '',
    "Il ne se modifie pas. Si vous ne parvenez toujours pas à vous connecter, adressez-vous au service Académie de votre établissement.",
    '',
    'Cordialement,',
    "L'équipe EduSphere",
  ].join('\n');
  const html = cadre({
    titre: 'Vos informations de connexion',
    etablissement,
    preEntete: 'Le mot de passe de votre compte étudiant est votre matricule.',
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe('Vous avez demandé à réinitialiser votre mot de passe EduSphere. Le mot de passe d\'un compte étudiant est son <strong>numéro de matricule</strong>, attribué par votre établissement :'),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td align="center" style="background-color:${COULEURS.codeFond}; border:1px solid ${COULEURS.codeBordure}; border-radius:10px; padding:18px 16px; font-family:'Courier New',Courier,monospace; font-size:24px; font-weight:bold; letter-spacing:2px; color:${COULEURS.marine};">${echapper(matricule)}</td></tr></table>`,
      paragraphe('Il ne se modifie pas. Si vous ne parvenez toujours pas à vous connecter, adressez-vous au service Académie de votre établissement.'),
      encadreSecurite("<strong>Vous n'êtes pas à l'origine de cette demande ?</strong> Aucune action n'est nécessaire : la connexion demande aussi un code envoyé à cette adresse e-mail."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Lien d'accès temporaire envoyé à un professeur (saisie des notes ou appel).
function emailAccesTemporaire({ prenom, tache, classe, matiere, evaluation, categorie, lien, expiration, etablissement }) {
  const action = tache === 'saisie_absences' ? "faire l'appel" : 'saisir les notes';
  const titre = tache === 'saisie_absences' ? "Accès temporaire : faire l'appel" : 'Accès temporaire : saisie des notes';
  const sujet = `${titre} (${classe})`;
  const lignesPortee = [
    ['Classe', classe],
    ...(matiere ? [['Matière', matiere]] : []),
    ...(tache !== 'saisie_absences' ? [['Évaluation', `${categorie === 'examen' ? 'Examen' : 'Contrôle continu'}${evaluation ? `, ${evaluation}` : ''}`]] : []),
    ['Valable jusqu\'au', expiration],
  ];
  const texte = [
    salutation(prenom),
    '',
    `${etablissement || 'Votre établissement'} vous a ouvert un accès temporaire pour ${action} :`,
    ...lignesPortee.map(([cle, valeur]) => `- ${cle} : ${valeur}`),
    '',
    'Ouvrez ce lien pour commencer (aucun mot de passe n\'est nécessaire) :',
    lien,
    '',
    "L'accès se ferme automatiquement dès que votre saisie est envoyée, ou à l'heure indiquée ci-dessus.",
    '',
    'Cordialement,',
    "L'équipe EduSphere",
  ].join('\n');
  const tableau = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px; border:1px solid ${COULEURS.bordure}; border-radius:10px; border-collapse:separate;">${
    lignesPortee.map(([cle, valeur], i) => `<tr><td style="padding:11px 16px; ${POLICE} font-size:13.5px; color:${COULEURS.texteClair}; ${i ? `border-top:1px solid ${COULEURS.bordure};` : ''} width:40%;">${echapper(cle)}</td><td style="padding:11px 16px; ${POLICE} font-size:14px; font-weight:bold; color:${COULEURS.texte}; ${i ? `border-top:1px solid ${COULEURS.bordure};` : ''}">${echapper(valeur)}</td></tr>`).join('')
  }</table>`;
  const html = cadre({
    titre,
    etablissement,
    preEntete: `Accès pour ${action} en ${classe}, valable jusqu'au ${expiration}.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`${echapper(etablissement || 'Votre établissement')} vous a ouvert un accès temporaire pour <strong>${action}</strong> :`),
      tableau,
      bouton(tache === 'saisie_absences' ? "Faire l'appel" : 'Saisir les notes', lien),
      paragraphe("Aucun mot de passe n'est nécessaire : ce lien vous est personnel, ne le transférez pas.", '0 0 12px'),
      lienDeSecours(lien),
      encadreSecurite("<strong>Bon à savoir :</strong> l'accès se ferme automatiquement dès que votre saisie est envoyée, ou à l'heure indiquée ci-dessus. Si vous avez besoin de plus de temps, demandez un nouvel accès au service Académie."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Tous les autres e-mails (accès temporaire d'un professeur, bulletin,
// relance, reçu...) : leur texte brut, mis en forme dans le même cadre. Un
// code à 6 chiffres devient un bloc de code, une ligne qui n'est qu'un lien
// devient un bouton.
const RE_CODE = /\b(\d{6})\b/;
const RE_LIEN = /^(https?:\/\/\S+)$/;

function emailGenerique(corps, { titre, etablissement } = {}) {
  const contenu = String(corps).split('\n').map((ligne) => {
    const lien = ligne.trim().match(RE_LIEN);
    if (lien) return bouton("Ouvrir l'accès", lien[1]) + lienDeSecours(lien[1]);
    const code = ligne.match(RE_CODE);
    if (code) {
      const avant = ligne.slice(0, code.index).trim();
      const apres = ligne.slice(code.index + code[0].length).trim();
      return (avant ? paragraphe(echapper(avant), '0 0 8px') : '') + blocCode(code[1]) + (apres ? paragraphe(echapper(apres)) : '');
    }
    return ligne.trim() ? paragraphe(echapper(ligne)) : '';
  }).join('');
  return cadre({ titre, contenu, etablissement });
}

module.exports = { emailCodeConnexion, emailReinitialisation, emailRappelMatricule, emailAccesTemporaire, emailGenerique };
