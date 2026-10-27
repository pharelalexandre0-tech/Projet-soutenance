const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { certifier, sceller, urlVerification } = require('./certificationService');

const DOSSIER_STOCKAGE = path.join(__dirname, '..', '..', 'storage', 'pdfs');
fs.mkdirSync(DOSSIER_STOCKAGE, { recursive: true });

// Palette EduSphere — doit rester alignée avec les variables CSS du
// frontend (frontend/src/styles.css :root) : marine / bleu / vert / or.
const COULEUR_PRIMAIRE = '#1D5FA8'; // --edu-bleu
const COULEUR_OR = '#B8860B'; // --edu-or assombri pour rester lisible sur fond blanc
const COULEUR_TEXTE = '#1C2321';
const COULEUR_TEXTE_CLAIR = '#6B7370';
const COULEUR_BORDURE = '#D8DCD6';
const COULEUR_SUCCES = '#136B44';
const COULEUR_SUCCES_FOND = '#E7F1EC';
const COULEUR_ERREUR = '#A23B2E';
const COULEUR_ERREUR_FOND = '#F6E7E4';
const COULEUR_UE_FOND = '#E3ECF6';
const COULEUR_RATTRAPAGE = '#A67C1E';
const COULEUR_MARINE = '#0B1E3D';

// Une UE passée par le rattrapage n'est jamais étiquetée "validée" au même
// titre qu'une validation en session normale, même si la moyenne recalculée
// franchit le seuil — voir moyenneService.calculerBulletin.
function libelleResultatUE(ligneUE) {
  if (ligneUE.eliminatoire) {
    return { texte: ligneUE.session === 'rattrapage' ? 'Éliminatoire (rattr.)' : 'Éliminatoire', couleur: COULEUR_ERREUR };
  }
  if (ligneUE.session === 'rattrapage') return { texte: 'Rattrapage', couleur: COULEUR_RATTRAPAGE };
  if (ligneUE.valide) return { texte: 'Validée', couleur: COULEUR_SUCCES };
  return { texte: 'Non validée', couleur: COULEUR_ERREUR };
}

// Logo de l'établissement, dessiné en haut à gauche de chaque document
// officiel — absent si non renseigné ou illisible, jamais un document qui
// échoue pour autant (un logo cassé ne doit jamais empêcher un reçu ou un
// bulletin de sortir).
function dessinerLogo(doc, etablissement, x, y, taille = 40) {
  if (!etablissement.logo) return false;
  try {
    const base64 = etablissement.logo.split(',')[1];
    doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [taille, taille], align: 'center', valign: 'center' });
    return true;
  } catch {
    // Logo corrompu/illisible (ou WebP, que PDFKit ne lit pas) : le document
    // part sans lui plutôt que d'échouer entièrement.
    return false;
  }
}

// Type de document déduit du préfixe du nom de fichier.
const TYPES_DOCUMENT = [['bulletin_', 'bulletin'], ['recu_', 'recu'], ['fiche_paie_', 'fiche_paie'], ['emploi_du_temps_', 'emploi_du_temps']];
function typeDe(nomFichier) {
  const type = TYPES_DOCUMENT.find(([prefixe]) => nomFichier.startsWith(prefixe));
  return type ? type[1] : 'document';
}

// Chaque PDF généré est enregistré dans PostgreSQL (table documents_pdf) :
// le disque d'un hébergeur comme Render est effacé à chaque déploiement.
async function enregistrerDocument(nomFichier, contenu) {
  const { DocumentPDF } = require('../models');
  const existant = await DocumentPDF.findOne({ where: { nomFichier } });
  if (existant) await existant.update({ contenu, taille: contenu.length });
  else await DocumentPDF.create({ nomFichier, typeDocument: typeDe(nomFichier), contenu, taille: contenu.length });
}

async function lireDocument(nomFichier) {
  const { DocumentPDF } = require('../models');
  const document = await DocumentPDF.findOne({ where: { nomFichier } });
  return document ? document.contenu : null;
}

// Au démarrage : les PDF encore présents sur le disque (générés avant le
// passage à PostgreSQL) sont importés une fois dans la base.
async function importerDocumentsExistants() {
  const { DocumentPDF } = require('../models');
  let n = 0;
  for (const nomFichier of fs.readdirSync(DOSSIER_STOCKAGE).filter((f) => f.endsWith('.pdf'))) {
    if (await DocumentPDF.count({ where: { nomFichier } })) continue;
    const contenu = fs.readFileSync(path.join(DOSSIER_STOCKAGE, nomFichier));
    await DocumentPDF.create({ nomFichier, typeDocument: typeDe(nomFichier), contenu, taille: contenu.length });
    n += 1;
  }
  if (n) console.log(`Documents : ${n} PDF importé(s) du disque dans PostgreSQL.`);
}

function nouveauDocument(nomFichier, options = {}) {
  const doc = new PDFDocument({ margin: 50, size: 'A4', ...options });
  const morceaux = [];
  doc.on('data', (morceau) => morceaux.push(morceau));
  const termine = new Promise((resolve, reject) => {
    doc.on('end', () => {
      const contenu = Buffer.concat(morceaux);
      enregistrerDocument(nomFichier, contenu).then(() => resolve(contenu), reject);
    });
    doc.on('error', reject);
  });
  return { doc, termine, cheminRelatif: `/fichiers/${nomFichier}` };
}

