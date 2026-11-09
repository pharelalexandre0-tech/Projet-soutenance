const { outils } = require('./pdfService');
const { outilsTableaux } = require('./documentsAcademieService');

// Documents certifiés des modules LMD : diplôme, supplément au diplôme,
// procès-verbal de soutenance. Même présentation et même vérification par
// QR code que les autres documents officiels.
const { enTeteOfficiel, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, certifier, dessinerLigne } = outils;
const C = outils.couleurs;
const { nouveauPDF, tableau, finaliser, limiteBas } = outilsTableaux;

const nomComplet = (e) => `${String(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim();
const dateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
const GRADES = { licence: 'LICENCE', master: 'MASTER', doctorat: 'DOCTORAT' };
const TYPES_MEMOIRE = { rapport_stage: 'Rapport de stage', memoire_licence: 'Mémoire de licence', memoire_master: 'Mémoire de master', these: 'Thèse de doctorat' };

async function diplomePDF({ etablissement, eleve, diplome, emisParId }) {
  const grade = GRADES[diplome.cycle] || String(diplome.cycle).toUpperCase();
  const specialite = diplome.specialite || '';
  const elements = [
    ['Numéro', diplome.numero], ['Grade', grade], ['Domaine', diplome.domaine], ['Spécialité', specialite],
    ['Matricule', eleve.matricule], ['Mention', diplome.mentionObtenue], ['Crédits', String(diplome.creditsAcquis)], ['Délivré le', dateFr(diplome.dateDelivrance)],
  ];
  const certification = await certifier({ cle: `diplome_${diplome.numero}`, type: 'diplome', etablissement, titre: `Diplôme de ${grade.charAt(0)}${grade.slice(1).toLowerCase()}`, titulaire: nomComplet(eleve), elements, emisParId });
  const { doc, termine } = nouveauPDF({ margin: 56, layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  doc.rect(28, 28, doc.page.width - 56, doc.page.height - 56).lineWidth(2).strokeColor(C.COULEUR_MARINE).stroke();
  doc.rect(34, 34, doc.page.width - 68, doc.page.height - 68).lineWidth(0.6).strokeColor('#B8860B').stroke();
  let y = enTeteOfficiel(doc, etablissement, { surtitre: `ANNÉE UNIVERSITAIRE ${diplome.anneeObtention || ''}`.trim(), titre: `DIPLÔME DE ${grade}`, reference: `N° ${diplome.numero}`, largeurTitre: 300, certification });
  y += 24;
  const naissance = eleve.dateNaissance ? `, né(e) le ${dateFr(`${eleve.dateNaissance}T12:00:00`)}` : '';
  doc.font('Times-Roman').fontSize(13).fillColor(C.COULEUR_TEXTE).text(`Vu les résultats obtenus et la validation des ${diplome.creditsAcquis} crédits du cycle, le diplôme de`, marge, y, { width: largeur, align: 'center' });
  y = doc.y + 10;
  doc.font('Times-Bold').fontSize(26).fillColor(C.COULEUR_MARINE).text(grade, marge, y, { width: largeur, align: 'center' });
  y = doc.y + 4;
  if (diplome.domaine || specialite) doc.font('Times-Italic').fontSize(14).fillColor(C.COULEUR_TEXTE).text([diplome.domaine && `Domaine : ${diplome.domaine}`, specialite && `Mention : ${specialite}`].filter(Boolean).join('  ·  '), marge, doc.y + 4, { width: largeur, align: 'center' });
  y = doc.y + 14;
  doc.font('Times-Roman').fontSize(13).fillColor(C.COULEUR_TEXTE).text('est décerné à', marge, y, { width: largeur, align: 'center' });
  doc.font('Times-Bold').fontSize(20).fillColor(C.COULEUR_TEXTE).text(`${eleve.prenom} ${String(eleve.nom).toUpperCase()}`, marge, doc.y + 6, { width: largeur, align: 'center' });
  doc.font('Times-Roman').fontSize(12).text(`matricule ${eleve.matricule || 'non attribué'}${naissance}`, marge, doc.y + 4, { width: largeur, align: 'center' });
  doc.font('Times-Roman').fontSize(13).text(`avec la mention ${diplome.mentionObtenue || 'Passable'}${diplome.moyenne != null ? ` (moyenne ${noteFr(diplome.moyenne)}/20)` : ''}, au titre de l'année universitaire ${diplome.anneeObtention || ''}.`, marge, doc.y + 12, { width: largeur, align: 'center' });
  y = Math.min(doc.y + 26, doc.page.height - 170);
  blocSignature(doc, y, etablissement, 'Le Directeur de l’établissement', certification);
  piedDePageOfficiel(doc, `Diplôme délivré par ${etablissement.nom} via EduSphere  ·  vérifiable en ligne`, certification);
  return finaliser(doc, termine, certification);
}

