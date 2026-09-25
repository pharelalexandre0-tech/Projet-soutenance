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

function nouveauDocument(nomFichier, options = {}) {
  const cheminAbsolu = path.join(DOSSIER_STOCKAGE, nomFichier);
  const doc = new PDFDocument({ margin: 50, size: 'A4', ...options });
  const stream = fs.createWriteStream(cheminAbsolu);
  doc.pipe(stream);
  const termine = new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(cheminAbsolu));
    stream.on('error', reject);
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

// Colonnes du tableau du bulletin (495 pt = largeur utile d'une page A4
// avec des marges de 50) : Code / UE-Matière / Coef. / CC / Examen /
// Moyenne / Résultat.
const LARGEURS_COLONNES = [58, 187, 34, 44, 50, 52, 70];
const EN_TETES = ['CODE', "UNITÉ D'ENSEIGNEMENT / MATIÈRE", 'COEF.', 'CC', 'EXAMEN', 'MOYENNE', 'RÉSULTAT'];
const COULEUR_MARINE = '#0B1E3D';
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

function sigleDe(etablissement) {
  if (etablissement.sigle) return etablissement.sigle.slice(0, 5).toUpperCase();
  return (etablissement.nom || 'ES').split(/\s+/).filter((m) => m.length > 2).map((m) => m[0]).join('').slice(0, 4).toUpperCase();
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
  const nomFichier = `bulletin_${eleve.id}_${semestre.id}_${Date.now()}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { bufferPages: true });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = LARGEURS_COLONNES.reduce((a, b) => a + b, 0);
  const droite = margeGauche + largeurTotale;
  const sansNotes = detailParUE.length === 0;
  const reference = `BUL-${String(semestre.id).padStart(2, '0')}${String(eleve.id).padStart(4, '0')}`;

  // En-tête : logo et identité de l'école à gauche, titre du document à droite.
  const yEntete = 44;
  const tailleLogo = 60;
  const logoDessine = dessinerLogo(doc, etablissement, margeGauche, yEntete, tailleLogo);
  if (!logoDessine) {
    doc.roundedRect(margeGauche, yEntete, tailleLogo, tailleLogo, 6).lineWidth(1.2).strokeColor(COULEUR_MARINE).stroke();
    doc.font('Times-Bold').fontSize(15).fillColor(COULEUR_MARINE)
      .text(sigleDe(etablissement), margeGauche, yEntete + tailleLogo / 2 - 8, { width: tailleLogo, align: 'center' });
  }
  const largeurTitre = 190;
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
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COULEUR_PRIMAIRE)
    .text(`ANNÉE ${semestre.anneeScolaire || ''}`.trim(), xTitre, yEntete + 2, { width: largeurTitre, align: 'right', characterSpacing: 0.8 });
  doc.font('Times-Bold').fontSize(15).fillColor(COULEUR_MARINE)
    .text('BULLETIN DE NOTES', xTitre, doc.y + 3, { width: largeurTitre, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COULEUR_TEXTE)
    .text(semestre.libelle || '', xTitre, doc.y + 2, { width: largeurTitre, align: 'right' });
  doc.font('Courier').fontSize(7).fillColor(COULEUR_TEXTE_CLAIR)
    .text(`Réf. ${reference}`, xTitre, doc.y + 3, { width: largeurTitre, align: 'right' });

  let y = Math.max(yEntete + tailleLogo, yTexte, doc.y) + 14;
  doc.moveTo(margeGauche, y).lineTo(droite, y).lineWidth(2).strokeColor(COULEUR_MARINE).stroke();
  y += 16;

  // Bloc étudiant : 4 cases bordées.
  const identite = [
    ['NOM ET PRÉNOM', `${eleve.nom} ${eleve.prenom}`, 1.5],
    ['MATRICULE', eleve.matricule || 'Non attribué', 1],
    ['CLASSE', eleve.Classe?.nom || 'Non renseignée', 1],
    ['NIVEAU', eleve.Classe?.niveau || 'Non renseigné', 1],
  ];
  const totalPoids = identite.reduce((a, [, , p]) => a + p, 0);
  const hauteurIdentite = 38;
  let cx = margeGauche;
  identite.forEach(([label, valeur, poids], i) => {
    const largeur = (largeurTotale * poids) / totalPoids;
    doc.rect(cx, y, largeur, hauteurIdentite).lineWidth(0.7).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor(COULEUR_TEXTE_CLAIR).text(label, cx + 10, y + 8, { width: largeur - 20, characterSpacing: 0.6 });
    doc.font(i === 1 ? 'Courier-Bold' : 'Helvetica-Bold').fontSize(9.5).fillColor(COULEUR_TEXTE)
      .text(valeur, cx + 10, y + 20, { width: largeur - 20, lineBreak: false, ellipsis: true });
    cx += largeur;
  });
  y += hauteurIdentite + 16;

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

  // Lieu, date et signature.
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.font('Helvetica').fontSize(8.5).fillColor(COULEUR_TEXTE).text(`Fait à ${etablissement.ville}, le ${dateDuJour}`, margeGauche, y + 4);
  const largeurSignature = 190;
  const xSignature = droite - largeurSignature;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COULEUR_TEXTE).text('Le Directeur des études', xSignature, y, { width: largeurSignature, align: 'center' });
  doc.moveTo(xSignature, y + 62).lineTo(droite, y + 62).lineWidth(0.7).strokeColor(COULEUR_TEXTE).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(COULEUR_TEXTE_CLAIR).text('Signature et cachet', xSignature, y + 67, { width: largeurSignature, align: 'center' });

  // Mentions de bas de page, sur chaque page.
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    const yPied = doc.page.height - doc.page.margins.bottom - 14;
    doc.moveTo(margeGauche, yPied - 6).lineTo(droite, yPied - 6).lineWidth(0.5).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica').fontSize(6.5).fillColor(COULEUR_TEXTE_CLAIR)
      .text(
        `Document établi par ${etablissement.nom} via EduSphere  ·  Réf. ${reference}  ·  Toute rature ou surcharge annule ce document.${pages.count > 1 ? `  ·  Page ${i - pages.start + 1}/${pages.count}` : ''}`,
        margeGauche, yPied, { width: largeurTotale, align: 'center', lineBreak: false }
      );
  }

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
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

// genererRecuPDF(paiement) - diagramme 8. Même traitement "document officiel"
// que le bulletin : en-tête établissement, bloc identité, tableau quadrillé,
// montant mis en avant, cachet.
async function genererRecuPDF({ recuNumero, eleve, frais, paiement, etablissement }) {
  const nomFichier = `recu_${recuNumero}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier);

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;

  doc.rect(0, 0, doc.page.width, 8).fill(COULEUR_SUCCES);
  dessinerLogo(doc, etablissement, margeGauche, 26);

  doc.y = 34;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom.toUpperCase()}, ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('REÇU DE PAIEMENT', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(7.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`N° ${recuNumero}`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.6);
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).lineWidth(1.4).strokeColor(COULEUR_SUCCES).stroke();
  doc.moveDown(0.7);

  const largeurCol = largeurTotale / 3;
  const identite = [
    ['Élève', `${eleve.prenom} ${eleve.nom}`],
    ['Mode de paiement', LIBELLE_MODE_PAIEMENT[paiement.modePaiement] || paiement.modePaiement],
    ['Date de paiement', new Date(paiement.datePaiement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })],
  ];
  const yIdentite = doc.y;
  identite.forEach(([label, valeur], i) => {
    const cx = margeGauche + i * largeurCol;
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR).text(label.toUpperCase(), cx, yIdentite, { width: largeurCol - 8, characterSpacing: 0.5 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COULEUR_TEXTE).text(valeur, cx, yIdentite + 11, { width: largeurCol - 8 });
  });
  doc.y = yIdentite + 34;
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).dash(2, { space: 2 }).lineWidth(0.7).strokeColor(COULEUR_BORDURE).stroke();
  doc.undash();
  doc.y += 14;

  const largeursDetail = [largeurTotale - 200, 110, 90];
  let y = dessinerLigne(
    doc, margeGauche, doc.y, largeursDetail,
    [
      { texte: 'Frais concerné', gras: true, couleur: '#FFFFFF', taille: 7 },
      { texte: 'Montant payé', align: 'center', gras: true, couleur: '#FFFFFF', taille: 7 },
      { texte: 'Statut du frais', align: 'center', gras: true, couleur: '#FFFFFF', taille: 7 },
    ],
    { hauteur: 20, fond: COULEUR_PRIMAIRE, taille: 7 }
  );
  y = dessinerLigne(
    doc, margeGauche, y, largeursDetail,
    [
      { texte: frais.libelle },
      { texte: `${formaterFCFA(paiement.montant)} FCFA`, align: 'center', gras: true, couleur: COULEUR_SUCCES },
      { texte: LIBELLE_STATUT_FRAIS[frais.statut] || frais.statut, align: 'center', gras: true },
    ],
    { hauteur: 22 }
  );
  y = dessinerLigne(
    doc, margeGauche, y, largeursDetail,
    [
      { texte: 'Montant total du frais', couleur: COULEUR_TEXTE_CLAIR },
      { texte: `${formaterFCFA(frais.montant)} FCFA`, align: 'center', couleur: COULEUR_TEXTE_CLAIR },
      { texte: `reste ${formaterFCFA(frais.montant - frais.montantRegle)} FCFA`, align: 'center', couleur: COULEUR_TEXTE_CLAIR, taille: 7.2 },
    ],
    { hauteur: 20 }
  );

  y += 26;
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text('MONTANT REÇU', margeGauche, y, { width: largeurTotale, align: 'center', characterSpacing: 0.5 });
  doc.fontSize(26).font('Helvetica-Bold').fillColor(COULEUR_SUCCES)
    .text(`${formaterFCFA(paiement.montant)} FCFA`, margeGauche, y + 12, { width: largeurTotale, align: 'center' });

  y += 70;
  doc.moveTo(margeGauche, y).lineTo(margeGauche + largeurTotale, y).lineWidth(1.4).strokeColor(COULEUR_SUCCES).stroke();
  y += 14;
  doc.fontSize(8).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`Fait à ${etablissement.ville}, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margeGauche, y);
  doc.circle(margeGauche + largeurTotale - 46, y + 30, 40).lineWidth(1).dash(2, { space: 2 }).strokeColor(COULEUR_BORDURE).stroke();
  doc.undash();
  doc.fontSize(6.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text('CACHET &\nSIGNATURE', margeGauche + largeurTotale - 46 - 30, y + 22, { width: 60, align: 'center' });

  doc.fontSize(7).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom}, ${etablissement.boitePostale}, ${etablissement.telephone}, ${etablissement.email}`, margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' });

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
}

