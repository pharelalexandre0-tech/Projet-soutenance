const { outils } = require('./pdfService');
const { outilsTableaux } = require('./documentsAcademieService');
const { LIBELLES_DECISION } = require('./deliberationService');

// Documents officiels certifiés (QR code, code de vérification) :
//   - procès-verbal de délibération du jury ;
//   - attestations (scolarité, inscription, réussite) ;
//   - relevé de notes officiel (tous les semestres de l'étudiant).
const { enTeteOfficiel, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, mention, certifier, dessinerLigne } = outils;
const C = outils.couleurs;
const { nouveauPDF, tableau, finaliser, limiteBas } = outilsTableaux;
const { dessinerAttestation, styleDe } = require('./modelesAttestation');

const nomComplet = (e) => `${String(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim();
const dateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });

// ---------------------------------------------------------------------------
// Procès-verbal de délibération
// ---------------------------------------------------------------------------
async function pvDeliberationPDF({ etablissement, classe, semestre, deliberation, lignes, emisParId }) {
  const admis = lignes.filter((l) => l.decision !== 'rattrapage' && l.evalue).length;
  const parJury = lignes.filter((l) => l.decision === 'admis_jury').length;
  const evalues = lignes.filter((l) => l.evalue).length;
  const certification = await certifier({
    cle: `pv_deliberation_${classe.id}_${semestre.id}`,
    type: 'pv_deliberation',
    etablissement,
    titre: `Procès-verbal de délibération, ${classe.nom} (${classe.niveau}), ${semestre.libelle} ${semestre.anneeScolaire || ''}`.trim(),
    elements: [
      ['Séance du', deliberation.dateSeance ? dateFr(deliberation.dateSeance) : null], ['Président du jury', deliberation.president],
      ['Étudiants évalués', String(evalues)], ['Admis', String(admis)], ['Dont par décision du jury', String(parJury)],
      ['Rattrapage', String(evalues - admis)], ['Statut', deliberation.statut === 'close' ? `Close le ${dateFr(deliberation.closeLe)}` : 'Séance ouverte'],
    ],
    donnees: lignes.map((l) => [l.eleveId, l.moyenne, l.decision, l.motif || null]),
    emisParId,
  });

  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, etablissement, {
    surtitre: `ANNÉE ${semestre.anneeScolaire || ''}`.trim(), titre: 'PROCÈS-VERBAL DE DÉLIBÉRATION', sousTitre: `${classe.nom} (${classe.niveau}), ${semestre.libelle}`,
    reference: deliberation.statut === 'close' ? `Séance close le ${dateFr(deliberation.closeLe)}` : 'Séance en cours', largeurTitre: 250, certification,
  });
  y = blocIdentite(doc, marge, y, largeur, [
    ['Séance du', deliberation.dateSeance ? dateFr(deliberation.dateSeance) : 'Non renseignée', 1.2],
    ['Président du jury', deliberation.president || 'Non renseigné', 1.6],
    ['Évalués', String(evalues)], ['Admis', String(admis)], ['Rattrapage', String(evalues - admis)],
  ]) + 10;
  if (deliberation.membres) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.COULEUR_TEXTE).text('Membres du jury : ', marge, y, { continued: true })
      .font('Helvetica').fillColor(C.COULEUR_TEXTE_CLAIR).text(deliberation.membres, { width: largeur });
    y = doc.y + 10;
  }
  const larg = [24, 74, 140, 46, 42, 70, 92];
  const ratio = largeur / larg.reduce((a, b) => a + b, 0);
  y = tableau(doc, marge, y, larg.map((l) => l * ratio), ['N°', 'Matricule', 'Nom et prénom', 'Moyenne', 'Crédits', 'Calculée', 'Décision du jury'],
    lignes.map((l, i) => [
      { texte: String(i + 1), align: 'center', couleur: C.COULEUR_TEXTE_CLAIR },
      { texte: l.matricule || '' },
      { texte: nomComplet(l), gras: true },
      { texte: l.evalue ? noteFr(l.moyenne) : '-', align: 'right' },
      { texte: l.evalue ? `${l.creditsValides}/${l.creditsTotal}` : '-', align: 'center' },
      { texte: l.evalue ? (l.decisionCalculee === 'admis' ? 'Admis(e)' : 'Rattrapage') : 'Non évalué', couleur: C.COULEUR_TEXTE_CLAIR },
      { texte: l.evalue ? (l.decision === 'admis_jury' ? 'Admis (jury)' : LIBELLES_DECISION[l.decision]) : 'Non évalué', gras: true, couleur: l.decision === 'rattrapage' ? C.COULEUR_RATTRAPAGE : C.COULEUR_SUCCES },
    ]), { hauteur: 19, taille: 7.8, reserveFin: 150 });
  const motifs = lignes.filter((l) => l.decision === 'admis_jury' && l.motif);
  if (motifs.length) {
    y += 10;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.COULEUR_TEXTE).text('Décisions du jury motivées :', marge, y);
    motifs.forEach((l) => doc.font('Helvetica').fontSize(7.8).fillColor(C.COULEUR_TEXTE).text(`${nomComplet(l)} : ${l.motif}`, marge + 8, doc.y + 2, { width: largeur - 8 }));
    y = doc.y;
  }
  if (deliberation.observations) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.COULEUR_TEXTE).text('Observations : ', marge, y + 8, { continued: true })
      .font('Helvetica').text(deliberation.observations, { width: largeur });
    y = doc.y;
  }
  if (y + 100 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
  blocSignature(doc, y + 14, etablissement, 'Le Président du jury', certification);
  piedDePageOfficiel(doc, `Procès-verbal de délibération établi par ${etablissement.nom} via EduSphere  ·  ${classe.nom}, ${semestre.libelle}`, certification);
  return finaliser(doc, termine, certification);
}

// ---------------------------------------------------------------------------
// Attestations
// ---------------------------------------------------------------------------
const TITRES_ATTESTATION = { scolarite: 'ATTESTATION DE SCOLARITÉ', inscription: "ATTESTATION D'INSCRIPTION", reussite: 'ATTESTATION DE RÉUSSITE' };

async function attestationPDF({ etablissement, eleve, classe, type, semestre, resultat, anneeScolaire, emisParId, apercu = null }) {
  const nom = nomComplet(eleve);
  const naissance = eleve.dateNaissance ? dateFr(`${eleve.dateNaissance}T12:00:00`) : null;
  const elements = [['Matricule', eleve.matricule], ['Né(e) le', naissance], ['Classe', `${classe.nom} (${classe.niveau})`], ['Année universitaire', anneeScolaire]];
  if (type === 'reussite') {
    elements.push(['Semestre', semestre.libelle], ['Moyenne', `${noteFr(resultat.moyenneGenerale)} / 20`], ['Mention', mention(resultat.moyenneGenerale)],
      ['Crédits', `${resultat.creditsValides} / ${resultat.creditsTotal}`], ['Décision', LIBELLES_DECISION[resultat.decisionJury || 'admis']]);
  }
  // Aperçu (Paramètres) : aucun document n'est certifié ni enregistré.
  const certification = apercu ? { code: 'APERCU-0000-0000' } : await certifier({
    cle: `attestation_${type}_${eleve.id}_${type === 'reussite' ? semestre.id : anneeScolaire}`,
    type: 'attestation',
    etablissement,
    titre: `${TITRES_ATTESTATION[type].charAt(0)}${TITRES_ATTESTATION[type].slice(1).toLowerCase()}`,
    titulaire: nom,
    elements,
    emisParId,
  });

  const { doc, termine } = nouveauPDF({ margin: 56 });
  const signataire = 'Le Directeur des études';
  const titulaire = `${eleve.prenom} ${String(eleve.nom).toUpperCase()}`;
  const annee = anneeScolaire || 'en cours';
  const ne = naissance ? `né(e) le ${naissance}, ` : '';
  const dateInscription = eleve.createdAt ? dateFr(eleve.createdAt) : null;
  const suites = {
    scolarite: `${ne}est régulièrement inscrit(e) dans l'établissement et suit les enseignements de la classe ${classe.nom} (${classe.niveau}) au titre de l'année universitaire ${annee}.`,
    inscription: `${ne}est inscrit(e) dans l'établissement au titre de l'année universitaire ${annee}, en ${classe.niveau}, classe ${classe.nom}${dateInscription ? `. Son inscription a été enregistrée le ${dateInscription}` : ''}.`,
    reussite: type === 'reussite' ? `inscrit(e) en ${classe.niveau} (${classe.nom}), a validé le ${semestre.libelle} de l'année universitaire ${annee}${resultat.decisionJury === 'admis_jury' ? ' par décision du jury' : ''}, avec les résultats suivants.` : '',
  };
  // L'attestation de réussite se concentre sur les résultats.
  const paires = [['Nom et prénoms', nom], ['Matricule', eleve.matricule || 'non attribué', true]];
  if (naissance && type !== 'reussite') paires.push(['Date de naissance', naissance]);
  if (type === 'inscription') {
    paires.push(['Niveau d’études', classe.niveau], ['Classe', classe.nom], ['Année universitaire', annee]);
    if (dateInscription) paires.push(['Inscrit(e) le', dateInscription]);
  } else {
    paires.push(['Classe', `${classe.nom} (${classe.niveau})`]);
    if (type !== 'reussite') paires.push(['Année universitaire', annee]);
  }
  if (type === 'reussite') {
    paires.push(['Semestre', semestre.libelle], ['Moyenne', `${noteFr(resultat.moyenneGenerale)} / 20`], ['Mention', mention(resultat.moyenneGenerale)],
      ['Crédits ECTS', `${resultat.creditsValides} / ${resultat.creditsTotal}`], ['Décision', LIBELLES_DECISION[resultat.decisionJury || 'admis']]);
  }
  const COMPLEMENTS = { scolarite: 'de scolarité', inscription: "d'inscription", reussite: 'de réussite' };
  dessinerAttestation(doc, {
    etablissement,
    style: styleDe(etablissement, apercu || {}),
    certification,
    titre: TITRES_ATTESTATION[type],
    complement: COMPLEMENTS[type],
    reference: `Année universitaire ${annee}  ·  N° ${certification.code}`,
    corps: { introduction: `${signataire} de l'établissement ${etablissement.nom} atteste que`, titulaire, suite: suites[type] },
    formule: 'En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.',
    paires,
    signataire,
    annee,
  });
  piedDePageOfficiel(doc, `${apercu ? 'APERÇU SANS VALEUR  ·  ' : ''}Attestation délivrée par ${etablissement.nom} via EduSphere  ·  vérifiable en ligne`, certification);
  return finaliser(doc, termine, apercu ? null : certification);
}

