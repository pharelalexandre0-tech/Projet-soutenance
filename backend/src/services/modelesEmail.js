// Modèles des e-mails envoyés par EduSphere, au nom de l'établissement.
// Structure d'un e-mail institutionnel : bandeau à l'identité de l'école
// (logo, nom), surtitre et titre, message, l'élément à utiliser (code,
// bouton ou tableau récapitulatif), un encart d'informations, une note de
// sécurité, une signature au nom de l'école et un pied de page avec ses
// coordonnées. Tableaux et styles en ligne : c'est ce que les clients de
// messagerie (Gmail, Outlook, mobile) affichent de façon fiable.

const { urlLogoEtablissement, urlLogoEduSphere, lienPlateforme } = require('../utils/liens');

const COULEURS = {
  marine: '#0B1E3D',
  bleu: '#1D5FA8',
  texte: '#1C2321',
  texteClair: '#5F6765',
  texteDiscret: '#8A918E',
  bordure: '#E2E5E1',
  fond: '#EEF1F4',
  zone: '#F5F7FA',
  succes: '#136B44',
  erreur: '#A23B2E',
  alerte: '#9C6B12',
};
const POLICE = "font-family:'Segoe UI',Arial,'Helvetica Neue',Helvetica,sans-serif;";
const MONO = "font-family:'SFMono-Regular',Consolas,'Courier New',Courier,monospace;";

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Prénoms et noms saisis en minuscules ("alexandre") : un e-mail officiel
// les écrit avec leur majuscule.
function nomPropre(texte) {
  return String(texte || '').trim().toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, sep, lettre) => sep + lettre.toUpperCase());
}

// Accepte l'ancien appel (nom de l'école en texte) comme le nouveau (objet
// Etablissement), pour que chaque e-mail porte l'identité de l'école.
function identite(etablissement) {
  if (!etablissement) return null;
  if (typeof etablissement === 'string') return { nom: etablissement };
  return {
    id: etablissement.id,
    nom: etablissement.nom,
    sigle: etablissement.sigle,
    ville: etablissement.ville,
    pays: etablissement.pays,
    email: etablissement.email,
    telephone: etablissement.telephone,
    boitePostale: etablissement.boitePostale,
    logo: etablissement.logo,
  };
}

function paragraphe(html, marge = '0 0 16px') {
  return `<p style="margin:${marge}; ${POLICE} font-size:15px; line-height:1.65; color:${COULEURS.texte};">${html}</p>`;
}

function blocCode(code, validite) {
  const espace = `${code.slice(0, 3)}&nbsp;${code.slice(3)}`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px;">
  <tr><td align="center" style="background-color:${COULEURS.zone}; border:1px solid ${COULEURS.bordure}; border-radius:8px; padding:24px 16px 20px;">
    <div style="${POLICE} font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.texteClair};">Code de vérification</div>
    <div style="${MONO} font-size:36px; font-weight:bold; letter-spacing:6px; color:${COULEURS.marine}; margin-top:10px;">${espace}</div>
    ${validite ? `<div style="${POLICE} font-size:13px; color:${COULEURS.texteClair}; margin-top:10px;">${validite}</div>` : ''}
  </td></tr>
</table>`;
}

function blocValeur(libelle, valeur) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px;">
  <tr><td align="center" style="background-color:${COULEURS.zone}; border:1px solid ${COULEURS.bordure}; border-radius:8px; padding:22px 16px;">
    <div style="${POLICE} font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.texteClair};">${echapper(libelle)}</div>
    <div style="${MONO} font-size:26px; font-weight:bold; letter-spacing:2px; color:${COULEURS.marine}; margin-top:8px;">${echapper(valeur)}</div>
  </td></tr>
</table>`;
}

function bouton(libelle, lien) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr><td style="background-color:${COULEURS.marine}; border-radius:6px;">
    <a href="${echapper(lien)}" style="display:inline-block; padding:14px 30px; ${POLICE} font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">${echapper(libelle)}</a>
  </td></tr>