// genererFichePaiePDF(versement) - même traitement "document officiel" que
// le reçu de paiement : en-tête établissement, bloc identité, montant mis
// en avant, cachet. Une fiche par versement (pas cumulative sur l'année).
async function genererFichePaiePDF({ personne, salaire, etablissement }) {
  const nomFichier = `fiche_paie_${salaire.id}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier);

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;

  doc.rect(0, 0, doc.page.width, 8).fill(COULEUR_PRIMAIRE);
  dessinerLogo(doc, etablissement, margeGauche, 26);

  doc.y = 34;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom.toUpperCase()}, ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('FICHE DE PAIE', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(7.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`N° FP-${new Date().getFullYear()}-${String(salaire.id).padStart(5, '0')}, ${salaire.periode}`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.6);
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).lineWidth(1.4).strokeColor(COULEUR_PRIMAIRE).stroke();
  doc.moveDown(0.7);

  const largeurCol = largeurTotale / 3;
  const identite = [
    ['Employé(e)', `${personne.prenom} ${personne.nom}`],
    ['Poste', personne.poste],
    ['Période', salaire.periode],
  ];
  const yIdentite = doc.y;
  identite.forEach(([label, valeur], i) => {
    const cx = margeGauche + i * largeurCol;
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR).text(label.toUpperCase(), cx, yIdentite, { width: largeurCol - 8, characterSpacing: 0.5 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COULEUR_TEXTE).text(valeur, cx, yIdentite + 11, { width: largeurCol - 8 });
  });
  doc.y = yIdentite + 34;
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).dash(2, { space: 2 }).lineWidth(0.7).strokeColor(COULEUR_BORDURE).stroke();
  doc.undash();
  doc.y += 14;

  const largeursDetail = [largeurTotale - 200, 110, 90];
  let y = dessinerLigne(
    doc, margeGauche, doc.y, largeursDetail,
    [
      { texte: 'Élément', gras: true, couleur: '#FFFFFF', taille: 7 },
      { texte: 'Montant', align: 'center', gras: true, couleur: '#FFFFFF', taille: 7 },
      { texte: 'Date de versement', align: 'center', gras: true, couleur: '#FFFFFF', taille: 7 },
    ],
    { hauteur: 20, fond: COULEUR_PRIMAIRE, taille: 7 }
  );
  y = dessinerLigne(
    doc, margeGauche, y, largeursDetail,
    [
      { texte: 'Salaire net versé' },
      { texte: `${formaterFCFA(salaire.montant)} FCFA`, align: 'center', gras: true, couleur: COULEUR_SUCCES },
      { texte: salaire.dateVersement ? new Date(salaire.dateVersement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Non versé', align: 'center' },
    ],
    { hauteur: 22 }
  );

  y += 26;
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text('MONTANT NET VERSÉ', margeGauche, y, { width: largeurTotale, align: 'center', characterSpacing: 0.5 });
  doc.fontSize(26).font('Helvetica-Bold').fillColor(COULEUR_SUCCES)
    .text(`${formaterFCFA(salaire.montant)} FCFA`, margeGauche, y + 12, { width: largeurTotale, align: 'center' });

  y += 70;
  doc.moveTo(margeGauche, y).lineTo(margeGauche + largeurTotale, y).lineWidth(1.4).strokeColor(COULEUR_PRIMAIRE).stroke();
  y += 14;
  doc.fontSize(8).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`Fait à ${etablissement.ville}, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margeGauche, y);
  doc.circle(margeGauche + largeurTotale - 46, y + 30, 40).lineWidth(1).dash(2, { space: 2 }).strokeColor(COULEUR_BORDURE).stroke();
  doc.undash();
  doc.fontSize(6.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text('CACHET &\nSIGNATURE', margeGauche + largeurTotale - 46 - 30, y + 22, { width: 60, align: 'center' });

  doc.fontSize(7).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom}, ${etablissement.boitePostale}, ${etablissement.telephone}, ${etablissement.email}`, margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' });

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
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
  const nomFichier = `emploi_du_temps_${classe.id}_${semestre.id}_${Date.now()}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier, { layout: 'landscape' });

  const margeGauche = doc.page.margins.left;
  const largeurTotale = doc.page.width - margeGauche - doc.page.margins.right;

  doc.rect(0, 0, doc.page.width, 8).fill(COULEUR_PRIMAIRE);

  const yEntete = 26;
  dessinerLogo(doc, etablissement, margeGauche, yEntete, 46);

  doc.y = yEntete;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom.toUpperCase()}, ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('EMPLOI DU TEMPS', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COULEUR_PRIMAIRE)
    .text(`${classe.nom} (${classe.niveau}), ${semestre.libelle} (${semestre.anneeScolaire})`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.6);
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).lineWidth(1.4).strokeColor(COULEUR_PRIMAIRE).stroke();
  doc.moveDown(0.9);

  const largeurGouttiere = 34;
  const largeurJour = (largeurTotale - largeurGouttiere) / JOURS_EMPLOI.length;
  const yGrilleDebut = doc.y;
  const hauteurGrille = doc.page.height - doc.page.margins.bottom - yGrilleDebut - 26;
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

  doc.fontSize(7).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(
      `${etablissement.nom}, ${etablissement.boitePostale || ''}, ${etablissement.telephone || ''}, ${etablissement.email || ''}`,
      margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' }
    );

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
}

module.exports = { genererBulletinPDF, genererRecuPDF, genererFichePaiePDF, genererEmploiDuTempsPDF, DOSSIER_STOCKAGE };