// ---------------------------------------------------------------------------
// Relevé de notes officiel
// ---------------------------------------------------------------------------
async function relevePDF({ etablissement, eleve, classe, semestres, cumul, emisParId }) {
  // semestres : [{ semestre, calcul }] dans l'ordre.
  const evalues = semestres.filter((s) => s.calcul.detailParUE.length);
  const certification = await certifier({
    cle: `releve_${eleve.id}`,
    type: 'releve',
    etablissement,
    titre: 'Relevé de notes officiel',
    titulaire: nomComplet(eleve),
    elements: [
      ['Matricule', eleve.matricule], ['Classe', classe ? `${classe.nom} (${classe.niveau})` : null],
      ...evalues.map(({ semestre, calcul }) => [`${semestre.libelle} ${semestre.anneeScolaire || ''}`.trim(),
        `${noteFr(calcul.moyenneGenerale)} / 20, ${calcul.creditsValides}/${calcul.creditsTotal} crédits, ${LIBELLES_DECISION[calcul.decisionJury || (calcul.admis ? 'admis' : 'rattrapage')]}`]),
    ],
    donnees: evalues.map(({ semestre, calcul }) => [semestre.id, calcul.detailParUE.map((u) => [u.code, u.moyenne, u.matieres.map((m) => [m.code, m.noteFinale])])]),
    emisParId,
  });

  const { doc, termine } = nouveauPDF();
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = enTeteOfficiel(doc, etablissement, { surtitre: 'SCOLARITÉ', titre: 'RELEVÉ DE NOTES', sousTitre: 'Document officiel', reference: `Édité le ${dateFr(new Date())}`, largeurTitre: 220, certification });
  y = blocIdentite(doc, marge, y, largeur, [
    ['Nom et prénom', nomComplet(eleve), 1.6], ['Matricule', eleve.matricule || 'Non attribué', 1, true],
    ['Classe', classe ? classe.nom : 'Non renseignée'], ['Niveau', classe?.niveau || ''],
  ]) + 14;
  const larg = [70, 190, 34, 42, 42, 46, 74];
  const colonnes = larg.map((l) => (l * largeur) / larg.reduce((a, b) => a + b, 0));
  if (!evalues.length) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.COULEUR_TEXTE_CLAIR).text('Aucune note enregistrée.', marge, y);
    y = doc.y + 10;
  }
  for (const { semestre, calcul } of evalues) {
    if (y + 80 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
    doc.font('Times-Bold').fontSize(11.5).fillColor(C.COULEUR_MARINE).text(`${semestre.libelle} ${semestre.anneeScolaire || ''}`, marge, y);
    y = doc.y + 4;
    const lignes = [];
    for (const u of calcul.detailParUE) {
      lignes.push([{ texte: u.code || '', gras: true, couleur: C.COULEUR_MARINE }, { texte: `${u.ue} (${u.credits} cr.)`, gras: true, couleur: C.COULEUR_MARINE }, { texte: '' }, { texte: '' }, { texte: '' },
        { texte: noteFr(u.moyenne), align: 'right', gras: true }, { texte: require('./moyenneService').libelleEtatUE(u, true), gras: true, couleur: u.acquise ? C.COULEUR_SUCCES : C.COULEUR_ERREUR }]);
      for (const m of u.matieres) {
        lignes.push([{ texte: m.code || '', couleur: C.COULEUR_TEXTE_CLAIR }, { texte: `   ${m.matiere}` }, { texte: String(m.coefficient ?? ''), align: 'right' },
          { texte: noteFr(m.moyenneCC), align: 'right' }, { texte: noteFr(m.moyenneExamen), align: 'right' }, { texte: noteFr(m.noteFinale), align: 'right', gras: true }, { texte: '' }]);
      }
    }
    y = tableau(doc, marge, y, colonnes, ['Code', 'Unité / matière', 'Coef.', 'CC', 'Examen', 'Note', 'Résultat'], lignes, { hauteur: 17, taille: 7.6 });
    y = dessinerLigne(doc, marge, y, [largeur * 0.4, largeur * 0.2, largeur * 0.2, largeur * 0.2], [
      { texte: 'Synthèse du semestre', gras: true },
      { texte: `Moyenne ${noteFr(calcul.moyenneGenerale)}/20`, gras: true },
      { texte: `Crédits ${calcul.creditsValides}/${calcul.creditsTotal}` },
      { texte: LIBELLES_DECISION[calcul.decisionJury || (calcul.admis ? 'admis' : 'rattrapage')], gras: true, couleur: calcul.admis ? C.COULEUR_SUCCES : C.COULEUR_RATTRAPAGE },
    ], { hauteur: 20, fond: '#EEF3FA' }) + 16;
  }
  if (cumul && evalues.length) {
    if (y + 40 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
    y = dessinerLigne(doc, marge, y, [largeur * 0.4, largeur * 0.3, largeur * 0.3], [
      { texte: `Cumul du cycle ${cumul.libelleCycle}`, gras: true },
      { texte: `Crédits acquis ${cumul.creditsAcquis} / ${cumul.creditsRequis}`, gras: true },
      { texte: `Restants ${cumul.creditsRestants}` },
    ], { hauteur: 20, fond: '#EEF3FA' }) + 16;
  }
  if (y + 100 > limiteBas(doc)) { doc.addPage(); y = doc.page.margins.top; }
  blocSignature(doc, y, etablissement, 'Le Directeur des études', certification);
  piedDePageOfficiel(doc, `Relevé de notes établi par ${etablissement.nom} via EduSphere  ·  ${nomComplet(eleve)}  ·  Toute rature annule ce document.`, certification);
  return finaliser(doc, termine, certification);
}

module.exports = { pvDeliberationPDF, attestationPDF, relevePDF, TITRES_ATTESTATION };
