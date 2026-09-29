const path = require('path');
const PDFDocument = require('pdfkit');

// Export des établissements affiliés (espace superadmin) : un document PDF
// soigné plutôt qu'un tableur brut. A4 paysage, bandeau aux couleurs
// d'EduSphere, chiffres clés, tableau des écoles (logo, statut en pastille,
// lignes alternées), pied de page numéroté.
const C = {
  marine: '#0B1E3D', bleu: '#1D5FA8', teal: '#157A8C', vert: '#1F8A54', or: '#F0AD2E',
  texte: '#1C2321', clair: '#5F6765', bordure: '#E2E5E1', zone: '#F5F7FA',
  succes: '#136B44', succesFond: '#E7F1EC', erreur: '#A23B2E', erreurFond: '#F6E7E4',
};
const LOGO_EDUSPHERE = path.join(__dirname, '..', 'assets', 'logo-edusphere.png');

function dateLongue(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
}
function heure(d) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Libreville' });
}
function initiales(e) {
  const sigle = String(e.sigle || '').replace(/[^\p{L}\p{N}]/gu, '');
  if (sigle) return sigle.slice(0, 4).toUpperCase();
  return String(e.nom || '').split(/[\s'’-]+/).filter((m) => m.length > 2).map((m) => m[0]).join('').slice(0, 3).toUpperCase() || 'E';
}
function logoBuffer(e) {
  const m = String(e.logo || '').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!m) return null;
  // Version réduite (96 px) : le document reste léger.
  try {
    const { redimensionnerLogo } = require('./logoService');
    return redimensionnerLogo(e.logo, 96) || Buffer.from(m[2], 'base64');
  } catch {
    return Buffer.from(m[2], 'base64');
  }
}

function bandeau(doc, largeur, genereLe, total) {
  const degrade = doc.linearGradient(0, 0, largeur, 110);
  degrade.stop(0, C.marine).stop(0.48, C.bleu).stop(0.76, C.teal).stop(1, C.vert);
  doc.rect(0, 0, largeur, 104).fill(degrade);
  doc.rect(0, 104, largeur, 4).fill(C.or);
  doc.roundedRect(40, 24, 56, 56, 12).fill('#ffffff');
  try { doc.image(LOGO_EDUSPHERE, 44, 28, { fit: [48, 48], align: 'center', valign: 'center' }); } catch { /* logo absent */ }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Établissements affiliés', 112, 30, { lineBreak: false });
  doc.font('Helvetica').fontSize(10.5).fillColor('#D3E1F2')
    .text(`EduSphere · pilotage de la plateforme · ${total} école${total > 1 ? 's' : ''}`, 112, 60, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
    .text('EXPORT DU', largeur - 240, 34, { width: 200, align: 'right', characterSpacing: 1.2 });
  doc.font('Helvetica').fontSize(12).fillColor('#ffffff')
    .text(`${dateLongue(genereLe)} à ${heure(genereLe)}`, largeur - 240, 50, { width: 200, align: 'right' });
}

function chiffresCles(doc, y, largeur, stats) {
  const marge = 40;
  const ecart = 14;
  const l = (largeur - 2 * marge - 3 * ecart) / 4;
  stats.forEach(([libelle, valeur, couleur], i) => {
    const x = marge + i * (l + ecart);
    doc.roundedRect(x, y, l, 62, 12).fillAndStroke('#ffffff', C.bordure);
    doc.roundedRect(x, y + 14, 4, 34, 2).fill(couleur);
    doc.fillColor(C.clair).font('Helvetica').fontSize(9.5).text(libelle, x + 18, y + 14, { width: l - 30, lineBreak: false });
    doc.fillColor(C.marine).font('Helvetica-Bold').fontSize(22).text(String(valeur), x + 18, y + 29, { width: l - 30, lineBreak: false });
  });
}

const COLONNES = [
  { cle: 'ecole', titre: 'École', l: 232 },
  { cle: 'sigle', titre: 'Sigle', l: 62 },
  { cle: 'ville', titre: 'Ville', l: 86 },
  { cle: 'statut', titre: 'Statut', l: 96 },
  { cle: 'fonct', titre: 'Fonctionnalités', l: 88, droite: true },
  { cle: 'comptes', titre: 'Comptes', l: 64, droite: true },
  { cle: 'verr', titre: 'Verrouillés', l: 68, droite: true },
  { cle: 'date', titre: 'Affiliée le', l: 66, droite: true },
];

function enTeteTableau(doc, y) {
  let x = 40;
  doc.roundedRect(40, y, 762, 28, 8).fill(C.marine);
  COLONNES.forEach((col) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7)
      .text(col.titre.toUpperCase(), x + (col.droite ? 4 : 8), y + 11, { width: col.l - 12, align: col.droite ? 'right' : 'left', characterSpacing: 0.2, lineBreak: false });
    x += col.l;
  });
  return y + 32;
}