</table>`;
}

function lienDeSecours(lien) {
  return `<p style="margin:0 0 24px; ${POLICE} font-size:12.5px; line-height:1.6; color:${COULEURS.texteClair};">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br><a href="${echapper(lien)}" style="color:${COULEURS.bleu}; word-break:break-all;">${echapper(lien)}</a></p>`;
}

// Tableau "libellé / valeur" (détails de la demande, portée d'un accès...).
function tableauDetails(lignes, titre) {
  const rangees = lignes.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([cle, valeur], i) => `
    <tr>
      <td style="padding:11px 16px; ${POLICE} font-size:13.5px; color:${COULEURS.texteClair}; width:38%; vertical-align:top; ${i ? `border-top:1px solid ${COULEURS.bordure};` : ''}">${echapper(cle)}</td>
      <td style="padding:11px 16px; ${POLICE} font-size:14px; font-weight:bold; color:${COULEURS.texte}; vertical-align:top; ${i ? `border-top:1px solid ${COULEURS.bordure};` : ''}">${echapper(valeur)}</td>
    </tr>`).join('');
  return `
${titre ? `<div style="${POLICE} font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.texteClair}; margin:4px 0 8px;">${echapper(titre)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px; border:1px solid ${COULEURS.bordure}; border-radius:8px; border-collapse:separate;">${rangees}</table>`;
}

// Note de bas de message (sécurité, bon à savoir) : texte discret séparé
// par un filet, sans encadré coloré.
function note(titre, html) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
  <tr><td style="border-top:1px solid ${COULEURS.bordure}; padding-top:18px; ${POLICE} font-size:13px; line-height:1.6; color:${COULEURS.texteClair};">
    ${titre ? `<strong style="color:${COULEURS.texte};">${echapper(titre)}</strong><br>` : ''}${html}
  </td></tr>