// Dessine une ligne de tableau quadrillé (cellules bordées, fond optionnel)
// et retourne la position Y suivante. `cellules` : [{ texte, align, gras }].
function dessinerLigne(doc, x, y, largeurs, cellules, { hauteur = 18, fond, taille = 8, sansBordure = false, fusion } = {}) {
  // `fusion` : [première, dernière] colonne réunies en une seule cellule
  // (le texte de la première occupe toute la largeur du bloc).
  const blocs = [];
  let cx = x;
  for (let i = 0; i < largeurs.length; i += 1) {
    const fin = fusion && i === fusion[0] ? fusion[1] : i;
    const largeur = largeurs.slice(i, fin + 1).reduce((a, b) => a + b, 0);
    blocs.push({ indice: i, x: cx, largeur });
    cx += largeur;
    i = fin;
  }
  blocs.forEach((bloc) => {
    if (fond) doc.rect(bloc.x, y, bloc.largeur, hauteur).fill(fond);
    if (!sansBordure) doc.rect(bloc.x, y, bloc.largeur, hauteur).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
  });
  blocs.forEach((bloc) => {
    const cellule = cellules[bloc.indice];
    if (!cellule) return;
    const t = cellule.taille || taille;
    doc
      .font(cellule.gras ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(t)
      .fillColor(cellule.couleur || COULEUR_TEXTE)
      .text(cellule.texte ?? '', bloc.x + 6, y + (hauteur - t) / 2 - 1, {
        width: bloc.largeur - 12,
        align: cellule.align || 'left',
        lineBreak: false,
        ellipsis: true,
      });
  });
  return y + hauteur;
}

// ---------------------------------------------------------------------------
// Éléments communs des documents officiels (bulletin, reçu, fiche de paie,
// emploi du temps) : même en-tête, même pied de page, même signature.
// ---------------------------------------------------------------------------

function sigleEtablissement(etablissement) {
  if (etablissement.sigle) return etablissement.sigle.slice(0, 5).toUpperCase();
  return (etablissement.nom || 'ES').split(/\s+/).filter((m) => m.length > 2).map((m) => m[0]).join('').slice(0, 4).toUpperCase();
}

// Logo (ou sigle) et identité de l'école à gauche, titre du document à
// droite, filet marine dessous. Renvoie la position Y sous le filet.
function enTeteOfficiel(doc, etablissement, { surtitre, titre, sousTitre, reference, largeurTitre = 190, certification = null, qrEnTete = false }) {
  const margeGauche = doc.page.margins.left;
  // QR code en tête (documents sans zone de signature, comme les emplois du
  // temps) : le bloc titre se décale vers la gauche pour lui laisser la place.
  const tailleQrEnTete = certification && qrEnTete ? 58 : 0;
  if (tailleQrEnTete) dessinerQr(doc, urlVerification(certification), doc.page.width - doc.page.margins.right - tailleQrEnTete, 44, tailleQrEnTete);
  const droite = doc.page.width - doc.page.margins.right - (tailleQrEnTete ? tailleQrEnTete + 12 : 0);
  const yEntete = 44;
  const tailleLogo = 60;
  if (!dessinerLogo(doc, etablissement, margeGauche, yEntete, tailleLogo)) {
    doc.roundedRect(margeGauche, yEntete, tailleLogo, tailleLogo, 6).lineWidth(1.2).strokeColor(COULEUR_MARINE).stroke();
    doc.font('Times-Bold').fontSize(15).fillColor(COULEUR_MARINE)
      .text(sigleEtablissement(etablissement), margeGauche, yEntete + tailleLogo / 2 - 8, { width: tailleLogo, align: 'center' });
  }
  const xEcole = margeGauche + tailleLogo + 14;
  const largeurEcole = droite - largeurTitre - 16 - xEcole;
  doc.font('Times-Bold').fontSize(12.5).fillColor(COULEUR_MARINE)
    .text(etablissement.nom.toUpperCase(), xEcole, yEntete + 2, { width: largeurEcole });
  let yTexte = doc.y + 1;
  if (etablissement.devise) {
    doc.font('Times-Italic').fontSize(8.5).fillColor(COULEUR_TEXTE_CLAIR).text(etablissement.devise, xEcole, yTexte, { width: largeurEcole });
    yTexte = doc.y + 1;
  }
  const adresse = [etablissement.boitePostale, etablissement.ville, etablissement.pays].filter(Boolean).join(', ');
  const contacts = [etablissement.telephone, etablissement.email].filter(Boolean).join('  ·  ');
  doc.font('Helvetica').fontSize(7.8).fillColor(COULEUR_TEXTE_CLAIR);
  if (adresse) { doc.text(adresse, xEcole, yTexte, { width: largeurEcole }); yTexte = doc.y + 1; }
  if (contacts) { doc.text(contacts, xEcole, yTexte, { width: largeurEcole }); yTexte = doc.y; }

  const xTitre = droite - largeurTitre;
  if (surtitre) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COULEUR_PRIMAIRE)
      .text(surtitre, xTitre, yEntete + 2, { width: largeurTitre, align: 'right', characterSpacing: 0.8 });
  }
  doc.font('Times-Bold').fontSize(15).fillColor(COULEUR_MARINE)
    .text(titre, xTitre, surtitre ? doc.y + 3 : yEntete + 2, { width: largeurTitre, align: 'right' });
  if (sousTitre) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COULEUR_TEXTE).text(sousTitre, xTitre, doc.y + 2, { width: largeurTitre, align: 'right' });
  }
  if (reference) {
    doc.font('Courier').fontSize(7).fillColor(COULEUR_TEXTE_CLAIR).text(reference, xTitre, doc.y + 3, { width: largeurTitre, align: 'right' });
  }
  const y = Math.max(yEntete + tailleLogo, yTexte, doc.y) + 14;
  const finFilet = doc.page.width - doc.page.margins.right;
  doc.moveTo(margeGauche, y).lineTo(finFilet, y).lineWidth(2).strokeColor(COULEUR_MARINE).stroke();
  if (certification) microTexte(doc, margeGauche, y + 3.5, finFilet - margeGauche, etablissement, certification);
  return y + 16;
}

