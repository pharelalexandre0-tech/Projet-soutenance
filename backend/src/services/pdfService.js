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
    return { texte: ligneUE.session === 'rattrapage' ? 'Éliminatoire (rattrapage)' : 'Éliminatoire', couleur: COULEUR_ERREUR };
  }
  if (ligneUE.session === 'rattrapage') return { texte: 'Rattrapage', couleur: COULEUR_RATTRAPAGE };
  if (ligneUE.valide) return { texte: 'UE validée', couleur: COULEUR_SUCCES };
  return { texte: 'Passe en rattrapage', couleur: COULEUR_ERREUR };
}

// Logo de l'établissement, dessiné en haut à gauche de chaque document
// officiel — absent si non renseigné ou illisible, jamais un document qui
// échoue pour autant (un logo cassé ne doit jamais empêcher un reçu ou un
// bulletin de sortir).
function dessinerLogo(doc, etablissement, x, y, taille = 40) {
  if (!etablissement.logo) return;
  try {
    const base64 = etablissement.logo.split(',')[1];
    doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [taille, taille] });
  } catch {
    // Logo corrompu/illisible : le document part sans lui plutôt que d'échouer entièrement.
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
function dessinerLigne(doc, x, y, largeurs, cellules, { hauteur = 18, fond, taille = 8 } = {}) {
  let cx = x;
  largeurs.forEach((largeur) => {
    if (fond) doc.rect(cx, y, largeur, hauteur).fill(fond);
    doc.rect(cx, y, largeur, hauteur).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    cx += largeur;
  });
  cx = x;
  cellules.forEach((cellule, i) => {
    const largeur = largeurs[i];
    doc
      .font(cellule.gras ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(cellule.taille || taille)
      .fillColor(cellule.couleur || COULEUR_TEXTE)
      .text(cellule.texte ?? '', cx + 6, y + (hauteur - (cellule.taille || taille)) / 2 - 1, {
        width: largeur - 10,
        align: cellule.align || 'left',
        lineBreak: false,
        ellipsis: true,
      });
    cx += largeur;
  });
  return y + hauteur;
}

const LARGEURS_COLONNES = [52, 148, 32, 42, 48, 55, 108]; // Code / Matière / Coef / CC / Examen / Note / Résultat
const EN_TETES = ['Code', "Unité d'enseignement / Matière", 'Coef.', 'CC', 'Examen', 'Note/20', 'Résultat'];

function assurerPlace(doc, y, hauteurNecessaire, margeGauche, largeurTotale) {
  if (y + hauteurNecessaire > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    let ny = doc.page.margins.top;
    ny = dessinerLigne(
      doc, margeGauche, ny, LARGEURS_COLONNES,
      EN_TETES.map((t, i) => ({ texte: t, align: i >= 2 ? 'center' : 'left', gras: true, couleur: '#FFFFFF', taille: 7 })),
      { hauteur: 20, fond: COULEUR_PRIMAIRE, taille: 7 }
    );
    return ny;
  }
  return y;
}

// genererPDF(données du bulletin) - diagramme 5. Reproduit fidèlement le
// registre affiché à l'écran : résultat par matière ET par UE (une UE peut
// être éliminatoire ou nécessiter un rattrapage même si sa moyenne suffirait).
async function genererBulletinPDF({ eleve, semestre, moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE, etablissement }) {
  const nomFichier = `bulletin_${eleve.id}_${semestre.id}_${Date.now()}.pdf`;
  const { doc, termine, cheminRelatif } = nouveauDocument(nomFichier);

  const margeGauche = doc.page.margins.left;
  const largeurTotale = LARGEURS_COLONNES.reduce((a, b) => a + b, 0);

  doc.rect(0, 0, doc.page.width, 8).fill(COULEUR_PRIMAIRE);
  dessinerLogo(doc, etablissement, margeGauche, 26);

  doc.y = 34;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom.toUpperCase()} — ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('BULLETIN DE NOTES', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(7.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`N° BUL-${String(semestre.id).padStart(2, '0')}${String(eleve.id).padStart(4, '0')} — document officiel de fin de semestre`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.6);
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurTotale, doc.y).lineWidth(1.4).strokeColor(COULEUR_PRIMAIRE).stroke();
  doc.moveDown(0.7);

  // Bloc identité — mêmes 4 champs que la version affichée à l'écran
  // (Étudiant / Matricule / Filière / Semestre), pour que le PDF téléchargé
  // ne soit jamais un document différent de ce que l'étudiant a sous les yeux.
  const largeurCol = largeurTotale / 4;
  const identite = [
    ['Étudiant', `${eleve.prenom} ${eleve.nom}`],
    ['Matricule', `ETU-${String(eleve.id).padStart(5, '0')}`],
    ['Filière', eleve.Classe ? `${eleve.Classe.nom} (${eleve.Classe.niveau})` : '—'],
    ['Semestre', `${semestre.libelle} (${semestre.anneeScolaire})`],
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

  // En-tête du tableau
  let y = dessinerLigne(
    doc, margeGauche, doc.y, LARGEURS_COLONNES,
    EN_TETES.map((t, i) => ({ texte: t, align: i >= 2 ? 'center' : 'left', gras: true, couleur: '#FFFFFF', taille: 7 })),
    { hauteur: 20, fond: COULEUR_PRIMAIRE, taille: 7 }
  );

  detailParUE.forEach((ligneUE) => {
    y = assurerPlace(doc, y, 18 * (1 + ligneUE.matieres.length), margeGauche, largeurTotale);

    const { texte: resultatUE, couleur: couleurResultatUE } = libelleResultatUE(ligneUE);
    const hauteurUE = 18;
    const largeurLabel = LARGEURS_COLONNES.slice(0, 5).reduce((a, b) => a + b, 0);
    const largeurNote = LARGEURS_COLONNES[5];
    const largeurResultat = LARGEURS_COLONNES[6];
    const xNote = margeGauche + largeurLabel;
    const xResultat = xNote + largeurNote;

    doc.rect(margeGauche, y, largeurLabel, hauteurUE).fill(COULEUR_UE_FOND);
    doc.rect(margeGauche, y, largeurLabel, hauteurUE).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COULEUR_PRIMAIRE)
      .text(
        `${ligneUE.code ? ligneUE.code + ' — ' : ''}${ligneUE.ue} · ${ligneUE.credits} crédits${ligneUE.session === 'rattrapage' ? ' · session de rattrapage' : ''}`,
        margeGauche + 6, y + 5, { width: largeurLabel - 10, lineBreak: false, ellipsis: true }
      );

    doc.rect(xNote, y, largeurNote, hauteurUE).fill(COULEUR_UE_FOND);
    doc.rect(xNote, y, largeurNote, hauteurUE).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COULEUR_TEXTE)
      .text(`${ligneUE.moyenne}/20`, xNote + 4, y + 5, { width: largeurNote - 8, align: 'center' });

    doc.rect(xResultat, y, largeurResultat, hauteurUE).fill(COULEUR_UE_FOND);
    doc.rect(xResultat, y, largeurResultat, hauteurUE).lineWidth(0.6).strokeColor(COULEUR_BORDURE).stroke();
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(couleurResultatUE)
      .text(resultatUE, xResultat + 4, y + 5.5, { width: largeurResultat - 8, align: 'center' });

    y += hauteurUE;

    ligneUE.matieres.forEach((m) => {
      y = assurerPlace(doc, y, 18, margeGauche, largeurTotale);
      const badge = m.eliminatoire ? 'éliminatoire' : m.noteFinale >= 10 ? 'validé' : 'non validé';
      const couleurBadge = m.eliminatoire || m.noteFinale < 10 ? COULEUR_ERREUR : COULEUR_SUCCES;
      y = dessinerLigne(
        doc, margeGauche, y, LARGEURS_COLONNES,
        [
          { texte: m.code || '—', couleur: COULEUR_TEXTE_CLAIR, taille: 7.5 },
          { texte: `${m.matiere}${m.session === 'rattrapage' ? ' (rattrapage)' : ''}` },
          { texte: String(m.coefficient), align: 'center' },
          { texte: m.moyenneCC ?? '—', align: 'center', couleur: COULEUR_TEXTE_CLAIR },
          { texte: m.moyenneExamen ?? '—', align: 'center', couleur: COULEUR_TEXTE_CLAIR },
          { texte: `${m.noteFinale}`, align: 'center', gras: true, couleur: m.noteFinale >= 10 ? COULEUR_SUCCES : COULEUR_ERREUR },
          { texte: badge, align: 'center', gras: true, couleur: couleurBadge, taille: 6.8 },
        ]
      );
    });
  });

  y += 16;
  y = assurerPlace(doc, y, 60, margeGauche, largeurTotale);

  // Pied : moyenne générale / crédits / mention / décision
  const pied = [
    ['Moyenne générale', `${moyenneGenerale}/20`, moyenneGenerale >= 10 ? COULEUR_SUCCES : COULEUR_ERREUR],
    ['Crédits validés', `${creditsValides} / ${creditsTotal}`, COULEUR_TEXTE],
    ['Mention', mention(moyenneGenerale), COULEUR_TEXTE],
    ['Décision', admis ? 'Admis(e)' : 'Non validé(e)', admis ? COULEUR_SUCCES : COULEUR_ERREUR],
  ];
  doc.moveTo(margeGauche, y).lineTo(margeGauche + largeurTotale, y).lineWidth(1.4).strokeColor(COULEUR_PRIMAIRE).stroke();
  y += 12;
  const largeurPied = largeurTotale / 4;
  pied.forEach(([label, valeur, couleur], i) => {
    const cx = margeGauche + i * largeurPied;
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE_CLAIR).text(label.toUpperCase(), cx, y, { width: largeurPied - 6, align: 'center', characterSpacing: 0.4 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(couleur).text(valeur, cx, y + 11, { width: largeurPied - 6, align: 'center' });
  });
  y += 42;

  if (sessionGlobale === 'rattrapage') {
    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(COULEUR_OR)
      .text('Ce bulletin intègre les résultats de la session de rattrapage.', margeGauche, y, { width: largeurTotale, align: 'center' });
    y += 16;
  }

  doc.fontSize(8).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`Fait à ${etablissement.ville}, le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margeGauche, y);

  doc.fontSize(7).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`${etablissement.nom} — ${etablissement.boitePostale} — ${etablissement.telephone} — ${etablissement.email}`, margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' });

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
}

function mention(moyenne) {
  if (moyenne == null) return '—';
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
    .text(`${etablissement.nom.toUpperCase()} — ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
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
    .text(`${etablissement.nom} — ${etablissement.boitePostale} — ${etablissement.telephone} — ${etablissement.email}`, margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' });

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
    .text(`${etablissement.nom.toUpperCase()} — ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('FICHE DE PAIE', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(7.5).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(`N° FP-${new Date().getFullYear()}-${String(salaire.id).padStart(5, '0')} — ${salaire.periode}`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
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
      { texte: salaire.dateVersement ? new Date(salaire.dateVersement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—', align: 'center' },
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
    .text(`${etablissement.nom} — ${etablissement.boitePostale} — ${etablissement.telephone} — ${etablissement.email}`, margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' });

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
    .text(`${etablissement.nom.toUpperCase()} — ${etablissement.ville.toUpperCase()}, ${etablissement.pays.toUpperCase()}`, margeGauche, doc.y, { width: largeurTotale, align: 'center', characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.fontSize(19).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('EMPLOI DU TEMPS', margeGauche, doc.y, { width: largeurTotale, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COULEUR_PRIMAIRE)
    .text(`${classe.nom} (${classe.niveau}) — ${semestre.libelle} (${semestre.anneeScolaire})`, margeGauche, doc.y, { width: largeurTotale, align: 'center' });
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
      .text(c.matiere || '—', x + 6, y + 3, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    doc.fontSize(6).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
      .text(`${c.heureDebut}–${c.heureFin}`, x + 6, y + 13, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    if (c.salle && hauteur > 28) {
      doc.fontSize(6).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
        .text(c.salle, x + 6, y + 22, { width: largeurJour - 16, lineBreak: false, ellipsis: true });
    }
  });

  doc.fontSize(7).font('Helvetica').fillColor(COULEUR_TEXTE_CLAIR)
    .text(
      `${etablissement.nom} — ${etablissement.boitePostale || ''} — ${etablissement.telephone || ''} — ${etablissement.email || ''}`,
      margeGauche, doc.page.height - doc.page.margins.bottom - 16, { width: largeurTotale, align: 'center' }
    );

  doc.end();
  const chemin = await termine;
  return { cheminAbsolu: chemin, cheminRelatif };
}

module.exports = { genererBulletinPDF, genererRecuPDF, genererFichePaiePDF, genererEmploiDuTempsPDF, DOSSIER_STOCKAGE };
