const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const { outils } = require('./pdfService');

// Documents téléchargeables par l'Académie, au format de l'établissement
// (en-tête, logo, pied de page officiel) : PDF à imprimer ou à partager, et
// Excel pour retravailler les chiffres.
//   - liste de présence (feuille d'émargement vierge d'une ou de toutes les classes) ;
//   - récapitulatif des présences (absences et retards enregistrés, par élève) ;
//   - procès-verbal des résultats (moyennes par UE, moyenne générale,
//     crédits, mention, résultat, décision) et notes détaillées ;
//   - emplois du temps (une classe ou toutes, une page par classe).
// Générés à la demande à partir des données à jour : rien n'est stocké.

const { enTeteOfficiel, dessinerLigne, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, mention, versMinutesEmploi, JOURS_EMPLOI, certifier, sceller } = outils;
const C = outils.couleurs;
const COULEUR_LIMITE = '#8A5D00';
// Note sur 20 sans décimales inutiles : 10, 7, 9,5.
const surVingt = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
const FOND_LIMITE = '#FFF6D6';

// Termine le PDF et inscrit son empreinte au registre des documents certifiés.
async function finaliser(doc, termine, certification) {
  doc.end();
  const contenu = await termine;
  await sceller(certification, contenu);
  return contenu;
}

function nouveauPDF(options = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, ...options });
  const morceaux = [];
  doc.on('data', (m) => morceaux.push(m));
  const termine = new Promise((ok, ko) => { doc.on('end', () => ok(Buffer.concat(morceaux))); doc.on('error', ko); });
  return { doc, termine };
}

