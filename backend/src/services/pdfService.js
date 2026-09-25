const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

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
  return { texte: 'À rattraper', couleur: COULEUR_ERREUR };
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
function enTeteOfficiel(doc, etablissement, { surtitre, titre, sousTitre, reference, largeurTitre = 190 }) {
  const margeGauche = doc.page.margins.left;
  const droite = doc.page.width - doc.page.margins.right;
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
  doc.moveTo(margeGauche, y).lineTo(droite, y).lineWidth(2).strokeColor(COULEUR_MARINE).stroke();
  return y + 16;
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
function blocSignature(doc, y, etablissement, fonction) {
  const margeGauche = doc.page.margins.left;
  const droite = doc.page.width - doc.page.margins.right;
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.font('Helvetica').fontSize(8.5).fillColor(COULEUR_TEXTE).text(`Fait à ${etablissement.ville}, le ${dateDuJour}`, margeGauche, y + 4);
  const largeurSignature = 190;
  const xSignature = droite - largeurSignature;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COULEUR_TEXTE).text(fonction, xSignature, y, { width: largeurSignature, align: 'center' });
  doc.moveTo(xSignature, y + 62).lineTo(droite, y + 62).lineWidth(0.7).strokeColor(COULEUR_TEXTE).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(COULEUR_TEXTE_CLAIR).text('Signature et cachet', xSignature, y + 67, { width: largeurSignature, align: 'center' });
  return y + 80;
}

// Mention de bas de page sur chaque page (document ouvert avec bufferPages).
function piedDePageOfficiel(doc, texte) {
  const margeGauche = doc.page.margins.left;
  const largeur = doc.page.width - margeGauche - doc.page.margins.right;
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    const yPied = doc.page.height - doc.page.margins.bottom - 14;
    doc.moveTo(margeGauche, yPied - 6).lineTo(margeGauche + largeur, yPied - 6).lineWidth(0.5).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica').fontSize(6.5).fillColor(COULEUR_TEXTE_CLAIR)
      .text(`${texte}${pages.count > 1 ? `  ·  Page ${i - pages.start + 1}/${pages.count}` : ''}`, margeGauche, yPied, { width: largeur, align: 'center', lineBreak: false });
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

function resultatMatiere(m) {
  if (m.eliminatoire) return { texte: 'ÉLIMINATOIRE', couleur: COULEUR_ERREUR };
  return m.noteFinale >= 10 ? { texte: 'ACQUIS', couleur: COULEUR_SUCCES } : { texte: 'NON ACQUIS', couleur: COULEUR_ERREUR };
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
async function genererBulletinPDF({ eleve, semestre, moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE, etablissement }) {
  const nomFichier = `bulletin_${eleve.id}_${semestre.id}.pdf`;
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
      const res = resultatMatiere(m);
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
    ['MOYENNE GÉNÉRALE', sansNotes ? 'Non évaluée' : `${noteFr(moyenneGenerale)} / 20`, sansNotes ? COULEUR_TEXTE : moyenneGenerale >= 10 ? COULEUR_SUCCES : COULEUR_ERREUR],
    ['CRÉDITS VALIDÉS', `${creditsValides} / ${creditsTotal}`, COULEUR_TEXTE],
    ['MENTION', sansNotes ? 'Non évalué' : mention(moyenneGenerale), COULEUR_TEXTE],
    ['DÉCISION', sansNotes ? 'En attente' : admis ? 'Admis(e)' : 'Ajourné(e)', sansNotes ? COULEUR_TEXTE : admis ? COULEUR_SUCCES : COULEUR_ERREUR],
  ];
  const largeurCase = largeurTotale / 4;
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
  blocSignature(doc, y, etablissement, 'Le Directeur des études');
  piedDePageOfficiel(doc, `Document établi par ${etablissement.nom} via EduSphere  ·  Réf. ${reference}  ·  Toute rature ou surcharge annule ce document.`);

  doc.end();
  const contenu = await termine;
  return { cheminRelatif, contenu, nomFichier };
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
async function genererRecuPDF({ recuNumero, eleve, frais, paiement, etablissement }) {
  const nomFichier = `recu_${recuNumero}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;
  const datePaiement = new Date(paiement.datePaiement || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: 'SERVICE FINANCIER',
    titre: 'REÇU DE PAIEMENT',
    sousTitre: `N° ${recuNumero}`,
    reference: `Émis le ${datePaiement}`,
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

  blocSignature(doc, y, etablissement, 'Le Service financier');
  piedDePageOfficiel(doc, `Reçu établi par ${etablissement.nom} via EduSphere  ·  N° ${recuNumero}  ·  Ce reçu fait foi de paiement, à conserver.`);

  doc.end();
  const contenu = await termine;
  return { cheminRelatif, contenu, nomFichier };
}

// genererFichePaiePDF(versement) : même modèle que le reçu. Une fiche par
// versement (pas cumulative sur l'année).
async function genererFichePaiePDF({ personne, salaire, etablissement }) {
  const nomFichier = `fiche_paie_${salaire.id}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;
  const numero = `FP-${new Date().getFullYear()}-${String(salaire.id).padStart(5, '0')}`;
  const dateVersement = salaire.dateVersement
    ? new Date(`${salaire.dateVersement}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non versé';

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: 'SERVICE FINANCIER',
    titre: 'FICHE DE PAIE',
    sousTitre: salaire.periode,
    reference: `N° ${numero}`,
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

  blocSignature(doc, y, etablissement, "Pour l'employeur");
  piedDePageOfficiel(doc, `Fiche établie par ${etablissement.nom} via EduSphere  ·  N° ${numero}  ·  À conserver sans limitation de durée.`);

  doc.end();
  const contenu = await termine;
  return { cheminRelatif, contenu, nomFichier };
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
async function genererEmploiDuTempsPDF({ classe, semestre, creneaux, etablissement }) {
  const nomFichier = `emploi_du_temps_${classe.id}_${semestre.id}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { layout: 'landscape', bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;

  const yDebut = enTeteOfficiel(doc, etablissement, {
    surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(),
    titre: 'EMPLOI DU TEMPS',
    sousTitre: `${classe.nom} (${classe.niveau})`,
    reference: semestre.libelle,
    largeurTitre: 230,
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

  piedDePageOfficiel(doc, `Emploi du temps établi par ${etablissement.nom} via EduSphere  ·  ${classe.nom} (${classe.niveau}), ${semestre.libelle}`);

  doc.end();
  const contenu = await termine;
  return { cheminRelatif, contenu, nomFichier };
}

module.exports = {
  genererBulletinPDF, genererRecuPDF, genererFichePaiePDF, genererEmploiDuTempsPDF, lireDocument, importerDocumentsExistants, DOSSIER_STOCKAGE,
};
