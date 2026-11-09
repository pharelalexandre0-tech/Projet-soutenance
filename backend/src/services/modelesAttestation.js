// Mise en page des attestations (scolarité, inscription, réussite).
// Chaque établissement choisit son modèle et sa couleur (Paramètres) : deux
// écoles ne délivrent donc pas le même document. Le contenu est mesuré puis
// réparti sur toute la hauteur de la page A4, sans bloc tassé en haut.
const { outils } = require('./pdfService');

const { sceauVerification, dessinerLogo, sigleEtablissement, microTexte } = outils;
const C = outils.couleurs;

const MODELES_DOCUMENTS = ['classique', 'moderne', 'prestige'];
const COULEUR_PAR_DEFAUT = '#0B1E3D';
// Couleurs proposées dans Paramètres (une couleur libre reste possible).
const COULEURS_DOCUMENTS = [
  { valeur: '#0B1E3D', nom: 'Marine' },
  { valeur: '#1D5FA8', nom: 'Bleu' },
  { valeur: '#157A8C', nom: 'Sarcelle' },
  { valeur: '#1F6B45', nom: 'Vert forêt' },
  { valeur: '#7A1F2B', nom: 'Bordeaux' },
  { valeur: '#8A5A12', nom: 'Bronze' },
  { valeur: '#3D2A6B', nom: 'Violet' },
  { valeur: '#2E3440', nom: 'Anthracite' },
];