const nomComplet = (e) => `${String(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim();
const dateFr = (d, options = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Libreville', ...options });
const limiteBas = (doc, reserve = 0) => doc.page.height - doc.page.margins.bottom - 24 - reserve;

// Tableau sur plusieurs pages : l'en-tête est redessiné en haut de chaque page.
function tableau(doc, x, y, largeurs, entete, lignes, { hauteur = 18, taille = 8, reserveFin = 0, cases = [] } = {}) {
  const dessinerEntete = (yy) => dessinerLigne(doc, x, yy, largeurs, entete.map((t, i) => ({ texte: t, gras: true, couleur: '#FFFFFF', align: i === 0 ? 'center' : 'left', taille: 7.2 })), { hauteur: 20, fond: C.COULEUR_MARINE });
  y = dessinerEntete(y);
  lignes.forEach((cellules, i) => {
    if (y + hauteur > limiteBas(doc)) {
      doc.addPage();
      y = dessinerEntete(doc.page.margins.top);
    }
    const yLigne = y;
    y = dessinerLigne(doc, x, y, largeurs, cellules, { hauteur, taille, fond: i % 2 ? '#F7F8F6' : undefined });
    // Cases à cocher dessinées (la police du PDF n'a pas de caractère « case »).
    for (const col of cases) {
      const cx = x + largeurs.slice(0, col).reduce((a, b) => a + b, 0) + largeurs[col] / 2 - 5;
      doc.rect(cx, yLigne + hauteur / 2 - 5, 10, 10).lineWidth(0.8).strokeColor(C.COULEUR_TEXTE_CLAIR).stroke();
    }
  });
  if (reserveFin && y + reserveFin > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
  return y;
}

function versXlsx(feuilles) {
  const classeur = XLSX.utils.book_new();
  for (const { nom, lignes, largeurs } of feuilles) {
    const feuille = Array.isArray(lignes[0]) ? XLSX.utils.aoa_to_sheet(lignes) : XLSX.utils.json_to_sheet(lignes);
    if (largeurs) feuille['!cols'] = largeurs.map((wch) => ({ wch }));
    if (!Array.isArray(lignes[0]) && lignes.length) feuille['!autofilter'] = { ref: feuille['!ref'] };
    XLSX.utils.book_append_sheet(classeur, feuille, nom.slice(0, 31));
  }
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------
// Liste de présence (feuille d'émargement vierge)
// ---------------------------------------------------------------------------

async function listePresencePDF({ etablissement, classes, date, cours, enseignant, emisParId = null }) {
  const certification = await certifier({
    cle: `presence_${classes.map((c) => c.classe.id).join('-')}_${date || 'sans-date'}`.slice(0, 120),
    type: 'liste_presence',
    etablissement,
    titre: `Liste de présence, ${classes.length === 1 ? `${classes[0].classe.nom} (${classes[0].classe.niveau})` : `${classes.length} classes`}`,
    elements: [
      ['Classes', classes.map((c) => c.classe.nom).join(', ')],
      ['Date', date ? dateFr(date) : 'Non renseignée'],
      ['Cours', cours],
      ['Enseignant', enseignant],
      ['Effectif', String(classes.reduce((n, c) => n + c.eleves.length, 0))],
    ],
    donnees: classes.map((c) => [c.classe.id, c.eleves.map((e) => e.id)]),
    emisParId,
  });
  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  classes.forEach(({ classe, eleves }, k) => {
    if (k) doc.addPage();
    let y = enTeteOfficiel(doc, etablissement, {
      surtitre: 'FEUILLE D’ÉMARGEMENT', titre: 'LISTE DE PRÉSENCE', sousTitre: `${classe.nom} (${classe.niveau})`,
      reference: `${eleves.length} élève${eleves.length > 1 ? 's' : ''}`, largeurTitre: 210, certification,
    });
    y = blocIdentite(doc, marge, y, largeur, [
      ['Date', date ? dateFr(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '', 1.6],
      ['Cours / matière', cours || '', 1.6],
      ['Enseignant', enseignant || '', 1.4],
      ['Horaire', '', 0.9],
    ]) + 14;
    const largeurs = [26, 78, 175, 46, 46, 46, largeur - 26 - 78 - 175 - 46 * 3];
    const lignes = eleves.map((e, i) => [
      { texte: String(i + 1), align: 'center', couleur: C.COULEUR_TEXTE_CLAIR },
      { texte: e.matricule || '' },
      { texte: nomComplet(e), gras: true },
      { texte: '' }, { texte: '' }, { texte: '' },
      { texte: '' },
    ]);
    y = tableau(doc, marge, y, largeurs, ['N°', 'Matricule', 'Nom et prénom', 'Présent', 'Absent', 'Retard', 'Signature'], lignes, { hauteur: 22, reserveFin: 120, cases: [3, 4, 5] });
    y += 14;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.COULEUR_TEXTE)
      .text(`Effectif : ${eleves.length}        Présents : ..........        Absents : ..........        Retards : ..........`, marge, y);
    blocSignature(doc, y + 22, etablissement, 'L’enseignant', certification);
  });
  piedDePageOfficiel(doc, `Liste de présence établie par ${etablissement.nom} via EduSphere`, certification);
  return finaliser(doc, termine, certification);
}

// ---------------------------------------------------------------------------
// Récapitulatif des présences (données enregistrées)
// ---------------------------------------------------------------------------

function lignesRecapitulatif(eleves, absences) {
  const parEleve = new Map(eleves.map((e) => [e.id, { nj: 0, j: 0, r: 0, derniere: null }]));
  for (const a of absences) {
    const s = parEleve.get(a.eleveId);
    if (!s) continue;
    if (a.type === 'retard') s.r += 1; else if (a.justifie) s.j += 1; else s.nj += 1;
    if (!s.derniere || a.date > s.derniere) s.derniere = a.date;
  }
  return eleves.map((e) => ({ eleve: e, ...parEleve.get(e.id) }));
}

async function recapitulatifPresencesPDF({ etablissement, classe, eleves, absences, du, au, emisParId = null }) {
  const periode = du || au ? `${du ? `du ${dateFr(du)}` : ''} ${au ? `au ${dateFr(au)}` : ''}`.trim() : 'Depuis le début de l’année';
  const lignes = lignesRecapitulatif(eleves, absences);
  const tot = lignes.reduce((t, l) => ({ nj: t.nj + l.nj, j: t.j + l.j, r: t.r + l.r }), { nj: 0, j: 0, r: 0 });
  const certification = await certifier({
    cle: `recap_presences_${classe.id}_${du || ''}_${au || ''}`,
    type: 'recapitulatif_presences',
    etablissement,
    titre: `Récapitulatif des présences, ${classe.nom} (${classe.niveau})`,
    elements: [
      ['Période', periode], ['Effectif', String(eleves.length)], ['Absences non justifiées', String(tot.nj)],
      ['Absences justifiées', String(tot.j)], ['Retards', String(tot.r)],
    ],
    donnees: lignes.map((l) => [l.eleve.id, l.nj, l.j, l.r]),
    emisParId,
  });
  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: 'ASSIDUITÉ', titre: 'RÉCAPITULATIF DES PRÉSENCES', sousTitre: `${classe.nom} (${classe.niveau})`, reference: periode, largeurTitre: 290, certification,
  });
  y = blocIdentite(doc, marge, y, largeur, [
    ['Effectif', String(eleves.length)], ['Non justifiées', String(tot.nj)], ['Justifiées', String(tot.j)], ['Retards', String(tot.r)],
    ['Jamais absents', String(lignes.filter((l) => !l.nj && !l.j && !l.r).length)],
  ]) + 14;
  const largeurs = [26, 78, 160, 70, 60, 50, largeur - 26 - 78 - 160 - 70 - 60 - 50];
  y = tableau(doc, marge, y, largeurs, ['N°', 'Matricule', 'Nom et prénom', 'Non justifiées', 'Justifiées', 'Retards', 'Dernière'],
    lignes.map((l, i) => [
      { texte: String(i + 1), align: 'center', couleur: C.COULEUR_TEXTE_CLAIR },
      { texte: l.eleve.matricule || '' },
      { texte: nomComplet(l.eleve), gras: true },
      { texte: String(l.nj), align: 'center', gras: l.nj > 0, couleur: l.nj >= 5 ? C.COULEUR_ERREUR : l.nj > 0 ? COULEUR_LIMITE : C.COULEUR_SUCCES },
      { texte: String(l.j), align: 'center' },
      { texte: String(l.r), align: 'center', couleur: l.r >= 5 ? COULEUR_LIMITE : C.COULEUR_TEXTE },
      { texte: l.derniere ? dateFr(l.derniere, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Aucune', couleur: l.derniere ? C.COULEUR_TEXTE : C.COULEUR_TEXTE_CLAIR },
    ]), { reserveFin: 90 });
  blocSignature(doc, y + 20, etablissement, 'Le service de la scolarité', certification);
  piedDePageOfficiel(doc, `Récapitulatif des présences établi par ${etablissement.nom} via EduSphere  ·  ${classe.nom}`, certification);
  return finaliser(doc, termine, certification);
}

function recapitulatifPresencesXlsx({ classe, eleves, absences }) {
  const lignes = lignesRecapitulatif(eleves, absences).map((l, i) => ({
    'N°': i + 1, Matricule: l.eleve.matricule || '', Nom: l.eleve.nom, 'Prénom': l.eleve.prenom, Classe: classe.nom,
    'Absences non justifiées': l.nj, 'Absences justifiées': l.j, Retards: l.r, 'Dernière absence': l.derniere || '',
  }));
  const detail = absences.map((a) => {
    const e = eleves.find((x) => x.id === a.eleveId);
    return { Date: a.date, Matricule: e?.matricule || '', Nom: e?.nom || '', 'Prénom': e?.prenom || '', Type: a.type === 'retard' ? 'Retard' : 'Absence', 'Justifiée': a.justifie ? 'Oui' : 'Non', Motif: a.motif || '', Cours: a.cours || '' };
  });
  return versXlsx([
    { nom: 'Récapitulatif', lignes, largeurs: [5, 14, 18, 18, 22, 22, 18, 10, 16] },
    { nom: 'Détail des absences', lignes: detail.length ? detail : [{ Date: '', Matricule: 'Aucune absence enregistrée' }], largeurs: [12, 14, 18, 18, 10, 10, 30, 24] },
  ]);
}

// ---------------------------------------------------------------------------
// Procès-verbal des résultats (liste des notes, résultats et mentions)
// ---------------------------------------------------------------------------

// Une ligne par élève évalué, classée par mérite (rang) ou par ordre alphabétique.
function preparerResultats(eleves, calculs, ordre = 'merite') {
  const lignes = eleves.map((e) => {
    const c = calculs.get(e.id);
    const evalue = c && c.detailParUE.length > 0;
    return { eleve: e, calcul: c, evalue };
  });
  const evalues = lignes.filter((l) => l.evalue).sort((a, b) => b.calcul.moyenneGenerale - a.calcul.moyenneGenerale);
  let rang = 0; let precedente = null;
  evalues.forEach((l, i) => { if (l.calcul.moyenneGenerale !== precedente) rang = i + 1; l.rang = rang; precedente = l.calcul.moyenneGenerale; });
  if (ordre === 'alphabetique') lignes.sort((a, b) => nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), 'fr'));
  else lignes.sort((a, b) => (a.rang || 1e9) - (b.rang || 1e9) || nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), 'fr'));
  return lignes;
}

function statistiques(lignes, regles) {
  const ev = lignes.filter((l) => l.evalue);
  const moyennes = ev.map((l) => l.calcul.moyenneGenerale);
  const valides = ev.filter((l) => l.calcul.admis).length;
  const arr = (v) => Math.round(v * 100) / 100;
  return {
    effectif: lignes.length,
    evalues: ev.length,
    valides,
    rattrapage: ev.length - valides,
    tauxReussite: ev.length ? Math.round((valides / ev.length) * 1000) / 10 : 0,
    moyenneClasse: moyennes.length ? arr(moyennes.reduce((a, b) => a + b, 0) / moyennes.length) : null,
    plusHaute: moyennes.length ? Math.max(...moyennes) : null,
    plusBasse: moyennes.length ? Math.min(...moyennes) : null,
    regles,
  };
}

function couleurNote(v, regles) {
  if (v === null || v === undefined) return C.COULEUR_TEXTE_CLAIR;
  if (v >= regles.seuil) return C.COULEUR_SUCCES;
  if (v >= regles.eliminatoire) return COULEUR_LIMITE;
  return C.COULEUR_ERREUR;
}

async function procesVerbalPDF({ etablissement, classe, semestre, ues, eleves, calculs, regles, ordre, emisParId = null }) {
  const lignes = preparerResultats(eleves, calculs, ordre);
  const stats = statistiques(lignes, regles);
  const certification = await certifier({
    cle: `pv_${classe.id}_${semestre.id}`,
    type: 'proces_verbal',
    etablissement,
    titre: `Procès-verbal des résultats, ${classe.nom} (${classe.niveau}), ${semestre.libelle} ${semestre.anneeScolaire || ''}`.trim(),
    elements: [
      ['Effectif', String(stats.effectif)], ['Évalués', String(stats.evalues)], ['Semestre validé', String(stats.valides)],
      ['Rattrapage', String(stats.rattrapage)], ['Taux de réussite', `${String(stats.tauxReussite).replace('.', ',')} %`],
      ['Moyenne de la classe', stats.moyenneClasse === null ? null : `${noteFr(stats.moyenneClasse)} / 20`],
      ['Seuil de validation', `${surVingt(regles.seuil)} / 20`],
    ],
    // Toutes les lignes du PV (élève, moyenne, décision) : modifier une
    // seule note change l'empreinte et donc le code.
    donnees: [...lignes].sort((a, b) => a.eleve.id - b.eleve.id).map((l) => [l.eleve.id, l.calcul?.moyenneGenerale ?? null, l.calcul?.admis ?? null,
      (l.calcul?.detailParUE || []).map((u) => [u.code, u.moyenne])]),
    emisParId,
  });
  const { doc, termine } = nouveauPDF({ layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;

  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(), titre: 'PROCÈS-VERBAL DES RÉSULTATS',
    sousTitre: `${classe.nom} (${classe.niveau}), ${semestre.libelle}`, reference: `Validation à ${surVingt(regles.seuil)}/20, éliminatoire sous ${surVingt(regles.eliminatoire)}/20`, largeurTitre: 300, certification,
  });
  y = blocIdentite(doc, marge, y, largeur, [
    ['Effectif', String(stats.effectif)], ['Évalués', String(stats.evalues)], ['Semestre validé', String(stats.valides)],
    ['Rattrapage', String(stats.rattrapage)], ['Taux de réussite', `${String(stats.tauxReussite).replace('.', ',')} %`],
    ['Moyenne de classe', stats.moyenneClasse === null ? '-' : `${noteFr(stats.moyenneClasse)}/20`],
    ['Plus haute / plus basse', stats.plusHaute === null ? '-' : `${noteFr(stats.plusHaute)} / ${noteFr(stats.plusBasse)}`, 1.3],
  ]) + 12;

  // Colonnes groupées par UE : la note finale de chaque matière, puis la
  // moyenne de l'UE. Double en-tête : UE en haut, matières en dessous.
  const groupes = ues.map((u) => ({ ue: u, matieres: [...(u.Matieres || [])].sort((x, z) => String(x.code).localeCompare(String(z.code))) }));
  const nbNotes = groupes.reduce((n, g) => n + g.matieres.length + 1, 0);
  const fixesG = [24, 100];
  const fixesD = [34, 30, 44, 52, 48];
  const reste = largeur - fixesG.reduce((a, b) => a + b, 0) - fixesD.reduce((a, b) => a + b, 0);
  const lNote = Math.max(20, reste / Math.max(nbNotes, 1));
  const taille = lNote < 30 ? 6.1 : 6.8;
  const colonnes = [
    ...fixesG,
    ...groupes.flatMap((g) => [...g.matieres.map(() => lNote), lNote]),
    ...fixesD,
  ];
  const abreger = (code) => String(code || '').split(/[-_ ]/).pop().slice(-6);
  const xDe = (i) => marge + colonnes.slice(0, i).reduce((a, b) => a + b, 0);

  function enTetes(yy) {
    const h1 = 22; const h2 = 14;
    // Ligne 1 : blocs fixes (fusionnés sur deux lignes) et une case par UE.
    const fond = C.COULEUR_MARINE;
    const caseTexte = (x, w, h, texte, opts = {}) => {
      doc.rect(x, yy, w, h).fill(opts.fond || fond);
      doc.rect(x, yy, w, h).lineWidth(0.5).strokeColor('#FFFFFF').stroke();
      doc.font('Helvetica-Bold').fontSize(opts.taille || 6.6).fillColor('#FFFFFF')
        .text(texte, x + 2, yy + (h - (opts.taille || 6.6)) / 2 - 1, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });
    };
    let i = 0;
    caseTexte(xDe(0), colonnes[0], h1 + h2, 'Rang'); caseTexte(xDe(1), colonnes[1], h1 + h2, 'Nom et prénom');
    i = 2;
    for (const g of groupes) {
      const n = g.matieres.length + 1;
      const w = colonnes.slice(i, i + n).reduce((a, b) => a + b, 0);
      doc.rect(xDe(i), yy, w, h1).fill(C.COULEUR_PRIMAIRE);
      doc.rect(xDe(i), yy, w, h1).lineWidth(0.5).strokeColor('#FFFFFF').stroke();
      doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#FFFFFF').text(`${g.ue.code} (${g.ue.credits} cr.)`, xDe(i) + 2, yy + 3, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });
      doc.font('Helvetica').fontSize(6).fillColor('#DCE6F4').text(g.ue.intitule, xDe(i) + 2, yy + 12, { width: w - 4, align: 'center', lineBreak: false, ellipsis: true });
      g.matieres.forEach((m, k) => {
        const x = xDe(i + k);
        doc.rect(x, yy + h1, colonnes[i + k], h2).fill('#1B355F');
        doc.rect(x, yy + h1, colonnes[i + k], h2).lineWidth(0.5).strokeColor('#FFFFFF').stroke();
        doc.font('Helvetica-Bold').fontSize(5.8).fillColor('#FFFFFF').text(abreger(m.code), x + 1, yy + h1 + 4, { width: colonnes[i + k] - 2, align: 'center', lineBreak: false, ellipsis: true });
      });
      const xm = xDe(i + n - 1);
      doc.rect(xm, yy + h1, colonnes[i + n - 1], h2).fill('#2C4F86');
      doc.rect(xm, yy + h1, colonnes[i + n - 1], h2).lineWidth(0.5).strokeColor('#FFFFFF').stroke();
      doc.font('Helvetica-Bold').fontSize(5.8).fillColor('#FFFFFF').text('Moy. UE', xm + 1, yy + h1 + 4, { width: colonnes[i + n - 1] - 2, align: 'center', lineBreak: false });
      i += n;
    }
    ['Moy. gén.', 'Crédits', 'Mention', 'Résultat', 'Décision'].forEach((t, k) => caseTexte(xDe(i + k), colonnes[i + k], h1 + h2, t));
    return yy + h1 + h2;
  }

  y = enTetes(y);
  const hLigne = 16;
  lignes.forEach((l, idx) => {
    if (y + hLigne > limiteBas(doc)) { doc.addPage(); y = enTetes(doc.page.margins.top); }
    const c = l.calcul;
    const parUE = new Map((c?.detailParUE || []).map((d) => [d.code, d]));
    const cellules = [
      { texte: l.rang ? String(l.rang) : '-', align: 'center', gras: true },
      { texte: nomComplet(l.eleve), gras: true },
    ];
    for (const g of groupes) {
      const d = parUE.get(g.ue.code);
      const parMatiere = new Map((d?.matieres || []).map((mm) => [mm.code, mm]));
      for (const m of g.matieres) {
        const mm = parMatiere.get(m.code);
        cellules.push(mm
          ? { texte: noteFr(mm.noteFinale), align: 'center', couleur: couleurNote(mm.noteFinale, regles), gras: mm.eliminatoire }
          : { texte: '-', align: 'center', couleur: C.COULEUR_TEXTE_CLAIR });
      }
      cellules.push(d
        ? { texte: noteFr(d.moyenne), align: 'center', gras: true, couleur: d.eliminatoire ? C.COULEUR_ERREUR : d.valide ? C.COULEUR_SUCCES : COULEUR_LIMITE }
        : { texte: '-', align: 'center', couleur: C.COULEUR_TEXTE_CLAIR });
    }
    cellules.push(
      { texte: l.evalue ? noteFr(c.moyenneGenerale) : '-', align: 'center', gras: true, couleur: l.evalue ? couleurNote(c.moyenneGenerale, regles) : C.COULEUR_TEXTE_CLAIR },
      { texte: l.evalue ? `${c.creditsValides}/${c.creditsTotal}` : '-', align: 'center' },
      { texte: l.evalue ? mention(c.moyenneGenerale) : '-' },
      { texte: l.evalue ? (c.admis ? 'Validé' : 'Non validé') : 'Non évalué', gras: true, couleur: !l.evalue ? C.COULEUR_TEXTE_CLAIR : c.admis ? C.COULEUR_SUCCES : C.COULEUR_ERREUR },
      { texte: l.evalue ? (c.decisionJury === 'admis_jury' ? 'Admis (jury)' : c.admis ? 'Admis(e)' : 'Rattrapage') : 'En attente', gras: true, couleur: !l.evalue ? C.COULEUR_TEXTE_CLAIR : c.admis ? C.COULEUR_SUCCES : C.COULEUR_RATTRAPAGE },
    );
    // Fond léger sous les moyennes d'UE pour les distinguer des notes de matière.
    let i = 2;
    for (const g of groupes) { i += g.matieres.length; doc.rect(xDe(i), y, colonnes[i], hLigne).fill('#EEF3FA'); i += 1; }
    y = dessinerLigne(doc, marge, y, colonnes, cellules, { hauteur: hLigne, taille, fond: undefined });
    if (idx % 2) doc.rect(marge, y - hLigne, largeur, hLigne).fillOpacity(0.025).fill('#000000').fillOpacity(1);
  });
  if (y + 130 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }

  // Légende des UE et des couleurs
  y += 10;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.COULEUR_TEXTE).text('Unités d’enseignement : ', marge, y, { continued: true })
    .font('Helvetica').fillColor(C.COULEUR_TEXTE_CLAIR)
    .text(groupes.map((g) => `${g.ue.code} ${g.ue.intitule} : ${g.matieres.map((m) => `${abreger(m.code)} ${m.intitule} (coef. ${m.coefficient})`).join(', ')}`).join('  ·  '), { width: largeur });
  doc.font('Helvetica').fontSize(7.2).fillColor(C.COULEUR_TEXTE_CLAIR)
    .text(`Notes de matière : (CC + examen) / 2.  Vert : ${surVingt(regles.seuil)} et plus (UE validée).  Jaune : sous le seuil (UE non validée).  Rouge : note éliminatoire (moins de ${surVingt(regles.eliminatoire)}/20), qui bloque l'UE.`, marge, doc.y + 3, { width: largeur });
  const ySig = doc.y + 14;
  blocSignature(doc, ySig, etablissement, 'Le Président du jury', certification);
  piedDePageOfficiel(doc, `Procès-verbal établi par ${etablissement.nom} via EduSphere  ·  ${classe.nom}, ${semestre.libelle}`, certification);
  return finaliser(doc, termine, certification);
}