// Ligne de micro-impression sous le filet d'en-tête : sigle de l'école et
// code du document répétés en corps 3,4. Illisible à l'œil nu, elle se
// brouille à la photocopie ou au scanner et désigne le document d'origine.
function microTexte(doc, x, y, largeur, etablissement, certification) {
  const motif = `${sigleEtablissement(etablissement)} · DOCUMENT CERTIFIÉ ${certification.code} · VÉRIFIABLE EN LIGNE · `;
  doc.font('Helvetica').fontSize(3.4);
  const repetitions = Math.ceil(largeur / Math.max(1, doc.widthOfString(motif))) + 1;
  doc.fillColor('#8C9AAE').text(motif.repeat(repetitions), x, y, { width: largeur, height: 5, lineBreak: false, ellipsis: false });
}

// QR code vectoriel (modules dessinés un à un) : net à toute taille
// d'impression, sans image intermédiaire.
function dessinerQr(doc, texte, x, y, taille, couleur = COULEUR_MARINE) {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: 'M' });
  const pas = taille / modules.size;
  doc.save();
  for (let ligne = 0; ligne < modules.size; ligne += 1) {
    for (let colonne = 0; colonne < modules.size; colonne += 1) {
      if (modules.get(ligne, colonne)) doc.rect(x + colonne * pas, y + ligne * pas, pas + 0.05, pas + 0.05);
    }
  }
  doc.fill(couleur);
  doc.restore();
}

// Cartouche de vérification : QR code, code à saisir, adresse de la page
// publique. Placé sous « Fait à ... » dans le bloc de signature.
function sceauVerification(doc, x, y, certification, { taille = 54, largeurTexte = 170 } = {}) {
  const url = urlVerification(certification);
  dessinerQr(doc, url, x, y, taille);
  const xt = x + taille + 10;
  doc.font('Helvetica-Bold').fontSize(6.2).fillColor(COULEUR_PRIMAIRE)
    .text("VÉRIFICATION D'AUTHENTICITÉ", xt, y + 2, { width: largeurTexte, characterSpacing: 0.6 });
  doc.font('Courier-Bold').fontSize(10.5).fillColor(COULEUR_MARINE).text(certification.code, xt, y + 13, { width: largeurTexte });
  let adresse = url;
  try { const u = new URL(url); adresse = `${u.host}/verifier`; } catch { /* adresse complète */ }
  doc.font('Helvetica').fontSize(6.6).fillColor(COULEUR_TEXTE_CLAIR)
    .text('Scannez le code ou saisissez-le sur', xt, y + 29, { width: largeurTexte });
  doc.font('Helvetica-Bold').fontSize(6.6).fillColor(COULEUR_TEXTE).text(adresse, xt, y + 38, { width: largeurTexte, lineBreak: false, ellipsis: true });
  return y + taille;
}

// Bloc d'identité : cases bordées [libellé, valeur, poids, police chasse fixe].
function blocIdentite(doc, x, y, largeurTotale, cellules) {
  const totalPoids = cellules.reduce((a, [, , poids = 1]) => a + poids, 0);
  const hauteur = 38;
  let cx = x;
  cellules.forEach(([label, valeur, poids = 1, mono = false]) => {
    const largeur = (largeurTotale * poids) / totalPoids;
    doc.rect(cx, y, largeur, hauteur).lineWidth(0.7).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor(COULEUR_TEXTE_CLAIR).text(label.toUpperCase(), cx + 10, y + 8, { width: largeur - 20, characterSpacing: 0.6 });
    // La valeur tient sur une ligne : la taille diminue si elle est trop longue.
    doc.font(mono ? 'Courier-Bold' : 'Helvetica-Bold');
    let taille = 9.5;
    while (taille > 7 && doc.fontSize(taille).widthOfString(String(valeur || '')) > largeur - 20) taille -= 0.5;
    doc.fontSize(taille).fillColor(COULEUR_TEXTE)
      .text(valeur || '', cx + 10, y + 20, { width: largeur - 20, lineBreak: false, ellipsis: true });
    cx += largeur;
  });
  return y + hauteur;
}

// Lieu et date à gauche, fonction du signataire et zone de signature à droite.
function blocSignature(doc, y, etablissement, fonction, certification = null) {
  const margeGauche = doc.page.margins.left;
  const droite = doc.page.width - doc.page.margins.right;
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
  doc.font('Helvetica').fontSize(8.5).fillColor(COULEUR_TEXTE).text(`Fait à ${etablissement.ville || 'Libreville'}, le ${dateDuJour}`, margeGauche, y + 4);
  if (certification) sceauVerification(doc, margeGauche, y + 20, certification);
  const largeurSignature = 190;
  const xSignature = droite - largeurSignature;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COULEUR_TEXTE).text(fonction, xSignature, y, { width: largeurSignature, align: 'center' });
  doc.moveTo(xSignature, y + 62).lineTo(droite, y + 62).lineWidth(0.7).strokeColor(COULEUR_TEXTE).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(COULEUR_TEXTE_CLAIR).text('Signature et cachet', xSignature, y + 67, { width: largeurSignature, align: 'center' });
  return y + 80;
}

// Mention de bas de page sur chaque page (document ouvert avec bufferPages).
function piedDePageOfficiel(doc, texte, certification = null) {
  if (certification) texte = `${texte}  ·  Code de vérification ${certification.code}`;
  const margeGauche = doc.page.margins.left;
  const largeur = doc.page.width - margeGauche - doc.page.margins.right;
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    const yPied = doc.page.height - doc.page.margins.bottom - 14;
    doc.moveTo(margeGauche, yPied - 6).lineTo(margeGauche + largeur, yPied - 6).lineWidth(0.5).strokeColor(COULEUR_BORDURE).stroke();
    const ligne = `${texte}${pages.count > 1 ? `  ·  Page ${i - pages.start + 1}/${pages.count}` : ''}`;
    // Une seule ligne : le corps diminue si la mention est longue.
    let taille = 6.5;
    while (taille > 5 && doc.font('Helvetica').fontSize(taille).widthOfString(ligne) > largeur) taille -= 0.25;
    doc.font('Helvetica').fontSize(taille).fillColor(COULEUR_TEXTE_CLAIR)
      .text(ligne, margeGauche, yPied, { width: largeur, align: 'center', lineBreak: false });
  }
}