function ligne(doc, y, e, i) {
  const h = 40;
  if (i % 2 === 0) doc.roundedRect(40, y, 762, h, 6).fill(C.zone);
  let x = 40;
  const milieu = y + h / 2;
  // École : vignette (logo ou initiales) + nom
  doc.roundedRect(x + 10, milieu - 13, 26, 26, 6).fillAndStroke('#ffffff', C.bordure);
  const logo = logoBuffer(e);
  let dessine = false;
  if (logo) {
    try { doc.image(logo, x + 12, milieu - 11, { fit: [22, 22], align: 'center', valign: 'center' }); dessine = true; } catch { /* illisible */ }
  }
  if (!dessine) {
    doc.fillColor(C.marine).font('Helvetica-Bold').fontSize(7.5).text(initiales(e), x + 10, milieu - 4, { width: 26, align: 'center', lineBreak: false });
  }
  // Nom sur deux lignes au besoin, jamais coupé à mi-mot.
  const largeurNom = COLONNES[0].l - 54;
  doc.font('Helvetica-Bold').fontSize(9.5);
  const deuxLignes = doc.heightOfString(e.nom, { width: largeurNom }) > 13;
  doc.fillColor(C.texte).text(e.nom, x + 46, deuxLignes ? milieu - 11 : milieu - 5, { width: largeurNom, height: 24, ellipsis: true });
  x += COLONNES[0].l;
  const texte = (valeur, col, opts = {}) => {
    doc.fillColor(opts.couleur || C.texte).font(opts.gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
      .text(String(valeur), x + 8, milieu - 5, { width: col.l - 16, align: col.droite ? 'right' : 'left', lineBreak: false, ellipsis: true });
    x += col.l;
  };
  texte(e.sigle || '-', COLONNES[1]);
  texte(e.ville || '-', COLONNES[2]);
  const actif = e.statut === 'actif';
  const largeurPastille = actif ? 56 : 76;
  doc.roundedRect(x + 8, milieu - 9, largeurPastille, 18, 9).fill(actif ? C.succesFond : C.erreurFond);
  doc.circle(x + 18, milieu, 2.5).fill(actif ? C.succes : C.erreur);
  doc.fillColor(actif ? C.succes : C.erreur).font('Helvetica-Bold').fontSize(8.5)
    .text(actif ? 'Active' : 'Verrouillée', x + 24, milieu - 4, { width: largeurPastille - 18, lineBreak: false });
  x += COLONNES[3].l;
  texte(e.nbFonctionnalites ?? 0, COLONNES[4], { gras: true });
  texte(e.nbComptes ?? 0, COLONNES[5], { gras: true });
  texte(e.nbComptesVerrouilles ?? 0, COLONNES[6], { gras: true, couleur: e.nbComptesVerrouilles ? C.erreur : C.texte });
  doc.fillColor(C.clair).font('Helvetica').fontSize(9)
    .text(new Date(e.createdAt).toLocaleDateString('fr-FR'), x + 4, milieu - 5, { width: COLONNES[7].l - 12, align: 'right', lineBreak: false });
  return y + h + 2;
}

function genererExportEtablissementsPDF(etablissements) {
  return new Promise((resoudre, rejeter) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true, info: { Title: 'Établissements affiliés', Author: 'EduSphere' } });
    const morceaux = [];
    doc.on('data', (m) => morceaux.push(m));
    doc.on('end', () => resoudre(Buffer.concat(morceaux)));
    doc.on('error', rejeter);

    const largeur = doc.page.width;
    const hauteur = doc.page.height;
    const genereLe = new Date();
    bandeau(doc, largeur, genereLe, etablissements.length);
    chiffresCles(doc, 128, largeur, [
      ['Écoles affiliées', etablissements.length, C.bleu],
      ['Écoles actives', etablissements.filter((e) => e.statut === 'actif').length, C.vert],
      ['Comptes des écoles', etablissements.reduce((s, e) => s + (e.nbComptes || 0), 0), C.teal],
      ['Comptes verrouillés', etablissements.reduce((s, e) => s + (e.nbComptesVerrouilles || 0), 0), C.erreur],
    ]);
    let y = enTeteTableau(doc, 214);
    etablissements.forEach((e, i) => {
      if (y + 42 > hauteur - 50) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        doc.rect(0, 0, largeur, 6).fill(C.marine);
        y = enTeteTableau(doc, 34);
      }
      y = ligne(doc, y, e, i);
    });
    if (!etablissements.length) {
      doc.fillColor(C.clair).font('Helvetica').fontSize(11).text('Aucune école à exporter.', 40, y + 16);
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      doc.moveTo(40, hauteur - 36).lineTo(largeur - 40, hauteur - 36).lineWidth(0.6).strokeColor(C.bordure).stroke();
      doc.fillColor(C.clair).font('Helvetica').fontSize(8.5)
        .text('EduSphere · Établissements affiliés · document interne, ne pas diffuser', 40, hauteur - 28, { lineBreak: false });
      doc.text(`Page ${i + 1} / ${pages.count}`, largeur - 140, hauteur - 28, { width: 100, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { genererExportEtablissementsPDF };