</table>`;
}

function maintenant() {
  return new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' });
}

// Cadre commun : bandeau d'identité, contenu, signature, pied de page.
function cadre({ surtitre, titre, contenu, etablissement, preEntete }) {
  const etab = identite(etablissement);
  const annee = new Date().getFullYear();
  const logo = urlLogoEtablissement(etab) || urlLogoEduSphere();
  const nom = etab?.nom || 'EduSphere';
  const lieu = [etab?.ville, etab?.pays].filter(Boolean).join(', ');
  const contacts = [etab?.boitePostale, etab?.telephone, etab?.email].filter(Boolean).map(echapper).join(' &nbsp;·&nbsp; ');
  const signature = etab?.nom ? `Le service de la scolarité<br><strong>${echapper(etab.nom)}</strong>` : "<strong>L'équipe EduSphere</strong>";

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${echapper(titre || nom)}</title></head>
<body style="margin:0; padding:0; background-color:${COULEURS.fond}; -webkit-text-size-adjust:100%;">
${preEntete ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${echapper(preEntete)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COULEURS.fond};">
<tr><td align="center" style="padding:36px 12px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="background-color:${COULEURS.marine}; border-radius:10px 10px 0 0; padding:20px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:44px; height:44px; background-color:#ffffff; border-radius:8px; text-align:center; vertical-align:middle;">
          <img src="${echapper(logo)}" width="34" height="34" alt="" style="display:block; margin:5px; width:34px; height:34px; object-fit:contain; border:0;">
        </td>
        <td style="padding-left:14px; ${POLICE}">
          <div style="font-size:16px; font-weight:bold; line-height:1.3; color:#ffffff;">${echapper(nom)}</div>
          ${lieu ? `<div style="font-size:12.5px; line-height:1.4; color:#AEBBD0; margin-top:2px;">${echapper(lieu)}</div>` : ''}
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background-color:#ffffff; padding:36px 40px 32px; border-left:1px solid ${COULEURS.bordure}; border-right:1px solid ${COULEURS.bordure};">
      ${surtitre ? `<div style="${POLICE} font-size:11.5px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.bleu}; margin:0 0 8px;">${echapper(surtitre)}</div>` : ''}
      ${titre ? `<h1 style="margin:0 0 22px; ${POLICE} font-size:23px; line-height:1.3; font-weight:bold; color:${COULEURS.texte};">${echapper(titre)}</h1>` : ''}
      ${contenu}
      ${paragraphe(`Cordialement,<br>${signature}`, '26px 0 0')}
    </td></tr>
    <tr><td style="background-color:${COULEURS.zone}; border:1px solid ${COULEURS.bordure}; border-radius:0 0 10px 10px; padding:20px 40px; ${POLICE} font-size:12px; line-height:1.65; color:${COULEURS.texteClair};">
      <strong style="color:${COULEURS.texte};">${echapper(nom)}</strong>${lieu ? `, ${echapper(lieu)}` : ''}<br>
      ${contacts ? `${contacts}<br>` : ''}
      Message automatique envoyé via la plateforme EduSphere. Merci de ne pas y répondre directement.
    </td></tr>
    <tr><td align="center" style="padding:18px 12px 0; ${POLICE} font-size:11.5px; color:${COULEURS.texteDiscret};">
      © ${annee} EduSphere, plateforme de gestion scolaire
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function salutation(prenom) {
  return prenom ? `Bonjour ${echapper(nomPropre(prenom))},` : 'Bonjour,';
}

function texteBrut(lignes, etablissement) {
  const etab = identite(etablissement);
  return [...lignes, '', 'Cordialement,', etab?.nom ? `Le service de la scolarité, ${etab.nom}` : "L'équipe EduSphere"].join('\n');
}

const ESPACES = {
  academie: 'Académie',
  finance: 'Finance',
  etudiant: 'Étudiant',
  parent: 'Parents',
  superadmin: 'Administration de la plateforme',
};

// Code de double authentification (étudiants et parents).
function emailCodeConnexion({ prenom, code, minutes, etablissement, role, email }) {
  const etab = identite(etablissement);
  const espace = ESPACES[role] ? `Espace ${ESPACES[role]}` : 'Votre espace';
  const sujet = `${code} est votre code de connexion`;
  const texte = texteBrut([
    salutation(prenom),
    '',
    `Pour terminer votre connexion à l'${espace.toLowerCase()}${etab?.nom ? ` de ${etab.nom}` : ''}, saisissez ce code de vérification :`,
    '',
    `    ${code}`,
    '',
    `Il est valable ${minutes} minutes et ne peut servir qu'une seule fois.`,
    '',
    "Vous n'êtes pas à l'origine de cette connexion ? Ignorez ce message : sans ce code, personne ne peut accéder à votre compte. Ne le communiquez à personne, même à un membre de l'administration.",
  ], etablissement);
  const html = cadre({
    surtitre: 'Sécurité du compte',
    titre: 'Confirmez votre connexion',
    etablissement,
    preEntete: `Votre code de connexion est ${code}. Il expire dans ${minutes} minutes.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe('Une connexion à votre compte vient d\'être demandée. Pour la confirmer, saisissez le code ci-dessous sur la page de connexion.'),
      blocCode(code, `Expire dans ${minutes} minutes · usage unique`),
      tableauDetails([
        ['Compte', email],
        ['Espace', espace],
        ['Date', maintenant()],
      ], 'Détails de la demande'),
      note("Vous n'êtes pas à l'origine de cette demande ?", 'Ignorez ce message : sans ce code, personne ne peut accéder à votre compte. Ne communiquez jamais ce code, même à un membre de l\'administration.'),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Lien de réinitialisation du mot de passe (hors étudiants).
function emailReinitialisation({ prenom, email, lien, minutes, etablissement }) {
  const sujet = 'Réinitialisation de votre mot de passe';
  const texte = texteBrut([
    salutation(prenom),
    '',
    `Nous avons reçu une demande de réinitialisation du mot de passe du compte associé à l'adresse ${email}.`,
    '',
    `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${minutes} minutes, usage unique) :`,
    lien,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.",
  ], etablissement);
  const html = cadre({
    surtitre: 'Sécurité du compte',
    titre: 'Choisissez un nouveau mot de passe',
    etablissement,
    preEntete: `Lien de réinitialisation valable ${minutes} minutes.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`Nous avons reçu une demande de réinitialisation du mot de passe du compte <strong>${echapper(email)}</strong>. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.`),
      bouton('Choisir un nouveau mot de passe', lien),
      tableauDetails([
        ['Compte', email],
        ['Validité du lien', `${minutes} minutes, usage unique`],
        ['Demande reçue le', maintenant()],
      ], 'Détails de la demande'),
      lienDeSecours(lien),
      note("Vous n'avez rien demandé ?", 'Ignorez ce message : votre mot de passe actuel reste inchangé et personne ne peut le modifier sans ce lien.'),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Un étudiant n'a pas de mot de passe à réinitialiser : c'est son matricule.
function emailRappelMatricule({ prenom, matricule, email, etablissement }) {
  const sujet = 'Vos informations de connexion';
  const texte = texteBrut([
    salutation(prenom),
    '',
    'Vous avez demandé à réinitialiser votre mot de passe.',
    '',
    `Le mot de passe d'un compte étudiant est son numéro de matricule : ${matricule}`,
    '',
    "Il ne se modifie pas. Si vous ne parvenez toujours pas à vous connecter, adressez-vous au service de la scolarité.",
  ], etablissement);
  const html = cadre({
    surtitre: 'Compte étudiant',
    titre: 'Vos informations de connexion',
    etablissement,
    preEntete: 'Le mot de passe de votre compte étudiant est votre matricule.',
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe('Vous avez demandé à réinitialiser votre mot de passe. Sur votre compte étudiant, le mot de passe est votre <strong>numéro de matricule</strong>, attribué par l\'établissement à votre inscription.'),
      blocValeur('Votre matricule', matricule),
      tableauDetails([
        ['Identifiant', email],
        ['Mot de passe', 'votre matricule, ci-dessus'],
      ], 'Pour vous connecter'),
      paragraphe('Il ne se modifie pas. Si vous ne parvenez toujours pas à vous connecter, adressez-vous au service de la scolarité.', '0 0 8px'),
      note("Vous n'êtes pas à l'origine de cette demande ?", 'Aucune action n\'est nécessaire : chaque connexion demande aussi un code envoyé à cette adresse e-mail.'),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Lien d'accès temporaire envoyé à un professeur (saisie des notes ou appel).
function emailAccesTemporaire({ prenom, tache, classe, matiere, evaluation, categorie, lien, expiration, etablissement }) {
  const etab = identite(etablissement);
  const appel = tache === 'saisie_absences';
  const action = appel ? "faire l'appel" : 'saisir les notes';
  const titre = appel ? "Faites l'appel de votre classe" : 'Saisissez les notes de votre classe';
  const sujet = `${appel ? 'Appel' : 'Saisie des notes'} : ${classe}${matiere ? `, ${matiere}` : ''}`;
  const lignesPortee = [
    ['Classe', classe],
    ['Matière', matiere],
    ['Évaluation', appel ? null : `${categorie === 'examen' ? 'Examen' : 'Contrôle continu'}${evaluation ? `, ${evaluation}` : ''}`],
    ['Lien valable jusqu\'au', expiration],
  ];
  const texte = texteBrut([
    salutation(prenom),
    '',
    `${etab?.nom || 'Votre établissement'} vous a ouvert un accès temporaire pour ${action} :`,
    ...lignesPortee.filter(([, v]) => v).map(([cle, valeur]) => `- ${cle} : ${valeur}`),
    '',
    "Ouvrez ce lien pour commencer (aucun mot de passe n'est nécessaire) :",
    lien,
    '',
    "L'accès se ferme automatiquement dès que votre saisie est envoyée, ou à l'heure indiquée ci-dessus.",
  ], etablissement);
  const html = cadre({
    surtitre: 'Accès temporaire professeur',
    titre,
    etablissement,
    preEntete: `Accès pour ${action} en ${classe}, valable jusqu'au ${expiration}.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`${echapper(etab?.nom || 'Votre établissement')} vous a ouvert un accès temporaire pour <strong>${action}</strong>. Aucun compte ni mot de passe n'est nécessaire.`),
      tableauDetails(lignesPortee, 'Votre mission'),
      bouton(appel ? "Faire l'appel" : 'Saisir les notes', lien),
      lienDeSecours(lien),
      note('Bon à savoir', "Ce lien vous est personnel, ne le transférez pas. L'accès se ferme dès que votre saisie est envoyée, ou à l'heure indiquée. Besoin de plus de temps ? Demandez un nouvel accès au service de la scolarité."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Publication (ou mise à jour) de l'emploi du temps d'une classe.
function emailEmploiDuTemps({ prenom, classe, miseAJour, nbCours, semestre, etablissement }) {
  const lien = lienPlateforme();
  const titre = miseAJour ? 'Votre emploi du temps a été mis à jour' : 'Votre emploi du temps est disponible';
  const sujet = `${miseAJour ? 'Mise à jour de l\'emploi du temps' : 'Emploi du temps publié'} : ${classe}`;
  const texte = texteBrut([
    salutation(prenom),
    '',
    `${miseAJour ? "L'emploi du temps" : 'Le nouvel emploi du temps'} de la classe ${classe} vient d'être ${miseAJour ? 'mis à jour' : 'publié'}${semestre ? ` (${semestre})` : ''}.`,
    `Il compte ${nbCours} cours par semaine. Consultez-le dans votre espace :`,
    lien,
  ], etablissement);
  const html = cadre({
    surtitre: 'Emploi du temps',
    titre,
    etablissement,
    preEntete: `${classe} : ${nbCours} cours par semaine.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`${miseAJour ? "L'emploi du temps" : 'Le nouvel emploi du temps'} de la classe <strong>${echapper(classe)}</strong> vient d'être ${miseAJour ? 'mis à jour. Pensez à vérifier les changements' : 'publié'}.`),
      tableauDetails([
        ['Classe', classe],
        ['Période', semestre],
        ['Cours par semaine', String(nbCours)],
        ['Publié le', maintenant()],
      ]),
      bouton("Voir l'emploi du temps", lien),
      note(null, "L'emploi du temps est aussi disponible en permanence dans votre espace, rubrique « Emploi du temps »."),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Incident de comportement signalé à un parent.
function emailIncident({ prenom, eleve, date, gravite, description, etablissement }) {
  const majeur = gravite === 'majeur';
  const sujet = `Signalement de comportement : ${eleve}`;
  const texte = texteBrut([
    salutation(prenom),
    '',
    `Nous vous informons qu'un incident ${majeur ? 'majeur' : 'mineur'} concernant ${eleve} a été consigné le ${date} :`,
    description,
    '',
    "Pour en discuter, vous pouvez contacter le service de la scolarité de l'établissement.",
  ], etablissement);
  const html = cadre({
    surtitre: 'Vie scolaire',
    titre: `Signalement concernant ${eleve}`,
    etablissement,
    preEntete: `Incident ${majeur ? 'majeur' : 'mineur'} consigné le ${date}.`,
    contenu: [
      paragraphe(salutation(prenom)),
      paragraphe(`Nous vous informons qu'un incident de comportement concernant <strong>${echapper(eleve)}</strong> a été consigné dans son dossier scolaire.`),
      tableauDetails([
        ['Élève', eleve],
        ['Date', date],
        ['Gravité', majeur ? 'Majeur' : 'Mineur'],
        ['Motif', description],
      ]),
      paragraphe("Nous restons à votre disposition pour en discuter : vous pouvez contacter le service de la scolarité ou demander un rendez-vous.", '0 0 8px'),
      note(null, 'Ce signalement est aussi visible dans votre espace Parents.'),
    ].join(''),
  });
  return { sujet, texte, html };
}

// Tous les autres e-mails (absence, bulletin, relance, reçu, message de
// l'école...) : leur texte brut, mis en forme dans le même cadre. Un code à
// 6 chiffres devient un bloc de code, une ligne qui n'est qu'un lien devient
// un bouton.
const RE_CODE = /\b(\d{6})\b/;
const RE_LIEN = /^(https?:\/\/\S+)$/;

function emailGenerique(corps, { titre, etablissement, surtitre } = {}) {
  const contenu = String(corps).split('\n').map((ligne) => {
    const lien = ligne.trim().match(RE_LIEN);
    if (lien) return bouton('Ouvrir', lien[1]) + lienDeSecours(lien[1]);
    const code = ligne.match(RE_CODE);
    if (code) {
      const avant = ligne.slice(0, code.index).trim();
      const apres = ligne.slice(code.index + code[0].length).trim();
      return (avant ? paragraphe(echapper(avant), '0 0 8px') : '') + blocCode(code[1]) + (apres ? paragraphe(echapper(apres)) : '');
    }
    return ligne.trim() ? paragraphe(echapper(ligne)) : '';
  }).join('');
  return cadre({ surtitre, titre, contenu, etablissement });
}

module.exports = {
  emailCodeConnexion, emailReinitialisation, emailRappelMatricule, emailAccesTemporaire, emailEmploiDuTemps, emailIncident,
  emailGenerique, nomPropre,
};