// Montant en toutes lettres (usage des reçus et fiches de paie).
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
function moinsDeCent(n) {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DIZAINES[d];
    return u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${moinsDeCent(n - 60)}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${moinsDeCent(n - 80)}`;
}
function moinsDeMille(n) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let texte = '';
  if (c === 1) texte = 'cent';
  else if (c > 1) texte = `${UNITES[c]} cent${r === 0 ? 's' : ''}`;
  if (r) texte = texte ? `${texte} ${moinsDeCent(r)}` : moinsDeCent(r);
  return texte;
}
function enLettres(montant) {
  let n = Math.round(Math.abs(montant));
  if (n === 0) return 'zéro';
  const parties = [];
  const milliards = Math.floor(n / 1e9); n %= 1e9;
  const millions = Math.floor(n / 1e6); n %= 1e6;
  const milliers = Math.floor(n / 1e3); n %= 1e3;
  if (milliards) parties.push(`${moinsDeMille(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) parties.push(`${moinsDeMille(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) parties.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers).replace(/cents$/, 'cent')} mille`);
  if (n) parties.push(moinsDeMille(n));
  return parties.join(' ');
}

// Encadré "arrêté à la somme de" + montant mis en avant.
function blocMontant(doc, x, y, largeur, { libelle, montant }) {
  doc.rect(x, y, largeur, 76).fill('#F3F7F4');
  doc.rect(x, y, largeur, 76).lineWidth(0.7).strokeColor('#CFE3D6').stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COULEUR_TEXTE_CLAIR).text(libelle, x + 16, y + 11, { width: largeur - 32, characterSpacing: 0.6 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COULEUR_SUCCES).text(`${formaterFCFA(montant)} FCFA`, x + 16, y + 22, { width: largeur - 32 });
  const lettres = enLettres(montant);
  doc.font('Helvetica-Oblique').fontSize(7.8).fillColor(COULEUR_TEXTE)
    .text(`Arrêté à la somme de ${lettres} francs CFA.`, x + 16, y + 48, { width: largeur - 32, height: 22 });
  return y + 76;
}

// Tableau récapitulatif à deux colonnes (libellé / montant), aligné à droite.
function tableauRecapitulatif(doc, x, y, largeur, lignes) {
  lignes.forEach(({ libelle, valeur, gras, couleur, fond }) => {
    if (fond) doc.rect(x, y, largeur, 20).fill(fond);
    doc.moveTo(x, y + 20).lineTo(x + largeur, y + 20).lineWidth(0.5).strokeColor(COULEUR_BORDURE).stroke();
    doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.3).fillColor(COULEUR_TEXTE_CLAIR).text(libelle, x + 8, y + 6, { width: largeur * 0.55 - 8 });
    doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.8).fillColor(couleur || COULEUR_TEXTE)
      .text(valeur, x + largeur * 0.55, y + 6, { width: largeur * 0.45 - 8, align: 'right' });
    y += 20;
  });
  return y;
}

// Colonnes du tableau du bulletin (495 pt = largeur utile d'une page A4
// avec des marges de 50) : Code / UE-Matière / Coef. / CC / Examen /
// Moyenne / Résultat.
const LARGEURS_COLONNES = [58, 187, 34, 44, 50, 52, 70];
const EN_TETES = ['CODE', "UNITÉ D'ENSEIGNEMENT / MATIÈRE", 'COEF.', 'CC', 'EXAMEN', 'MOYENNE', 'RÉSULTAT'];
const COULEUR_UE = '#E8EEF6';

function noteFr(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  const n = Number(valeur);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : String(valeur);
}

function resultatMatiere(m, regles = { seuil: 10 }) {
  if (m.eliminatoire) return { texte: 'ÉLIMINATOIRE', couleur: COULEUR_ERREUR };
  return m.noteFinale >= regles.seuil ? { texte: 'VALIDÉE', couleur: COULEUR_SUCCES } : { texte: 'NON VALIDÉE', couleur: COULEUR_RATTRAPAGE };
}

function enTeteTableau(doc, x, y) {
  return dessinerLigne(
    doc, x, y, LARGEURS_COLONNES,
    EN_TETES.map((t, i) => ({ texte: t, align: i >= 2 && i <= 5 ? 'right' : 'left', gras: true, couleur: '#FFFFFF', taille: 6.8 })),
    { hauteur: 22, fond: COULEUR_MARINE, taille: 6.8, sansBordure: true }
  );
}

function assurerPlace(doc, y, hauteurNecessaire, margeGauche) {
  if (y + hauteurNecessaire > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage();
    return enTeteTableau(doc, margeGauche, doc.page.margins.top);
  }
  return y;
}