function procesVerbalXlsx({ classe, semestre, ues, eleves, calculs, regles, ordre }) {
  const lignes = preparerResultats(eleves, calculs, ordre);
  const stats = statistiques(lignes, regles);
  const resultats = lignes.map((l) => {
    const c = l.calcul;
    const parUE = new Map((c?.detailParUE || []).map((d) => [d.code, d]));
    const ligne = { Rang: l.rang || '', Matricule: l.eleve.matricule || '', Nom: l.eleve.nom, 'Prénom': l.eleve.prenom };
    for (const u of ues) {
      const d = parUE.get(u.code);
      const parMatiere = new Map((d?.matieres || []).map((mm) => [mm.code, mm]));
      for (const m of [...(u.Matieres || [])].sort((x, z) => String(x.code).localeCompare(String(z.code)))) {
        const mm = parMatiere.get(m.code);
        ligne[`${m.code} ${m.intitule}`] = mm ? mm.noteFinale : '';
      }
      ligne[`${u.code} moyenne UE`] = d ? d.moyenne : '';
      ligne[`${u.code} résultat`] = d ? (d.eliminatoire ? 'Éliminatoire' : d.valide ? 'Validée' : 'Non validée') : '';
    }
    Object.assign(ligne, {
      'Moyenne générale': l.evalue ? c.moyenneGenerale : '',
      'Crédits validés': l.evalue ? c.creditsValides : '',
      'Crédits du semestre': l.evalue ? c.creditsTotal : '',
      Mention: l.evalue ? mention(c.moyenneGenerale) : '',
      'Résultat': l.evalue ? (c.admis ? 'Validé' : 'Non validé') : 'Non évalué',
      'Décision': l.evalue ? (c.admis ? 'Admis(e)' : 'Rattrapage') : 'En attente',
    });
    return ligne;
  });
  const notes = [];
  for (const l of lignes) {
    for (const d of l.calcul?.detailParUE || []) {
      for (const m of d.matieres) {
        notes.push({
          Matricule: l.eleve.matricule || '', Nom: l.eleve.nom, 'Prénom': l.eleve.prenom, UE: `${d.code} ${d.ue}`,
          'Matière': `${m.code} ${m.matiere}`, Coefficient: m.coefficient, 'Contrôle continu': m.moyenneCC ?? '', Examen: m.moyenneExamen ?? '',
          'Note finale': m.noteFinale, Session: m.session === 'rattrapage' ? 'Rattrapage' : 'Normale',
          'Résultat': m.eliminatoire ? 'Éliminatoire' : m.noteFinale >= regles.seuil ? 'Validée' : 'Non validée',
        });
      }
    }
  }
  const synthese = [
    ['Procès-verbal des résultats'], [],
    ['Classe', `${classe.nom} (${classe.niveau})`], ['Semestre', `${semestre.libelle} ${semestre.anneeScolaire || ''}`.trim()],
    ['Seuil de validation', regles.seuil], ['Note éliminatoire', regles.eliminatoire], [],
    ['Effectif', stats.effectif], ['Évalués', stats.evalues], ['Semestre validé', stats.valides], ['Rattrapage', stats.rattrapage],
    ['Taux de réussite (%)', stats.tauxReussite], ['Moyenne de classe', stats.moyenneClasse ?? ''], ['Plus haute moyenne', stats.plusHaute ?? ''], ['Plus basse moyenne', stats.plusBasse ?? ''],
  ];
  return versXlsx([
    { nom: 'Résultats', lignes: resultats, largeurs: [6, 14, 16, 16, ...ues.flatMap((u) => [...(u.Matieres || []).map(() => 14), 14, 14]), 16, 14, 16, 12, 12, 12] },
    { nom: 'Notes détaillées', lignes: notes.length ? notes : [{ Matricule: 'Aucune note' }], largeurs: [14, 16, 16, 30, 32, 11, 16, 10, 11, 11, 13] },
    { nom: 'Synthèse', lignes: synthese, largeurs: [24, 32] },
  ]);
}