const hexValide = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Validation commune (Académie et superadmin) : renvoie les champs à
// enregistrer, ou lève une erreur 400 lisible.
function validerStyleDocuments({ modeleDocuments, couleurDocuments } = {}) {
  const champs = {};
  if (modeleDocuments !== undefined) {
    if (!MODELES_DOCUMENTS.includes(modeleDocuments)) throw Object.assign(new Error('modèle de document inconnu'), { status: 400 });
    champs.modeleDocuments = modeleDocuments;
  }
  if (couleurDocuments !== undefined) {
    if (couleurDocuments && !hexValide(couleurDocuments)) throw Object.assign(new Error('couleur invalide : format attendu #RRGGBB'), { status: 400 });
    // Une couleur trop claire rendrait le titre illisible sur le papier blanc.
    if (couleurDocuments && luminance(couleurDocuments) > 0.45) throw Object.assign(new Error('couleur trop claire pour un document imprimé, choisissez une teinte plus foncée'), { status: 400 });
    champs.couleurDocuments = couleurDocuments ? couleurDocuments.toUpperCase() : null;
  }
  return champs;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Mélange avec le blanc : t = 0 donne du blanc, t = 1 la couleur pleine.
function teinte(hex, t) {
  const [r, g, b] = rgb(hex).map((c) => Math.round(255 - (255 - c) * t));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function styleDe(etablissement, surcharge = {}) {
  const modele = MODELES_DOCUMENTS.includes(surcharge.modele) ? surcharge.modele
    : (MODELES_DOCUMENTS.includes(etablissement.modeleDocuments) ? etablissement.modeleDocuments : 'classique');
  const accent = hexValide(surcharge.couleur) ? surcharge.couleur : (hexValide(etablissement.couleurDocuments) ? etablissement.couleurDocuments : COULEUR_PAR_DEFAUT);
  return { modele, accent };
}

function losange(doc, cx, cy, taille, couleur) {
  doc.save().translate(cx, cy).rotate(45).rect(-taille / 2, -taille / 2, taille, taille).fill(couleur).restore();
}

// Filet orné : trait, losange, trait.
function ornement(doc, cx, y, demiLargeur, couleur) {
  doc.moveTo(cx - demiLargeur, y).lineTo(cx - 8, y).lineWidth(0.7).strokeColor(couleur).stroke();
  doc.moveTo(cx + 8, y).lineTo(cx + demiLargeur, y).lineWidth(0.7).strokeColor(couleur).stroke();
  losange(doc, cx, y, 4.5, couleur);
}

const adresseDe = (e) => [e.boitePostale, e.ville, e.pays].filter(Boolean).join(', ');
const contactsDe = (e) => [e.telephone, e.email].filter(Boolean).join('  ·  ');

function logoOuSigle(doc, etablissement, x, y, taille, accent) {
  if (dessinerLogo(doc, etablissement, x, y, taille)) return;
  doc.circle(x + taille / 2, y + taille / 2, taille / 2).lineWidth(1.2).strokeColor(accent).stroke();
  doc.font('Times-Bold').fontSize(taille * 0.26).fillColor(accent)
    .text(sigleEtablissement(etablissement), x, y + taille / 2 - taille * 0.13, { width: taille, align: 'center', lineBreak: false });
}

// ---------------------------------------------------------------------------
// Décor de page et en-tête, propres à chaque modèle. Chaque fonction renvoie
// la zone utile { haut, bas, gauche, droite }.
// ---------------------------------------------------------------------------
function decorClassique(doc, e, s, certification) {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.rect(24, 24, W - 48, H - 48).lineWidth(1.4).strokeColor(s.accent).stroke();
  doc.rect(29, 29, W - 58, H - 58).lineWidth(0.4).strokeColor(teinte(s.accent, 0.55)).stroke();
  const gauche = 64;
  const droite = W - 64;
  const largeur = droite - gauche;
  const tailleLogo = 58;
  logoOuSigle(doc, e, W / 2 - tailleLogo / 2, 52, tailleLogo, s.accent);
  let y = 52 + tailleLogo + 10;
  doc.font('Times-Bold').fontSize(15).fillColor(s.accent).text(e.nom.toUpperCase(), gauche, y, { width: largeur, align: 'center', characterSpacing: 0.6 });
  y = doc.y + 2;
  if (e.devise) { doc.font('Times-Italic').fontSize(9.5).fillColor(C.COULEUR_TEXTE_CLAIR).text(e.devise, gauche, y, { width: largeur, align: 'center' }); y = doc.y + 2; }
  const ligne = [adresseDe(e), contactsDe(e)].filter(Boolean).join('  ·  ');
  if (ligne) { doc.font('Helvetica').fontSize(7.6).fillColor(C.COULEUR_TEXTE_CLAIR).text(ligne, gauche, y, { width: largeur, align: 'center' }); y = doc.y; }
  y += 12;
  doc.moveTo(gauche, y).lineTo(droite, y).lineWidth(0.9).strokeColor(s.accent).stroke();
  doc.moveTo(gauche, y + 2.5).lineTo(droite, y + 2.5).lineWidth(0.3).strokeColor(s.accent).stroke();
  if (certification) microTexte(doc, gauche, y + 5.5, largeur, e, certification);
  return { haut: y + 18, bas: H - 92, gauche, droite };
}

function decorModerne(doc, e, s, certification) {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.rect(0, 0, 16, H).fill(s.accent);
  doc.rect(16, 0, 5, H).fill(teinte(s.accent, 0.25));
  doc.rect(W - 150, 0, 150, 6).fill(s.accent);
  const gauche = 66;
  const droite = W - 56;
  const tailleLogo = 54;
  logoOuSigle(doc, e, gauche, 48, tailleLogo, s.accent);
  const xNom = gauche + tailleLogo + 14;
  const largeurNom = droite - xNom - 150;
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(C.COULEUR_MARINE).text(e.nom, xNom, 52, { width: largeurNom });
  let y = doc.y + 2;
  if (e.devise) { doc.font('Helvetica-Oblique').fontSize(8.2).fillColor(s.accent).text(e.devise, xNom, y, { width: largeurNom }); y = doc.y + 2; }
  doc.font('Helvetica').fontSize(7.6).fillColor(C.COULEUR_TEXTE_CLAIR);
  if (adresseDe(e)) { doc.text(adresseDe(e), xNom, y, { width: largeurNom }); y = doc.y + 1; }
  if (contactsDe(e)) { doc.text(contactsDe(e), xNom, y, { width: largeurNom }); y = doc.y; }
  y = Math.max(y, 48 + tailleLogo) + 18;
  doc.moveTo(gauche, y).lineTo(droite, y).lineWidth(0.6).strokeColor(teinte(s.accent, 0.35)).stroke();
  if (certification) microTexte(doc, gauche, y + 3, droite - gauche, e, certification);
  return { haut: y + 16, bas: H - 92, gauche, droite };
}

function decorPrestige(doc, e, s, certification) {
  const W = doc.page.width;
  const H = doc.page.height;
  // Filigrane : logo (ou sigle) très pâle au centre de la page.
  doc.save().opacity(0.05);
  if (!dessinerLogo(doc, e, W / 2 - 160, H / 2 - 130, 320)) {
    doc.font('Times-Bold').fontSize(150).fillColor(s.accent).text(sigleEtablissement(e), 0, H / 2 - 70, { width: W, align: 'center', lineBreak: false });
  }
  doc.restore();
  // Double cadre et coins ornés.
  doc.rect(20, 20, W - 40, H - 40).lineWidth(2.6).strokeColor(s.accent).stroke();
  doc.rect(27, 27, W - 54, H - 54).lineWidth(0.6).strokeColor(s.accent).stroke();
  [[27, 27], [W - 27, 27], [27, H - 27], [W - 27, H - 27]].forEach(([x, y]) => losange(doc, x, y, 9, s.accent));
  const gauche = 70;
  const droite = W - 70;
  const largeur = droite - gauche;
  const tailleLogo = 62;
  logoOuSigle(doc, e, W / 2 - tailleLogo / 2, 50, tailleLogo, s.accent);
  let y = 50 + tailleLogo + 10;
  doc.font('Times-Bold').fontSize(16).fillColor(s.accent).text(e.nom.toUpperCase(), gauche, y, { width: largeur, align: 'center', characterSpacing: 1.2 });
  y = doc.y + 2;
  if (e.devise) { doc.font('Times-Italic').fontSize(10).fillColor(C.COULEUR_TEXTE_CLAIR).text(e.devise, gauche, y, { width: largeur, align: 'center' }); y = doc.y + 2; }
  const ligne = [adresseDe(e), contactsDe(e)].filter(Boolean).join('  ·  ');
  if (ligne) { doc.font('Times-Roman').fontSize(8.2).fillColor(C.COULEUR_TEXTE_CLAIR).text(ligne, gauche, y, { width: largeur, align: 'center' }); y = doc.y; }
  y += 12;
  ornement(doc, W / 2, y, 120, s.accent);
  if (certification) microTexte(doc, gauche, y + 6, largeur, e, certification);
  return { haut: y + 18, bas: H - 92, gauche, droite };
}

const DECORS = { classique: decorClassique, moderne: decorModerne, prestige: decorPrestige };

// ---------------------------------------------------------------------------
// Blocs de contenu : chacun sait se mesurer (hauteur) et se dessiner (y).
// ---------------------------------------------------------------------------
function blocTitre(doc, s, zone, { titre, complement, reference }) {
  const { gauche, droite } = zone;
  const largeur = droite - gauche;
  const cx = (gauche + droite) / 2;
  if (s.modele === 'moderne') {
    return {
      hauteur: 10 + 8 + 30 + 12 + 12,
      dessiner(y) {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(s.accent).text('DOCUMENT OFFICIEL', gauche, y, { characterSpacing: 1.6, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(25).fillColor(C.COULEUR_MARINE).text(`Attestation ${complement}`, gauche, y + 16, { width: largeur, lineBreak: false });
        doc.rect(gauche, y + 50, 46, 4).fill(s.accent);
        doc.font('Courier').fontSize(8).fillColor(C.COULEUR_TEXTE_CLAIR).text(reference, gauche + 58, y + 47, { lineBreak: false });
      },
    };
  }
  if (s.modele === 'prestige') {
    return {
      hauteur: 34 + 22 + 16 + 12,
      dessiner(y) {
        doc.font('Times-Bold').fontSize(28).fillColor(s.accent).text('ATTESTATION', gauche, y, { width: largeur, align: 'center', characterSpacing: 5 });
        doc.font('Times-Italic').fontSize(17).fillColor(C.COULEUR_TEXTE).text(complement, gauche, y + 34, { width: largeur, align: 'center' });
        ornement(doc, cx, y + 62, 40, s.accent);
        doc.font('Times-Roman').fontSize(8.5).fillColor(C.COULEUR_TEXTE_CLAIR).text(reference, gauche, y + 70, { width: largeur, align: 'center' });
      },
    };
  }
  return {
    hauteur: 26 + 14 + 12,
    dessiner(y) {
      doc.font('Times-Bold').fontSize(21).fillColor(s.accent).text(titre, gauche, y, { width: largeur, align: 'center', characterSpacing: 1.6 });
      ornement(doc, cx, y + 32, 50, s.accent);
      doc.font('Helvetica').fontSize(8).fillColor(C.COULEUR_TEXTE_CLAIR).text(reference, gauche, y + 41, { width: largeur, align: 'center' });
    },
  };
}

// Corps du texte : phrase d'introduction, nom du titulaire centré sur sa
// propre ligne (il ressort sans casser la justification), puis la suite.
function polices(s, italique = false) {
  return s.modele === 'moderne'
    ? { normal: italique ? 'Helvetica-Oblique' : 'Helvetica', gras: 'Helvetica-Bold', taille: italique ? 10.5 : 11.2, interligne: 5, nom: 16 }
    : { normal: italique ? 'Times-Italic' : 'Times-Roman', gras: 'Times-Bold', taille: italique ? 12 : (s.modele === 'prestige' ? 13 : 12.6), interligne: 5.5, nom: s.modele === 'prestige' ? 19 : 17.5 };
}

function blocTexte(doc, s, zone, texte, { italique = false, centre = false } = {}) {
  const retrait = s.modele === 'moderne' ? 0 : 14;
  const x = zone.gauche + retrait;
  const largeur = zone.droite - zone.gauche - retrait * 2;
  const p = polices(s, italique);
  const options = { width: largeur, lineGap: p.interligne, align: centre ? 'center' : 'justify' };
  const hauteur = doc.font(p.normal).fontSize(p.taille).heightOfString(texte, options);
  return {
    hauteur,
    dessiner(y) { doc.font(p.normal).fontSize(p.taille).fillColor(C.COULEUR_TEXTE).text(texte, x, y, options); },
  };
}

function blocCorps(doc, s, zone, { introduction, titulaire, suite }) {
  const intro = blocTexte(doc, s, zone, introduction, { centre: true });
  const corps = blocTexte(doc, s, zone, suite);
  const p = polices(s);
  const hNom = p.nom + 6;
  return {
    hauteur: intro.hauteur + 8 + hNom + 8 + corps.hauteur,
    dessiner(y) {
      intro.dessiner(y);
      let yn = y + intro.hauteur + 8;
      const police = s.modele === 'moderne' ? 'Helvetica-Bold' : 'Times-Bold';
      let taille = p.nom;
      while (taille > 11 && doc.font(police).fontSize(taille).widthOfString(titulaire) > zone.droite - zone.gauche) taille -= 0.5;
      doc.font(police).fontSize(taille).fillColor(s.modele === 'moderne' ? C.COULEUR_MARINE : s.accent)
        .text(titulaire, zone.gauche, yn, { width: zone.droite - zone.gauche, align: 'center', characterSpacing: s.modele === 'moderne' ? 0 : 0.8, lineBreak: false });
      yn += hNom + 8;
      corps.dessiner(yn);
    },
  };
}

// Fiche d'identité : paires [libellé, valeur, chasse fixe].
function blocIdentite(doc, s, zone, paires) {
  const { gauche, droite } = zone;
  const largeur = droite - gauche;
  if (s.modele === 'prestige') {
    const pas = paires.length > 6 ? 19 : 22;
    const x = gauche + 40;
    const l = largeur - 80;
    return {
      hauteur: paires.length * pas + 16,
      dessiner(y) {
        doc.rect(x - 14, y, l + 28, paires.length * pas + 16).lineWidth(0.5).strokeColor(teinte(s.accent, 0.5)).stroke();
        paires.forEach(([libelle, valeur, mono], i) => {
          const yl = y + 10 + i * pas;
          doc.font('Times-Italic').fontSize(10.5).fillColor(C.COULEUR_TEXTE_CLAIR).text(libelle, x, yl, { lineBreak: false });
          const wl = doc.widthOfString(libelle);
          doc.font(mono ? 'Courier-Bold' : 'Times-Bold').fontSize(mono ? 10.5 : 11.5);
          const wv = Math.min(Math.ceil(doc.widthOfString(String(valeur))) + 2, l - wl - 30);
          doc.fillColor(C.COULEUR_TEXTE).text(String(valeur), x + l - wv, yl, { width: wv, lineBreak: false, ellipsis: true });
          // Points de conduite entre le libellé et la valeur.
          doc.moveTo(x + wl + 6, yl + 9).lineTo(x + l - wv - 6, yl + 9).dash(0.6, { space: 2.4 }).lineWidth(0.6).strokeColor(teinte(s.accent, 0.45)).stroke().undash();
        });
      },
    };
  }
  const colonnes = 2;
  const ecart = s.modele === 'moderne' ? 8 : 0;
  const hauteurCase = s.modele === 'moderne' ? 40 : 36;
  const lignes = Math.ceil(paires.length / colonnes);
  const lCase = (largeur - ecart * (colonnes - 1)) / colonnes;
  return {
    hauteur: lignes * hauteurCase + (lignes - 1) * ecart,
    dessiner(y) {
      if (s.modele !== 'moderne') doc.moveTo(gauche, y).lineTo(droite, y).lineWidth(0.8).strokeColor(s.accent).stroke();
      paires.forEach(([libelle, valeur, mono], i) => {
        const col = i % colonnes;
        const lig = Math.floor(i / colonnes);
        // Une valeur seule sur sa ligne occupe toute la largeur.
        const seule = i === paires.length - 1 && col === 0;
        const x = gauche + col * (lCase + ecart);
        const l = seule ? largeur : lCase;
        const yc = y + lig * (hauteurCase + ecart);
        if (s.modele === 'moderne') {
          doc.roundedRect(x, yc, l, hauteurCase, 4).fill(teinte(s.accent, 0.07));
          doc.rect(x, yc, 3, hauteurCase).fill(s.accent);
        } else {
          doc.moveTo(x, yc + hauteurCase).lineTo(x + l, yc + hauteurCase).lineWidth(0.4).strokeColor(teinte(s.accent, 0.35)).stroke();
          if (col === 1) doc.moveTo(x, yc + 6).lineTo(x, yc + hauteurCase - 6).lineWidth(0.4).strokeColor(teinte(s.accent, 0.35)).stroke();
        }
        const px = x + (s.modele === 'moderne' ? 14 : (col === 1 ? 14 : 4));
        doc.font('Helvetica-Bold').fontSize(6.4).fillColor(s.modele === 'moderne' ? s.accent : C.COULEUR_TEXTE_CLAIR)
          .text(libelle.toUpperCase(), px, yc + 8, { width: l - 24, characterSpacing: 0.7, lineBreak: false });
        const police = mono ? 'Courier-Bold' : (s.modele === 'moderne' ? 'Helvetica-Bold' : 'Times-Bold');
        let taille = s.modele === 'moderne' ? 10.5 : 12;
        while (taille > 7.5 && doc.font(police).fontSize(taille).widthOfString(String(valeur)) > l - 28) taille -= 0.5;
        doc.font(police).fontSize(taille).fillColor(C.COULEUR_TEXTE).text(String(valeur), px, yc + 19, { width: l - 24, lineBreak: false, ellipsis: true });
      });
    },
  };
}

function blocSignature(doc, s, zone, etablissement, signataire, certification) {
  const { gauche, droite } = zone;
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
  const serif = s.modele !== 'moderne';
  return {
    hauteur: 88,
    dessiner(y) {
      doc.font(serif ? 'Times-Roman' : 'Helvetica').fontSize(serif ? 11 : 9.5).fillColor(C.COULEUR_TEXTE)
        .text(`Fait à ${etablissement.ville || 'Libreville'}, le ${dateDuJour}`, gauche, y, { lineBreak: false });
      if (certification) sceauVerification(doc, gauche, y + 22, certification, { taille: 60, largeurTexte: 160 });
      const l = 200;
      const x = droite - l;
      doc.font(serif ? 'Times-Bold' : 'Helvetica-Bold').fontSize(serif ? 11.5 : 9.5).fillColor(s.accent).text(signataire, x, y, { width: l, align: 'center' });
      doc.moveTo(x + 20, y + 72).lineTo(droite - 20, y + 72).lineWidth(0.6).strokeColor(C.COULEUR_TEXTE).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(C.COULEUR_TEXTE_CLAIR).text('Signature et cachet', x, y + 77, { width: l, align: 'center' });
    },
  };
}

// Répartit les blocs dans la zone utile : les écarts s'élargissent avec la
// place disponible (dans une limite), le reste est partagé haut et bas avec
// un léger avantage au haut pour un centrage optique.
function repartir(blocs, zone, ecartsBase) {
  const hauteurs = blocs.reduce((a, b) => a + b.hauteur, 0);
  const disponible = zone.bas - zone.haut;
  const somme = ecartsBase.reduce((a, b) => a + b, 0);
  if (hauteurs + somme > disponible) {
    const facteur = Math.max(0.25, (disponible - hauteurs) / somme);
    ecartsBase = ecartsBase.map((e) => e * facteur);
  }
  const total = hauteurs + ecartsBase.reduce((a, b) => a + b, 0);
  let libre = Math.max(0, disponible - total);
  const bonus = Math.min(libre * 0.55 / ecartsBase.length, 34);
  libre -= bonus * ecartsBase.length;
  let y = zone.haut + libre * 0.42;
  blocs.forEach((b, i) => {
    b.dessiner(y);
    y += b.hauteur + (i < ecartsBase.length ? ecartsBase[i] + bonus : 0);
  });
}

function dessinerAttestation(doc, { etablissement, style, certification, titre, complement, reference, corps, formule, paires, signataire }) {
  const zone = DECORS[style.modele](doc, etablissement, style, certification);
  const blocs = [
    blocTitre(doc, style, zone, { titre, complement, reference }),
    blocCorps(doc, style, zone, corps),
    blocIdentite(doc, style, zone, paires),
    blocTexte(doc, style, zone, formule, { italique: true, centre: true }),
    blocSignature(doc, style, zone, etablissement, signataire, certification),
  ];
  repartir(blocs, zone, [24, 22, 18, 26]);
}

module.exports = { MODELES_DOCUMENTS, COULEURS_DOCUMENTS, COULEUR_PAR_DEFAUT, validerStyleDocuments, styleDe, dessinerAttestation };