// genererPDF(données du bulletin) - diagramme 5. Même document que celui
// affiché à l'écran (BulletinDocument) : identité de l'établissement avec
// son logo, bloc étudiant, résultats par UE et par matière, synthèse,
// signature.
async function genererBulletinPDF({ eleve, semestre, moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE, etablissement, regles = { seuil: 10, eliminatoire: 7 }, emisParId = null }) {
  const nomFichier = `bulletin_${eleve.id}_${semestre.id}.pdf`;
  const sansNotesCert = detailParUE.length === 0;
  const certification = await certifier({
    cle: `bulletin_${eleve.id}_${semestre.id}`,
    type: 'bulletin',
    etablissement,
    titre: `Bulletin de notes, ${semestre.libelle || ''} ${semestre.anneeScolaire || ''}`.trim(),
    titulaire: `${String(eleve.nom || '').toUpperCase()} ${eleve.prenom || ''}`.trim(),
    elements: [
      ['Matricule', eleve.matricule],
      ['Classe', eleve.Classe ? `${eleve.Classe.nom} (${eleve.Classe.niveau})` : null],
      ['Moyenne générale', sansNotesCert ? 'Non évaluée' : `${noteFr(moyenneGenerale)} / 20`],
      ['Crédits validés', `${creditsValides} / ${creditsTotal}`],
      ['Mention', sansNotesCert ? null : mention(moyenneGenerale)],
      ['Décision', sansNotesCert ? 'En attente' : admis ? 'Admis(e)' : 'Rattrapage'],
      ...detailParUE.map((u) => [`${u.code ? `${u.code} ` : ''}${u.ue}`, `${noteFr(u.moyenne)} / 20, ${libelleResultatUE(u).texte.toLowerCase()}`]),
    ],
    donnees: detailParUE.map((u) => [u.code, u.moyenne, u.matieres.map((m) => [m.code, m.moyenneCC, m.moyenneExamen, m.noteFinale])]),
    emisParId,
  });
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = LARGEURS_COLONNES.reduce((a, b) => a + b, 0);
  const droite = margeGauche + largeurTotale;
  const sansNotes = detailParUE.length === 0;
  const reference = `BUL-${String(semestre.id).padStart(2, '0')}${String(eleve.id).padStart(4, '0')}`;

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(),
    titre: 'BULLETIN DE NOTES',
    sousTitre: semestre.libelle || '',
    reference: `Réf. ${reference}`,
    certification,
  });

  // Bloc étudiant.
  y = blocIdentite(doc, margeGauche, y, largeurTotale, [
    ['Nom et prénom', `${eleve.nom} ${eleve.prenom}`, 1.5],
    ['Matricule', eleve.matricule || 'Non attribué', 1, true],
    ['Classe', eleve.Classe?.nom || 'Non renseignée'],
    ['Niveau', eleve.Classe?.niveau || 'Non renseigné'],
  ]) + 16;

  if (sessionGlobale === 'rattrapage') {
    doc.rect(margeGauche, y, largeurTotale, 20).fill('#FAF0DC');
    doc.font('Helvetica').fontSize(7.8).fillColor('#9C6B12')
      .text('Ce bulletin intègre les résultats de la session de rattrapage pour les UE non validées en session normale.', margeGauche + 10, y + 6.5, { width: largeurTotale - 20 });
    y += 30;
  }

  y = enTeteTableau(doc, margeGauche, y);

  if (sansNotes) {
    doc.rect(margeGauche, y, largeurTotale, 36).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(COULEUR_TEXTE_CLAIR)
      .text("Aucune note n'a encore été enregistrée pour ce semestre.", margeGauche, y + 14, { width: largeurTotale, align: 'center' });
    y += 36;
  }

  detailParUE.forEach((ligneUE) => {
    y = assurerPlace(doc, y, 20 * (1 + ligneUE.matieres.length), margeGauche);
    const { texte: resultatUE, couleur: couleurResultatUE } = libelleResultatUE(ligneUE);
    const credits = `${ligneUE.credits} crédit${ligneUE.credits > 1 ? 's' : ''}`;
    y = dessinerLigne(doc, margeGauche, y, LARGEURS_COLONNES, [
      { texte: ligneUE.code || '', gras: true, couleur: COULEUR_MARINE, taille: 7.5 },
      { texte: `${ligneUE.ue}  ·  ${credits}${ligneUE.session === 'rattrapage' ? '  ·  rattrapage' : ''}`, gras: true, couleur: COULEUR_MARINE },
      { texte: '' }, { texte: '' }, { texte: '' },
      { texte: noteFr(ligneUE.moyenne), align: 'right', gras: true, couleur: COULEUR_MARINE },
      { texte: resultatUE.toUpperCase(), gras: true, couleur: couleurResultatUE, taille: 6.5 },
    ], { hauteur: 20, fond: COULEUR_UE, fusion: [1, 4] });

    ligneUE.matieres.forEach((m) => {
      y = assurerPlace(doc, y, 18, margeGauche);
      const res = resultatMatiere(m, regles);
      y = dessinerLigne(doc, margeGauche, y, LARGEURS_COLONNES, [
        { texte: m.code || '', couleur: COULEUR_TEXTE_CLAIR, taille: 7.3 },
        { texte: `     ${m.matiere}${m.session === 'rattrapage' ? ' (rattrapage)' : ''}` },
        { texte: String(m.coefficient ?? ''), align: 'right' },
        { texte: noteFr(m.moyenneCC), align: 'right', couleur: COULEUR_TEXTE_CLAIR },
        { texte: noteFr(m.moyenneExamen), align: 'right', couleur: COULEUR_TEXTE_CLAIR },
        { texte: noteFr(m.noteFinale), align: 'right', gras: true, couleur: res.couleur },
        { texte: res.texte, gras: true, couleur: res.couleur, taille: 6.5 },
      ], { hauteur: 18 });
    });
  });

  // Synthèse : 4 cases dans un cadre marine.
  y += 18;
  y = assurerPlace(doc, y, 150, margeGauche);
  const synthese = [
    ['MOYENNE GÉNÉRALE', sansNotes ? 'Non évaluée' : `${noteFr(moyenneGenerale)} / 20`, sansNotes ? COULEUR_TEXTE : moyenneGenerale >= regles.seuil ? COULEUR_SUCCES : COULEUR_ERREUR],
    ['CRÉDITS VALIDÉS', `${creditsValides} / ${creditsTotal}`, COULEUR_TEXTE],
    ['MENTION', sansNotes ? 'Non évalué' : mention(moyenneGenerale), COULEUR_TEXTE],
    ['RÉSULTAT', sansNotes ? 'En attente' : admis ? 'Validé' : 'Non validé', sansNotes ? COULEUR_TEXTE : admis ? COULEUR_SUCCES : COULEUR_ERREUR],
    ['DÉCISION', sansNotes ? 'En attente' : admis ? 'Admis(e)' : 'Rattrapage', sansNotes ? COULEUR_TEXTE : admis ? COULEUR_SUCCES : COULEUR_RATTRAPAGE],
  ];
  const largeurCase = largeurTotale / synthese.length;
  const hauteurSynthese = 46;
  doc.rect(margeGauche, y, largeurTotale, hauteurSynthese).lineWidth(1.3).strokeColor(COULEUR_MARINE).stroke();
  synthese.forEach(([label, valeur, couleur], i) => {
    const x = margeGauche + i * largeurCase;
    if (i) doc.moveTo(x, y).lineTo(x, y + hauteurSynthese).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor(COULEUR_TEXTE_CLAIR).text(label, x, y + 9, { width: largeurCase, align: 'center', characterSpacing: 0.6 });
    doc.font('Times-Bold').fontSize(13).fillColor(couleur).text(valeur, x, y + 22, { width: largeurCase, align: 'center' });
  });
  y += hauteurSynthese + 30;

  // Lieu, date et signature, puis mentions de bas de page.
  blocSignature(doc, y, etablissement, 'Le Directeur des études', certification);
  piedDePageOfficiel(doc, `Document établi par ${etablissement.nom} via EduSphere  ·  Réf. ${reference}  ·  Toute rature ou surcharge annule ce document.`, certification);

  doc.end();
  const contenu = await termine;
  await sceller(certification, contenu);
  return { cheminRelatif, contenu, nomFichier, certification };
}