// ---------------------------------------------------------------------------
// Emplois du temps (une classe ou toutes, une page par classe)
// ---------------------------------------------------------------------------

const TEINTES = [['#E3ECF6', '#1D5FA8'], ['#E7F1EC', '#136B44'], ['#FFF3D6', '#8A5D00'], ['#F3E8F6', '#6D3A84'], ['#E2F2F4', '#157A8C'], ['#FBE9E4', '#A23B2E'], ['#ECEFF4', '#3B4A63'], ['#EEF5E0', '#4E6B1B']];

async function emploisDuTempsPDF({ etablissement, semestre, pages, emisParId = null }) {
  const certification = await certifier({
    cle: `emplois_du_temps_${pages.map((p) => p.classe.id).join('-')}_${semestre.id}`.slice(0, 120),
    type: 'emploi_du_temps',
    etablissement,
    titre: `Emploi${pages.length > 1 ? 's' : ''} du temps, ${pages.length === 1 ? `${pages[0].classe.nom} (${pages[0].classe.niveau})` : `${pages.length} classes`}, ${semestre.libelle}`,
    elements: [['Classes', pages.map((p) => p.classe.nom).join(', ')], ['Semestre', semestre.libelle],
      ['Créneaux hebdomadaires', String(pages.reduce((n, p) => n + p.creneaux.length, 0))]],
    donnees: pages.map((p) => [p.classe.id, p.creneaux.map((c) => [c.jour, c.heureDebut, c.heureFin, c.matiere, c.salle || null])]),
    emisParId,
  });
  const { doc, termine } = nouveauPDF({ layout: 'landscape', margin: 36 });
  const marge = doc.page.margins.left;
  const largeurTotale = doc.page.width - marge - doc.page.margins.right;
  pages.forEach(({ classe, creneaux }, k) => {
    if (k) doc.addPage();
    const yDebut = enTeteOfficiel(doc, etablissement, {
      surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(), titre: 'EMPLOI DU TEMPS', sousTitre: `${classe.nom} (${classe.niveau})`, reference: semestre.libelle, largeurTitre: 230,
      certification, qrEnTete: true,
    });
    const matieres = [...new Set(creneaux.map((c) => c.matiere || 'Cours'))];
    const teinte = (m) => TEINTES[matieres.indexOf(m) % TEINTES.length];
    const gouttiere = 34;
    const largeurJour = (largeurTotale - gouttiere) / JOURS_EMPLOI.length;
    const yColonnes = yDebut + 16;
    const hauteurColonnes = doc.page.height - doc.page.margins.bottom - yColonnes - 50;
    const bornes = creneaux.flatMap((c) => [versMinutesEmploi(c.heureDebut), versMinutesEmploi(c.heureFin)]);
    const debutGrille = Math.floor(Math.min(7 * 60, ...bornes) / 60) * 60;
    const finGrille = Math.ceil(Math.max(18 * 60, ...bornes) / 60) * 60;
    const versY = (min) => yColonnes + ((min - debutGrille) / (finGrille - debutGrille)) * hauteurColonnes;

    JOURS_EMPLOI.forEach((jour, i) => {
      const x = marge + gouttiere + i * largeurJour;
      doc.roundedRect(x + 1, yDebut, largeurJour - 4, 14, 3).fill(C.COULEUR_MARINE);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF').text(jour.toUpperCase(), x + 1, yDebut + 3.5, { width: largeurJour - 4, align: 'center', characterSpacing: 0.5 });
      doc.rect(x + 1, yColonnes, largeurJour - 4, hauteurColonnes).lineWidth(0.6).strokeColor(C.COULEUR_BORDURE).stroke();
    });
    for (let h = debutGrille; h <= finGrille; h += 60) {
      const y = versY(h);
      doc.font('Helvetica').fontSize(6.5).fillColor(C.COULEUR_TEXTE_CLAIR).text(`${String(h / 60).padStart(2, '0')}h`, marge, Math.max(yColonnes, y - 4), { width: gouttiere - 6, align: 'right' });
      doc.moveTo(marge + gouttiere, y).lineTo(marge + largeurTotale - 3, y).lineWidth(0.4).dash(1, { space: 2 }).strokeColor(C.COULEUR_BORDURE).stroke();
      doc.undash();
    }
    creneaux.forEach((c) => {
      const iJour = JOURS_EMPLOI.indexOf(c.jour);
      if (iJour === -1) return;
      const debut = versMinutesEmploi(c.heureDebut);
      const fin = Math.max(versMinutesEmploi(c.heureFin), debut + 20);
      const x = marge + gouttiere + iJour * largeurJour + 3;
      const y = versY(debut) + 1;
      const h = Math.max(versY(fin) - versY(debut) - 2, 16);
      const [fond, trait] = teinte(c.matiere || 'Cours');
      doc.roundedRect(x, y, largeurJour - 8, h, 3).fill(fond);
      doc.rect(x, y, 3, h).fill(trait);
      doc.font('Helvetica-Bold').fontSize(7.4).fillColor(trait).text(c.matiere || 'Cours', x + 7, y + 3, { width: largeurJour - 18, height: Math.max(h - 14, 9), ellipsis: true });
      if (h > 22) {
        doc.font('Helvetica').fontSize(6.4).fillColor(C.COULEUR_TEXTE)
          .text(`${c.heureDebut} à ${c.heureFin}${c.salle ? `  ·  ${c.salle}` : ''}`, x + 7, y + h - 11, { width: largeurJour - 18, lineBreak: false, ellipsis: true });
      }
    });
    if (!creneaux.length) {
      doc.font('Helvetica').fontSize(10).fillColor(C.COULEUR_TEXTE_CLAIR).text('Aucun cours programmé pour cette classe.', marge, yColonnes + hauteurColonnes / 2 - 6, { width: largeurTotale, align: 'center' });
    }
    // Légende des matières et volume horaire hebdomadaire
    const yLegende = yColonnes + hauteurColonnes + 10;
    let xl = marge;
    matieres.forEach((m) => {
      const minutes = creneaux.filter((c) => (c.matiere || 'Cours') === m).reduce((s, c) => s + versMinutesEmploi(c.heureFin) - versMinutesEmploi(c.heureDebut), 0);
      const texte = `${m} (${Math.round((minutes / 60) * 10) / 10} h)`;
      const w = doc.font('Helvetica').fontSize(7).widthOfString(texte) + 18;
      if (xl + w > marge + largeurTotale) return;
      doc.roundedRect(xl, yLegende, 9, 9, 2).fill(teinte(m)[1]);
      doc.fillColor(C.COULEUR_TEXTE).text(texte, xl + 12, yLegende + 1);
      xl += w + 8;
    });
  });
  piedDePageOfficiel(doc, `Emploi du temps établi par ${etablissement.nom} via EduSphere  ·  ${semestre.libelle}`, certification);
  return finaliser(doc, termine, certification);
}

module.exports = {
  // Réutilisés par le rapport national du ministère.
  outilsTableaux: { nouveauPDF, tableau, finaliser, limiteBas },
  listePresencePDF, recapitulatifPresencesPDF, recapitulatifPresencesXlsx, procesVerbalPDF, procesVerbalXlsx, emploisDuTempsPDF,
};