// Supplément au diplôme : tout le parcours, UE par UE, avec les crédits.
async function supplementPDF({ etablissement, eleve, diplome, parcours, emisParId }) {
  const elements = [['Diplôme', diplome.numero], ['Grade', GRADES[diplome.cycle]], ['Crédits', `${diplome.creditsAcquis} / ${parcours.creditsRequis}`], ['Mention', diplome.mentionObtenue]];
  const certification = await certifier({ cle: `supplement_${diplome.numero}`, type: 'supplement_diplome', etablissement, titre: 'Supplément au diplôme', titulaire: nomComplet(eleve), elements, emisParId });
  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, etablissement, { surtitre: 'DIPLÔME N° '.concat(diplome.numero), titre: 'SUPPLÉMENT AU DIPLÔME', sousTitre: 'Description du parcours', reference: `Édité le ${dateFr(new Date())}`, largeurTitre: 240, certification });
  y = blocIdentite(doc, marge, y, largeur, [['Titulaire', nomComplet(eleve), 1.6], ['Matricule', eleve.matricule || '', 1, true], ['Grade', GRADES[diplome.cycle]], ['Mention', diplome.mentionObtenue || '']]) + 10;
  doc.font('Helvetica').fontSize(8.5).fillColor(C.COULEUR_TEXTE).text(`Le titulaire a validé ${diplome.creditsAcquis} crédits ECTS du cycle ${GRADES[diplome.cycle].toLowerCase()} (${parcours.creditsRequis} requis) dans le système Licence-Master-Doctorat. Chaque semestre représente 30 crédits ; une unité d’enseignement (UE) est acquise lorsque sa moyenne atteint le seuil fixé par l’établissement, sans note éliminatoire.`, marge, y, { width: largeur, lineGap: 2 });
  y = doc.y + 10;
  const colonnes = [70, 230, 44, 50, 96].map((l) => (l * largeur) / 490);
  for (const s of parcours.semestres) {
    if (y + 70 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
    doc.font('Times-Bold').fontSize(11).fillColor(C.COULEUR_MARINE).text(`${s.libelle} ${s.anneeScolaire}`, marge, y);
    y = doc.y + 3;
    y = tableau(doc, marge, y, colonnes, ['Code', 'Unité d’enseignement', 'Crédits', 'Note', 'Résultat'],
      s.ues.map((u) => [{ texte: u.code || '' }, { texte: u.intitule }, { texte: String(u.credits), align: 'right' }, { texte: noteFr(u.moyenne), align: 'right' }, { texte: u.libelle, couleur: u.acquise ? C.COULEUR_SUCCES : C.COULEUR_TEXTE_CLAIR }]),
      { hauteur: 16, taille: 7.6 }) + 8;
  }
  if (parcours.transferts?.length) {
    if (y + 70 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
    doc.font('Times-Bold').fontSize(11).fillColor(C.COULEUR_MARINE).text('Crédits obtenus dans un autre établissement', marge, y);
    y = doc.y + 3;
    y = tableau(doc, marge, y, colonnes, ['Code', 'UE et établissement d’origine', 'Crédits', 'Note', 'Résultat'],
      parcours.transferts.map((t) => [{ texte: t.code || '' }, { texte: `${t.intitule} (${t.etablissementOrigine})` }, { texte: String(t.credits), align: 'right' }, { texte: noteFr(t.note), align: 'right' }, { texte: 'Transféré', couleur: C.COULEUR_SUCCES }]),
      { hauteur: 16, taille: 7.6 }) + 8;
  }
  if (y + 100 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
  blocSignature(doc, y + 6, etablissement, 'Le Directeur des études', certification);
  piedDePageOfficiel(doc, `Supplément au diplôme ${diplome.numero}  ·  ${etablissement.nom} via EduSphere`, certification);
  return finaliser(doc, termine, certification);
}

async function pvSoutenancePDF({ etablissement, eleve, memoire, emisParId }) {
  const type = TYPES_MEMOIRE[memoire.type] || 'Mémoire';
  const elements = [['Type', type], ['Sujet', memoire.sujet], ['Date', memoire.dateSoutenance ? dateFr(memoire.dateSoutenance) : ''], ['Note', memoire.note != null ? `${noteFr(memoire.note)} / 20` : ''], ['Mention', memoire.mention], ['Décision', memoire.statut === 'soutenu' ? 'Admis(e)' : 'Ajourné(e) à une nouvelle soutenance']];
  const certification = await certifier({ cle: `soutenance_${memoire.id}`, type: 'pv_soutenance', etablissement, titre: `Procès-verbal de soutenance : ${type}`, titulaire: nomComplet(eleve), elements, emisParId });
  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, etablissement, { surtitre: type.toUpperCase(), titre: 'PROCÈS-VERBAL DE SOUTENANCE', reference: memoire.dateSoutenance ? `Séance du ${dateFr(memoire.dateSoutenance)}` : '', largeurTitre: 260, certification });
  y = blocIdentite(doc, marge, y, largeur, [['Candidat(e)', nomComplet(eleve), 1.6], ['Matricule', eleve.matricule || '', 1, true], ['Lieu', memoire.lieu || '']]) + 12;
  doc.font('Times-Bold').fontSize(11).fillColor(C.COULEUR_MARINE).text('Sujet', marge, y);
  doc.font('Times-Roman').fontSize(11).fillColor(C.COULEUR_TEXTE).text(memoire.sujet, marge, doc.y + 2, { width: largeur });
  doc.font('Helvetica').fontSize(8.5).fillColor(C.COULEUR_TEXTE_CLAIR).text([memoire.encadrant && `Encadrant : ${memoire.encadrant}`, memoire.coEncadrant && `Co-encadrant : ${memoire.coEncadrant}`].filter(Boolean).join('  ·  '), marge, doc.y + 4, { width: largeur });
  y = doc.y + 12;
  const colonnes = [largeur * 0.6, largeur * 0.4];
  y = tableau(doc, marge, y, colonnes, ['Membre du jury', 'Qualité'], (memoire.jury || []).map((j) => [{ texte: j.nom }, { texte: j.qualite }]), { hauteur: 18, taille: 8.5 }) + 12;
  y = dessinerLigne(doc, marge, y, [largeur / 3, largeur / 3, largeur / 3], [
    { texte: `Note : ${memoire.note != null ? `${noteFr(memoire.note)} / 20` : '-'}`, gras: true },
    { texte: `Mention : ${memoire.mention || '-'}`, gras: true },
    { texte: memoire.statut === 'soutenu' ? 'Admis(e)' : 'Ajourné(e)', gras: true, couleur: memoire.statut === 'soutenu' ? C.COULEUR_SUCCES : C.COULEUR_RATTRAPAGE },
  ], { hauteur: 22, fond: '#EEF3FA' }) + 14;
  if (memoire.observations) {
    doc.font('Times-Italic').fontSize(10.5).fillColor(C.COULEUR_TEXTE).text(`Observations du jury : ${memoire.observations}`, marge, y, { width: largeur });
    y = doc.y + 12;
  }
  blocSignature(doc, y, etablissement, 'Le Président du jury', certification);
  piedDePageOfficiel(doc, `Procès-verbal de soutenance établi par ${etablissement.nom} via EduSphere`, certification);
  return finaliser(doc, termine, certification);
}

module.exports = { diplomePDF, supplementPDF, pvSoutenancePDF, TYPES_MEMOIRE, GRADES };
