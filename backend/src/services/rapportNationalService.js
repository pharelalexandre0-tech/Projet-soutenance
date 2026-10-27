const { outils } = require('./pdfService');
const { outilsTableaux } = require('./documentsAcademieService');

// Rapport national du Ministère de l'Enseignement supérieur : synthèse,
// établissements (agrément, effectifs, réussite, assiduité, risques),
// provinces et niveaux. Document certifié (QR code et code de vérification)
// comme tous les documents officiels d'EduSphere.
const { enTeteOfficiel, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, certifier } = outils;
const C = outils.couleurs;
const { nouveauPDF, tableau, finaliser, limiteBas } = outilsTableaux;

const MINISTERE = {
  nom: "Ministère de l'Enseignement supérieur",
  sigle: 'MESR',
  devise: 'Union · Travail · Justice',
  ville: 'Libreville',
  pays: 'République Gabonaise',
};

const pct = (v) => (v == null ? '-' : `${String(v).replace('.', ',')} %`);
const entier = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function titreSection(doc, y, texte) {
  if (y + 60 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
  doc.font('Times-Bold').fontSize(12).fillColor(C.COULEUR_MARINE).text(texte, doc.page.margins.left, y);
  const yy = doc.y + 3;
  doc.moveTo(doc.page.margins.left, yy).lineTo(doc.page.width - doc.page.margins.right, yy).lineWidth(0.8).strokeColor(C.COULEUR_MARINE).stroke();
  return yy + 8;
}

async function rapportNationalPDF(donnees, agent) {
  const { totaux, parProvince, parNiveau, etablissements } = donnees;
  const dateRapport = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
  const certification = await certifier({
    cle: `rapport_national_${new Date().toISOString().slice(0, 10)}`,
    type: 'rapport_national',
    etablissement: null,
    titre: `Rapport national de l'enseignement supérieur, ${dateRapport}`,
    elements: [
      ['Établissements', String(totaux.etablissements)], ['Établissements agréés', String(totaux.agrees)],
      ['Étudiants inscrits', entier(totaux.effectif)], ['Taux de réussite national', pct(totaux.tauxReussite)],
      ['Moyenne nationale', totaux.moyenne == null ? null : `${noteFr(totaux.moyenne)} / 20`],
      ['Étudiants à risque élevé de décrochage', String(totaux.risqueEleve)],
    ],
    donnees: etablissements.map((e) => [e.id, e.effectif, e.evalues, e.admis, e.agrementStatut, e.risqueEleve]),
    emisParId: agent?.id ?? null,
  });

  const { doc, termine } = nouveauPDF({ layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, MINISTERE, {
    surtitre: 'RÉPUBLIQUE GABONAISE', titre: 'RAPPORT NATIONAL', sousTitre: 'Enseignement supérieur', reference: `Établi le ${dateRapport}`, largeurTitre: 260, certification,
  });

  y = blocIdentite(doc, marge, y, largeur, [
    ['Établissements', `${totaux.etablissements} dont ${totaux.agrees} agréés`, 1.4], ['Étudiants', entier(totaux.effectif)],
    ['Enseignants', entier(totaux.enseignants)], ['Taux de réussite', pct(totaux.tauxReussite)],
    ['Moyenne nationale', totaux.moyenne == null ? '-' : `${noteFr(totaux.moyenne)} / 20`, 1.2], ['À risque élevé', String(totaux.risqueEleve)],
  ]) + 16;

  y = titreSection(doc, y, 'Établissements sous tutelle');
  const larg = [190, 82, 92, 96, 52, 52, 60, 52, 62, 52];
  const ratio = largeur / larg.reduce((a, b) => a + b, 0);
  const colonnes = larg.map((l) => l * ratio);
  y = tableau(doc, marge, y, colonnes,
    ['Établissement', 'Province', 'Type', 'Agrément', 'Effectif', 'Évalués', 'Réussite', 'Moyenne', 'Abs. non just.', 'À risque'],
    etablissements.map((e) => [
      { texte: e.nom, gras: true },
      { texte: e.province || 'Non renseignée' },
      { texte: e.libelleType || '' },
      { texte: e.libelleAgrement || '', couleur: e.agrementStatut === 'agree' ? C.COULEUR_SUCCES : ['suspendu', 'retire'].includes(e.agrementStatut) ? C.COULEUR_ERREUR : C.COULEUR_RATTRAPAGE, gras: true },
      { texte: entier(e.effectif), align: 'right' },
      { texte: entier(e.evalues), align: 'right' },
      { texte: pct(e.tauxReussite), align: 'right', gras: true },
      { texte: e.moyenne == null ? '-' : noteFr(e.moyenne), align: 'right' },
      { texte: entier(e.absencesNonJustifiees), align: 'right' },
      { texte: entier(e.risqueEleve), align: 'right', couleur: e.risqueEleve ? C.COULEUR_ERREUR : C.COULEUR_TEXTE },
    ]), { hauteur: 19, taille: 7.6 }) + 18;

  y = titreSection(doc, y, 'Répartition par province');
  const lp = [200, 110, 110, 110, 110, 110].map((l) => (l * largeur) / 750);
  y = tableau(doc, marge, y, lp, ['Province', 'Établissements', 'Étudiants', 'Évalués', 'Taux de réussite', 'Risque élevé'],
    parProvince.map((p) => [
      { texte: p.libelle, gras: true }, { texte: String(p.etablissements), align: 'right' }, { texte: entier(p.effectif), align: 'right' },
      { texte: entier(p.evalues), align: 'right' }, { texte: pct(p.tauxReussite), align: 'right', gras: true }, { texte: entier(p.risqueEleve), align: 'right' },
    ]), { hauteur: 19, taille: 7.8 }) + 18;

  y = titreSection(doc, y, 'Résultats par niveau');
  const ln = [200, 140, 140, 140, 130].map((l) => (l * largeur) / 750);
  y = tableau(doc, marge, y, ln, ['Niveau', 'Étudiants évalués', 'Admis', 'Taux de réussite', 'Moyenne'],
    parNiveau.map((n) => [
      { texte: n.niveau, gras: true }, { texte: entier(n.evalues), align: 'right' }, { texte: entier(n.admis), align: 'right' },
      { texte: pct(n.tauxReussite), align: 'right', gras: true }, { texte: n.moyenne == null ? '-' : noteFr(n.moyenne), align: 'right' },
    ]), { hauteur: 19, taille: 7.8, reserveFin: 110 }) + 14;

  doc.font('Helvetica').fontSize(7.2).fillColor(C.COULEUR_TEXTE_CLAIR)
    .text("Données agrégées par établissement, sans aucune information nominative. Réussite : étudiants dont la moyenne pondérée des notes finales ((CC + examen) / 2) atteint le seuil de validation de leur établissement.", marge, y, { width: largeur });
  blocSignature(doc, doc.y + 10, MINISTERE, 'Le Directeur général de l’Enseignement supérieur', certification);
  piedDePageOfficiel(doc, `Rapport national établi par le ${MINISTERE.nom} via EduSphere  ·  ${dateRapport}`, certification);
  return finaliser(doc, termine, certification);
}

module.exports = { rapportNationalPDF, MINISTERE, titreSection, pct, entier };