function mention(moyenne) {
  if (moyenne == null) return 'Non noté';
  if (moyenne >= 18) return 'Excellent';
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

// `toLocaleString('fr-FR')` sépare les milliers par une espace fine
// insécable (U+202F) absente de la police Helvetica standard de PDFKit —
// elle s'affiche comme un caractère erroné ("/"). Espace normale à la place.
function formaterFCFA(montant) {
  return Math.round(montant).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const LIBELLE_MODE_PAIEMENT = { especes: 'Espèces', mobile_money: 'Mobile money', virement: 'Virement bancaire' };
const LIBELLE_STATUT_FRAIS = { du: 'Dû', partiel: 'Partiellement réglé', solde: 'Soldé', impaye: 'Impayé' };

// genererRecuPDF(paiement) - diagramme 8. Document officiel au même
// modèle que le bulletin : identité de l'école, élève, détail du règlement,
// récapitulatif du frais, montant en toutes lettres, signature.
async function genererRecuPDF({ recuNumero, eleve, frais, paiement, etablissement, emisParId = null }) {
  const nomFichier = `recu_${recuNumero}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;
  const datePaiement = new Date(paiement.datePaiement || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const resteCert = Math.max(0, frais.montant - (frais.montantRegle || 0));
  const certification = await certifier({
    cle: `recu_${recuNumero}`,
    type: 'recu',
    etablissement,
    titre: `Reçu de paiement N° ${recuNumero}`,
    titulaire: `${String(eleve.nom || '').toUpperCase()} ${eleve.prenom || ''}`.trim(),
    elements: [
      ['Matricule', eleve.matricule],
      ['Désignation', frais.libelle],
      ['Montant réglé', `${formaterFCFA(paiement.montant)} FCFA`],
      ['Mode de règlement', LIBELLE_MODE_PAIEMENT[paiement.modePaiement] || paiement.modePaiement],
      ['Date du paiement', datePaiement],
      ['Reste à payer après ce paiement', `${formaterFCFA(resteCert)} FCFA`],
    ],
    donnees: { paiement: paiement.id ?? null, frais: frais.id ?? null, montantFrais: frais.montant },
    emisParId,
  });

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: 'SERVICE FINANCIER',
    titre: 'REÇU DE PAIEMENT',
    sousTitre: `N° ${recuNumero}`,
    reference: `Émis le ${datePaiement}`,
    certification,
  });

  y = blocIdentite(doc, margeGauche, y, largeurTotale, [
    ['Reçu de', `${eleve.nom} ${eleve.prenom}`, 1.5],
    ['Matricule', eleve.matricule || 'Non attribué', 1, true],
    ['Classe', eleve.Classe ? `${eleve.Classe.nom} (${eleve.Classe.niveau})` : 'Non renseignée', 1.2],
    ['Date du paiement', datePaiement],
  ]) + 22;

  // Détail du règlement.
  const largeurs = [largeurTotale - 250, 130, 120];
  y = dessinerLigne(doc, margeGauche, y, largeurs, [
    { texte: 'DÉSIGNATION', gras: true, couleur: '#FFFFFF', taille: 6.8 },
    { texte: 'MODE DE RÈGLEMENT', gras: true, couleur: '#FFFFFF', taille: 6.8 },
    { texte: 'MONTANT RÉGLÉ', gras: true, couleur: '#FFFFFF', taille: 6.8, align: 'right' },
  ], { hauteur: 22, fond: COULEUR_MARINE, sansBordure: true });
  y = dessinerLigne(doc, margeGauche, y, largeurs, [
    { texte: frais.libelle, gras: true },
    { texte: LIBELLE_MODE_PAIEMENT[paiement.modePaiement] || paiement.modePaiement },
    { texte: `${formaterFCFA(paiement.montant)} FCFA`, gras: true, align: 'right' },
  ], { hauteur: 26, taille: 8.8 });

  // Montant en lettres à gauche, récapitulatif du frais à droite.
  y += 22;
  const largeurMontant = largeurTotale - 270;
  blocMontant(doc, margeGauche, y, largeurMontant, { libelle: 'MONTANT REÇU', montant: paiement.montant });
  const dejaRegle = Math.max(0, (frais.montantRegle || 0) - paiement.montant);
  const reste = Math.max(0, frais.montant - (frais.montantRegle || 0));
  const solde = reste <= 0.01;
  tableauRecapitulatif(doc, margeGauche + largeurTotale - 250, y - 2, 250, [
    { libelle: 'Montant total du frais', valeur: `${formaterFCFA(frais.montant)} FCFA` },
    { libelle: 'Déjà réglé auparavant', valeur: `${formaterFCFA(dejaRegle)} FCFA` },
    { libelle: 'Montant de ce paiement', valeur: `${formaterFCFA(paiement.montant)} FCFA`, gras: true, couleur: COULEUR_SUCCES },
    { libelle: 'Reste à payer', valeur: `${formaterFCFA(reste)} FCFA`, gras: true, couleur: solde ? COULEUR_SUCCES : COULEUR_ERREUR, fond: '#F5F7FA' },
    { libelle: 'Situation du frais', valeur: solde ? 'Soldé' : (LIBELLE_STATUT_FRAIS[frais.statut] || frais.statut), gras: true },
  ]);
  y += 130;

  blocSignature(doc, y, etablissement, 'Le Service financier', certification);
  piedDePageOfficiel(doc, `Reçu établi par ${etablissement.nom} via EduSphere  ·  N° ${recuNumero}  ·  Ce reçu fait foi de paiement, à conserver.`, certification);

  doc.end();
  const contenu = await termine;
  await sceller(certification, contenu);
  return { cheminRelatif, contenu, nomFichier, certification };
}

// genererFichePaiePDF(versement) : même modèle que le reçu. Une fiche par
// versement (pas cumulative sur l'année).
async function genererFichePaiePDF({ personne, salaire, etablissement, emisParId = null }) {
  const nomFichier = `fiche_paie_${salaire.id}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;
  const numero = `FP-${new Date().getFullYear()}-${String(salaire.id).padStart(5, '0')}`;
  const dateVersement = salaire.dateVersement
    ? new Date(`${salaire.dateVersement}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non versé';
  const certification = await certifier({
    cle: `fiche_paie_${salaire.id}`,
    type: 'fiche_paie',
    etablissement,
    titre: `Fiche de paie, ${salaire.periode}`,
    titulaire: `${String(personne.nom || '').toUpperCase()} ${personne.prenom || ''}`.trim(),
    elements: [
      ['Poste', personne.poste],
      ['Période', salaire.periode],
      ['Net versé', `${formaterFCFA(salaire.montant)} FCFA`],
      ['Date de versement', dateVersement],
      ['Statut', salaire.statut === 'verse' ? 'Versé' : 'Prévu'],
    ],
    emisParId,
  });

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: 'SERVICE FINANCIER',
    titre: 'FICHE DE PAIE',
    sousTitre: salaire.periode,
    reference: `N° ${numero}`,
    certification,
  });

  y = blocIdentite(doc, margeGauche, y, largeurTotale, [
    ['Salarié(e)', `${personne.nom} ${personne.prenom}`, 1.5],
    ['Poste', personne.poste, 1.3],
    ['Période', salaire.periode],
    ['Date de versement', dateVersement],
  ]) + 22;

  const largeurs = [largeurTotale - 250, 130, 120];
  y = dessinerLigne(doc, margeGauche, y, largeurs, [
    { texte: 'RUBRIQUE', gras: true, couleur: '#FFFFFF', taille: 6.8 },
    { texte: 'BASE', gras: true, couleur: '#FFFFFF', taille: 6.8, align: 'right' },
    { texte: 'MONTANT', gras: true, couleur: '#FFFFFF', taille: 6.8, align: 'right' },
  ], { hauteur: 22, fond: COULEUR_MARINE, sansBordure: true });
  y = dessinerLigne(doc, margeGauche, y, largeurs, [
    { texte: `Rémunération ${salaire.periode}`, gras: true },
    { texte: personne.salaireBase ? `${formaterFCFA(personne.salaireBase)} FCFA` : '', align: 'right', couleur: COULEUR_TEXTE_CLAIR },
    { texte: `${formaterFCFA(salaire.montant)} FCFA`, gras: true, align: 'right' },
  ], { hauteur: 26, taille: 8.8 });

  y += 22;
  const largeurMontant = largeurTotale - 270;
  blocMontant(doc, margeGauche, y, largeurMontant, { libelle: 'NET VERSÉ', montant: salaire.montant });
  tableauRecapitulatif(doc, margeGauche + largeurTotale - 250, y - 2, 250, [
    { libelle: 'Salaire de base', valeur: personne.salaireBase ? `${formaterFCFA(personne.salaireBase)} FCFA` : 'Non renseigné' },
    { libelle: 'Net versé', valeur: `${formaterFCFA(salaire.montant)} FCFA`, gras: true, couleur: COULEUR_SUCCES, fond: '#F5F7FA' },
    { libelle: 'Statut', valeur: salaire.statut === 'verse' ? 'Versé' : 'Prévu', gras: true },
  ]);
  y += 100;

  blocSignature(doc, y, etablissement, "Pour l'employeur", certification);
  piedDePageOfficiel(doc, `Fiche établie par ${etablissement.nom} via EduSphere  ·  N° ${numero}  ·  À conserver sans limitation de durée.`, certification);

  doc.end();
  const contenu = await termine;
  await sceller(certification, contenu);
  return { cheminRelatif, contenu, nomFichier, certification };
}

const JOURS_EMPLOI = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function versMinutesEmploi(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

// genererEmploiDuTempsPDF(créneaux d'une classe) — même traitement "document
// officiel" que le bulletin/reçu (bandeau, identité établissement, logo si
// renseigné), mais en paysage et sous forme de grille hebdomadaire
// proportionnelle aux horaires plutôt qu'un tableau — pensé pour rester
// lisible partagé tel quel (WhatsApp, e-mail) sans repasser par l'appli.
async function genererEmploiDuTempsPDF({ classe, semestre, creneaux, etablissement, emisParId = null }) {
  const nomFichier = `emploi_du_temps_${classe.id}_${semestre.id}.pdf`;
  const certification = await certifier({
    cle: `emploi_du_temps_${classe.id}_${semestre.id}`,
    type: 'emploi_du_temps',
    etablissement,
    titre: `Emploi du temps, ${classe.nom} (${classe.niveau}), ${semestre.libelle}`,
    elements: [['Classe', `${classe.nom} (${classe.niveau})`], ['Semestre', semestre.libelle], ['Créneaux hebdomadaires', String(creneaux.length)]],
    donnees: creneaux.map((c) => [c.jour, c.heureDebut, c.heureFin, c.matiere, c.salle || null]),
    emisParId,
  });
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { layout: 'landscape', bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;

  const yDebut = enTeteOfficiel(doc, etablissement, {
    surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(),
    titre: 'EMPLOI DU TEMPS',
    sousTitre: `${classe.nom} (${classe.niveau})`,
    reference: semestre.libelle,
    largeurTitre: 230,
    certification,
    qrEnTete: true,
  });
  doc.y = yDebut;

  const largeurGouttiere = 34;
  const largeurJour = (largeurTotale - largeurGouttiere) / JOURS_EMPLOI.length;
  const yGrilleDebut = doc.y;
  const hauteurGrille = doc.page.height - doc.page.margins.bottom - yGrilleDebut - 30;
  const yColonnes = yGrilleDebut + 16;
  const hauteurColonnes = hauteurGrille - 16;

  const bornes = creneaux.flatMap((c) => [versMinutesEmploi(c.heureDebut), versMinutesEmploi(c.heureFin)]);
  const grilleDebutDefaut = 7 * 60;
  const grilleFinDefaut = 19 * 60;
  const grilleDebut = Math.floor(Math.min(grilleDebutDefaut, ...(bornes.length ? bornes : [grilleDebutDefaut])) / 60) * 60;
  const grilleFin = Math.ceil(Math.max(grilleFinDefaut, ...(bornes.length ? bornes : [grilleFinDefaut])) / 60) * 60;

  JOURS_EMPLOI.forEach((jour, i) => {
    const x = margeGauche + largeurGouttiere + i * largeurJour;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
      .text(jour.toUpperCase(), x, yGrilleDebut, { width: largeurJour - 4, align: 'center', characterSpacing: 0.4 });
    doc.rect(x, yColonnes, largeurJour - 4, hauteurColonnes).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
  });

  for (let h = grilleDebut; h <= grilleFin; h += 60) {
    const y = yColonnes + ((h - grilleDebut) / (grilleFin - grilleDebut)) * hauteurColonnes;
    doc.fontSize(6.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
      .text(`${String(Math.floor(h / 60)).padStart(2, '0')}h`, margeGauche, Math.max(yColonnes, y - 4), { width: largeurGouttiere - 4, align: 'right' });
    doc.moveTo(margeGauche + largeurGouttiere, y).lineTo(margeGauche + largeurTotale - 4, y)
      .lineWidth(0.5).dash(1, { space: 2 }).strokeColor(COULEUR_BORDURE).stroke();
    doc.undash();
  }

  creneaux.forEach((c) => {
    const iJour = JOURS_EMPLOI.indexOf(c.jour);
    if (iJour === -1) return;
    const x = margeGauche + largeurGouttiere + iJour * largeurJour;
    const debut = versMinutesEmploi(c.heureDebut);
    const fin = Math.max(versMinutesEmploi(c.heureFin), debut + 15);
    const y = yColonnes + ((debut - grilleDebut) / (grilleFin - grilleDebut)) * hauteurColonnes;
    const hauteur = Math.max(((fin - debut) / (grilleFin - grilleDebut)) * hauteurColonnes, 14);

    doc.roundedRect(x + 2, y, largeurJour - 8, hauteur, 3).fill(COULEUR_UE_FOND);
    doc.roundedRect(x + 2, y, largeurJour - 8, hauteur, 3).lineWidth(1).strokeColor(COULEUR_PRIMAIRE).stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor(COULEUR_PRIMAIRE)
      .text(c.matiere || 'N/A', x + 6, y + 3, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    doc.fontSize(6).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
      .text(`${c.heureDebut}–${c.heureFin}`, x + 6, y + 13, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    if (c.salle && hauteur > 28) {
      doc.fontSize(6).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
        .text(c.salle, x + 6, y + 22, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    }
  });

  piedDePageOfficiel(doc, `Emploi du temps établi par ${etablissement.nom} via EduSphere  ·  ${classe.nom} (${classe.niveau}), ${semestre.libelle}`, certification);

  doc.end();
  const contenu = await termine;
  await sceller(certification, contenu);
  return { cheminRelatif, contenu, nomFichier, certification };
}

module.exports = {
  genererBulletinPDF, genererRecuPDF, genererFichePaiePDF, genererEmploiDuTempsPDF, lireDocument, importerDocumentsExistants, DOSSIER_STOCKAGE,
  // Éléments communs réutilisés par les listes de l'Académie (documentsAcademieService).
  outils: {
    enTeteOfficiel, dessinerLigne, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, mention, versMinutesEmploi, JOURS_EMPLOI,
    sceauVerification, dessinerQr, certifier, sceller,
    couleurs: {
      COULEUR_PRIMAIRE, COULEUR_TEXTE, COULEUR_TEXTE_CLAIR, COULEUR_BORDURE, COULEUR_SUCCES, COULEUR_SUCCES_FOND, COULEUR_ERREUR,
      COULEUR_ERREUR_FOND, COULEUR_UE_FOND, COULEUR_RATTRAPAGE, COULEUR_MARINE,
    },
  },
};
