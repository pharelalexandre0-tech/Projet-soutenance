const XLSX = require('xlsx');
const { outils } = require('./pdfService');
const { outilsTableaux } = require('./documentsAcademieService');
const { MINISTERE, titreSection, pct, entier } = require('./rapportNationalService');

// Documents officiels du Ministère de l'Enseignement supérieur, au format
// PDF (certifiés : QR code et code de vérification) et Excel : registre
// national des établissements, classement, annuaire statistique et rapport
// d'inspection. Aucune donnée nominative d'étudiant.
const { enTeteOfficiel, blocIdentite, blocSignature, piedDePageOfficiel, noteFr, certifier } = outils;
const C = outils.couleurs;
const { nouveauPDF, tableau, finaliser } = outilsTableaux;

const dateLongue = (d = new Date()) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });
const dateCourte = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Libreville' }) : '');
const jour = () => new Date().toISOString().slice(0, 10);
const colonnes = (largeur, poids) => {
  const total = poids.reduce((a, b) => a + b, 0);
  return poids.map((p) => (p * largeur) / total);
};
const couleurAgrement = (s) => (s === 'agree' ? C.COULEUR_SUCCES : ['suspendu', 'retire'].includes(s) ? C.COULEUR_ERREUR : C.COULEUR_RATTRAPAGE);

const LIBELLES_CYCLE = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const LIBELLES_HABILITATION = { habilitee: 'Habilitée', en_renouvellement: 'En renouvellement', suspendue: 'Suspendue', retiree: 'Retirée' };
const LIBELLES_NATURE = { pedagogique: 'Pédagogique', administrative: 'Administrative', financiere: 'Financière', conformite: 'Conformité' };
const LIBELLES_AVIS = { favorable: 'Favorable', reserves: 'Favorable avec réserves', defavorable: 'Défavorable' };
const LIBELLES_RECO = { a_faire: 'À mettre en œuvre', en_cours: 'En cours', realisee: 'Réalisée' };

const CRITERES = {
  reussite: { libelle: 'taux de réussite', tri: (a, b) => (b.tauxReussite ?? -1) - (a.tauxReussite ?? -1) || (b.moyenne ?? -1) - (a.moyenne ?? -1) },
  moyenne: { libelle: 'moyenne générale', tri: (a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1) || (b.tauxReussite ?? -1) - (a.tauxReussite ?? -1) },
  effectif: { libelle: 'effectif', tri: (a, b) => b.effectif - a.effectif },
  assiduite: { libelle: 'assiduité', tri: (a, b) => a.absencesParEtudiant - b.absencesParEtudiant || b.effectif - a.effectif },
};

// Rang : les établissements sans étudiant évalué viennent après les autres
// pour les critères de résultats et ne reçoivent pas de rang.
function classer(fiches, critere = 'reussite') {
  const c = CRITERES[critere] || CRITERES.reussite;
  const resultats = ['reussite', 'moyenne'].includes(critere);
  const classes = [...fiches].sort(c.tri);
  let rang = 0;
  return classes.map((f) => {
    const classable = !resultats || f.evalues > 0;
    if (classable) rang += 1;
    return { ...f, rang: classable ? rang : null };
  });
}

function entete(doc, certification, titre, sousTitre) {
  return enTeteOfficiel(doc, MINISTERE, {
    surtitre: 'RÉPUBLIQUE GABONAISE', titre, sousTitre, reference: `Établi le ${dateLongue()}`, largeurTitre: 300, certification,
  });
}

function signerEtFinir(doc, termine, certification, mention, y) {
  blocSignature(doc, y, MINISTERE, 'Le Directeur général de l’Enseignement supérieur', certification);
  piedDePageOfficiel(doc, `${mention} établi par le ${MINISTERE.nom} via EduSphere  ·  ${dateLongue()}`, certification);
  return finaliser(doc, termine, certification);
}

// ---------------------------------------------------------------------------
// Registre national des établissements
// ---------------------------------------------------------------------------
function lignesRegistre(fiches) {
  return fiches.map((f, i) => ({
    'N° d’ordre': i + 1, Établissement: f.nom, Sigle: f.sigle || '', Province: f.province || '', Ville: f.ville || '', Type: f.libelleType || '',
    Agrément: f.libelleAgrement || '', 'N° de l’arrêté': f.agrementNumero || '', 'Agréé le': dateCourte(f.agrementDate), 'Expire le': dateCourte(f.agrementExpiration),
    'Formations habilitées': f.formationsHabilitees || 0, 'Dernière inspection': dateCourte(f.derniereInspection), Étudiants: f.effectif, Enseignants: f.enseignants,
  }));
}

async function registrePDF(fiches, agent) {
  const certification = await certifier({
    cle: `registre_national_${jour()}`, type: 'registre_national', etablissement: null,
    titre: `Registre national des établissements d'enseignement supérieur, ${dateLongue()}`,
    elements: [['Établissements inscrits', String(fiches.length)], ['Établissements agréés', String(fiches.filter((f) => f.agrementStatut === 'agree').length)]],
    donnees: fiches.map((f) => [f.id, f.agrementStatut, f.agrementNumero, f.formationsHabilitees]), emisParId: agent?.id ?? null,
  });
  const { doc, termine } = nouveauPDF({ layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = entete(doc, certification, 'REGISTRE NATIONAL', 'Établissements d’enseignement supérieur');
  y = blocIdentite(doc, marge, y, largeur, [
    ['Établissements inscrits', String(fiches.length)], ['Agréés', String(fiches.filter((f) => f.agrementStatut === 'agree').length)],
    ['Agrément provisoire', String(fiches.filter((f) => f.agrementStatut === 'provisoire').length)], ['En instruction', String(fiches.filter((f) => f.agrementStatut === 'en_instruction').length)],
    ['Suspendus ou retirés', String(fiches.filter((f) => ['suspendu', 'retire'].includes(f.agrementStatut)).length)],
  ]) + 16;
  y = tableau(doc, marge, y, colonnes(largeur, [28, 190, 78, 90, 104, 82, 62, 62, 52, 62]),
    ['N°', 'Établissement', 'Province', 'Type', 'Agrément', 'N° de l’arrêté', 'Agréé le', 'Expire le', 'Formations', 'Inspection'],
    fiches.map((f, i) => [
      { texte: String(i + 1), align: 'center' }, { texte: `${f.nom}${f.sigle ? ` (${f.sigle})` : ''}`, gras: true }, { texte: f.province || 'Non renseignée' },
      { texte: f.libelleType || '' }, { texte: f.libelleAgrement || '', gras: true, couleur: couleurAgrement(f.agrementStatut) },
      { texte: f.agrementNumero || '-' }, { texte: dateCourte(f.agrementDate) || '-' }, { texte: dateCourte(f.agrementExpiration) || '-' },
      { texte: String(f.formationsHabilitees || 0), align: 'right' }, { texte: dateCourte(f.derniereInspection) || '-' },
    ]), { hauteur: 20, taille: 7.6, reserveFin: 110 }) + 14;
  return signerEtFinir(doc, termine, certification, 'Registre', y);
}

// ---------------------------------------------------------------------------
// Classement des établissements
// ---------------------------------------------------------------------------
function lignesClassement(classes) {
  return classes.map((f) => ({
    Rang: f.rang ?? 'Non classé', Établissement: f.nom, Province: f.province || '', Type: f.libelleType || '', Étudiants: f.effectif,
    'Évalués': f.evalues, Admis: f.admis, 'Taux de réussite (%)': f.tauxReussite ?? '', Moyenne: f.moyenne ?? '',
    'Absences non justifiées / étudiant': f.absencesParEtudiant, Retards: f.retards,
  }));
}

async function classementPDF(fiches, critere, agent) {
  const classes = classer(fiches, critere);
  const libelle = (CRITERES[critere] || CRITERES.reussite).libelle;
  const certification = await certifier({
    cle: `classement_national_${critere}_${jour()}`, type: 'classement_national', etablissement: null,
    titre: `Classement des établissements par ${libelle}, ${dateLongue()}`,
    elements: [['Critère', libelle], ['Établissements classés', String(classes.filter((c) => c.rang).length)], ['Premier', classes[0]?.rang ? classes[0].nom : null]],
    donnees: classes.map((c) => [c.id, c.rang, c.tauxReussite, c.moyenne, c.effectif]), emisParId: agent?.id ?? null,
  });
  const { doc, termine } = nouveauPDF({ layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = entete(doc, certification, 'CLASSEMENT', `Établissements par ${libelle}`);
  const evalues = fiches.reduce((s, f) => s + f.evalues, 0);
  const admis = fiches.reduce((s, f) => s + f.admis, 0);
  y = blocIdentite(doc, marge, y, largeur, [
    ['Critère de classement', libelle, 1.4], ['Établissements', String(fiches.length)], ['Étudiants évalués', entier(evalues)],
    ['Taux de réussite national', pct(evalues ? Math.round((admis / evalues) * 1000) / 10 : null), 1.3],
  ]) + 16;
  y = tableau(doc, marge, y, colonnes(largeur, [36, 210, 84, 96, 58, 58, 52, 66, 58, 70, 52]),
    ['Rang', 'Établissement', 'Province', 'Type', 'Étudiants', 'Évalués', 'Admis', 'Réussite', 'Moyenne', 'Abs. / étud.', 'Retards'],
    classes.map((f) => [
      { texte: f.rang ? String(f.rang) : 'NC', align: 'center', gras: true, couleur: f.rang && f.rang <= 3 ? C.COULEUR_MARINE : C.COULEUR_TEXTE },
      { texte: f.nom, gras: true }, { texte: f.province || '' }, { texte: f.libelleType || '' },
      { texte: entier(f.effectif), align: 'right' }, { texte: entier(f.evalues), align: 'right' }, { texte: entier(f.admis), align: 'right' },
      { texte: pct(f.tauxReussite), align: 'right', gras: true }, { texte: f.moyenne == null ? '-' : noteFr(f.moyenne), align: 'right' },
      { texte: String(f.absencesParEtudiant).replace('.', ','), align: 'right' }, { texte: entier(f.retards), align: 'right' },
    ]), { hauteur: 20, taille: 7.8, reserveFin: 120 }) + 12;
  doc.font('Helvetica').fontSize(7.2).fillColor(C.COULEUR_TEXTE_CLAIR).text(
    'NC : non classé (aucun étudiant évalué). Réussite : étudiants dont la moyenne pondérée des notes finales ((CC + examen) / 2) atteint le seuil de validation de leur établissement.',
    marge, y, { width: largeur },
  );
  return signerEtFinir(doc, termine, certification, 'Classement', doc.y + 10);
}

// ---------------------------------------------------------------------------
// Annuaire statistique
// ---------------------------------------------------------------------------
function annuaire(fiches, effectifs, habilitations) {
  const parEtab = new Map();
  for (const e of effectifs) {
    const x = parEtab.get(e.etablissementId) || { F: 0, M: 0, '?': 0 };
    x[e.sexe] = (x[e.sexe] || 0) + e.nombre;
    parEtab.set(e.etablissementId, x);
  }
  const etablissements = fiches.map((f) => {
    const s = parEtab.get(f.id) || { F: 0, M: 0, '?': 0 };
    const total = s.F + s.M + s['?'];
    return {
      id: f.id, nom: f.nom, province: f.province || 'Non renseignée', type: f.libelleType || '', total, femmes: s.F, hommes: s.M, nonRenseigne: s['?'],
      partFemmes: s.F + s.M ? Math.round((s.F / (s.F + s.M)) * 1000) / 10 : null, enseignants: f.enseignants,
      ratio: f.enseignants ? Math.round((total / f.enseignants) * 10) / 10 : null, tauxReussite: f.tauxReussite,
    };
  });
  const regrouper = (cle) => {
    const g = new Map();
    for (const e of etablissements) {
      const k = e[cle];
      const x = g.get(k) || { libelle: k, etablissements: 0, total: 0, femmes: 0, hommes: 0, enseignants: 0 };
      x.etablissements += 1; x.total += e.total; x.femmes += e.femmes; x.hommes += e.hommes; x.enseignants += e.enseignants;
      g.set(k, x);
    }
    return [...g.values()].sort((a, b) => b.total - a.total);
  };
  const niveaux = new Map();
  for (const e of effectifs) {
    const x = niveaux.get(e.niveau) || { niveau: e.niveau, total: 0, femmes: 0, hommes: 0 };
    x.total += e.nombre;
    if (e.sexe === 'F') x.femmes += e.nombre;
    if (e.sexe === 'M') x.hommes += e.nombre;
    niveaux.set(e.niveau, x);
  }
  const offre = { licence: 0, master: 0, doctorat: 0 };
  for (const h of habilitations) if (h.statut !== 'retiree') offre[h.cycle] += 1;
  const total = etablissements.reduce((s, e) => s + e.total, 0);
  const femmes = etablissements.reduce((s, e) => s + e.femmes, 0);
  const hommes = etablissements.reduce((s, e) => s + e.hommes, 0);
  const enseignants = etablissements.reduce((s, e) => s + e.enseignants, 0);
  return {
    totaux: {
      etablissements: fiches.length, etudiants: total, femmes, hommes, partFemmes: femmes + hommes ? Math.round((femmes / (femmes + hommes)) * 1000) / 10 : null,
      enseignants, ratio: enseignants ? Math.round((total / enseignants) * 10) / 10 : null, formations: offre.licence + offre.master + offre.doctorat, offre,
    },
    etablissements, parProvince: regrouper('province'), parType: regrouper('type'),
    parNiveau: [...niveaux.values()].sort((a, b) => a.niveau.localeCompare(b.niveau, 'fr')),
  };
}

async function annuairePDF(a, agent) {
  const annee = new Date().getFullYear();
  const certification = await certifier({
    cle: `annuaire_statistique_${jour()}`, type: 'annuaire_statistique', etablissement: null,
    titre: `Annuaire statistique de l'enseignement supérieur, édition ${annee}`,
    elements: [['Établissements', String(a.totaux.etablissements)], ['Étudiants', entier(a.totaux.etudiants)], ['Enseignants', entier(a.totaux.enseignants)], ['Part des femmes', pct(a.totaux.partFemmes)]],
    donnees: a.etablissements.map((e) => [e.id, e.total, e.femmes, e.hommes, e.enseignants]), emisParId: agent?.id ?? null,
  });
  const { doc, termine } = nouveauPDF({ layout: 'landscape' });
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = entete(doc, certification, 'ANNUAIRE STATISTIQUE', `Enseignement supérieur, édition ${annee}`);
  y = blocIdentite(doc, marge, y, largeur, [
    ['Établissements', String(a.totaux.etablissements)], ['Étudiants', entier(a.totaux.etudiants)], ['Femmes', `${entier(a.totaux.femmes)} (${pct(a.totaux.partFemmes)})`, 1.3],
    ['Enseignants', entier(a.totaux.enseignants)], ['Étudiants par enseignant', a.totaux.ratio == null ? '-' : String(a.totaux.ratio).replace('.', ','), 1.2],
    ['Formations habilitées', `${a.totaux.formations} (L ${a.totaux.offre.licence} · M ${a.totaux.offre.master} · D ${a.totaux.offre.doctorat})`, 1.6],
  ]) + 16;

  y = titreSection(doc, y, '1. Effectifs étudiants par établissement');
  y = tableau(doc, marge, y, colonnes(largeur, [220, 90, 100, 60, 60, 60, 60, 70, 70]),
    ['Établissement', 'Province', 'Type', 'Étudiants', 'Femmes', 'Hommes', '% femmes', 'Enseignants', 'Étud. / ens.'],
    a.etablissements.map((e) => [
      { texte: e.nom, gras: true }, { texte: e.province }, { texte: e.type }, { texte: entier(e.total), align: 'right', gras: true },
      { texte: entier(e.femmes), align: 'right' }, { texte: entier(e.hommes), align: 'right' }, { texte: pct(e.partFemmes), align: 'right' },
      { texte: entier(e.enseignants), align: 'right' }, { texte: e.ratio == null ? '-' : String(e.ratio).replace('.', ','), align: 'right' },
    ]), { hauteur: 19, taille: 7.8 }) + 18;

  y = titreSection(doc, y, '2. Effectifs par province');
  y = tableau(doc, marge, y, colonnes(largeur, [200, 110, 110, 110, 110, 110]), ['Province', 'Établissements', 'Étudiants', 'Femmes', 'Hommes', 'Enseignants'],
    a.parProvince.map((p) => [{ texte: p.libelle, gras: true }, { texte: String(p.etablissements), align: 'right' }, { texte: entier(p.total), align: 'right', gras: true },
      { texte: entier(p.femmes), align: 'right' }, { texte: entier(p.hommes), align: 'right' }, { texte: entier(p.enseignants), align: 'right' }]),
    { hauteur: 19, taille: 7.8 }) + 18;

  y = titreSection(doc, y, '3. Effectifs par niveau d’études');
  y = tableau(doc, marge, y, colonnes(largeur, [240, 140, 140, 140]), ['Niveau', 'Étudiants', 'Femmes', 'Hommes'],
    a.parNiveau.map((n) => [{ texte: n.niveau, gras: true }, { texte: entier(n.total), align: 'right', gras: true }, { texte: entier(n.femmes), align: 'right' }, { texte: entier(n.hommes), align: 'right' }]),
    { hauteur: 19, taille: 7.8 }) + 18;

  y = titreSection(doc, y, '4. Effectifs par type d’établissement');
  y = tableau(doc, marge, y, colonnes(largeur, [240, 120, 120, 120, 120]), ['Type', 'Établissements', 'Étudiants', 'Femmes', 'Enseignants'],
    a.parType.map((t) => [{ texte: t.libelle || 'Non renseigné', gras: true }, { texte: String(t.etablissements), align: 'right' }, { texte: entier(t.total), align: 'right', gras: true },
      { texte: entier(t.femmes), align: 'right' }, { texte: entier(t.enseignants), align: 'right' }]),
    { hauteur: 19, taille: 7.8, reserveFin: 120 }) + 12;
  doc.font('Helvetica').fontSize(7.2).fillColor(C.COULEUR_TEXTE_CLAIR).text(
    'Données agrégées transmises par les établissements via EduSphere, sans aucune information nominative. Le pourcentage de femmes est calculé sur les étudiants dont le sexe est renseigné.',
    marge, y, { width: largeur },
  );
  return signerEtFinir(doc, termine, certification, 'Annuaire statistique', doc.y + 10);
}

function annuaireXlsx(a) {
  const classeur = XLSX.utils.book_new();
  const feuille = (lignes, nom) => XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ Information: 'Aucune donnée' }]), nom);
  feuille(a.etablissements.map((e) => ({
    Établissement: e.nom, Province: e.province, Type: e.type, Étudiants: e.total, Femmes: e.femmes, Hommes: e.hommes, 'Sexe non renseigné': e.nonRenseigne,
    '% femmes': e.partFemmes ?? '', Enseignants: e.enseignants, 'Étudiants par enseignant': e.ratio ?? '', 'Taux de réussite (%)': e.tauxReussite ?? '',
  })), 'Établissements');
  feuille(a.parProvince.map((p) => ({ Province: p.libelle, Établissements: p.etablissements, Étudiants: p.total, Femmes: p.femmes, Hommes: p.hommes, Enseignants: p.enseignants })), 'Provinces');
  feuille(a.parNiveau.map((n) => ({ Niveau: n.niveau, Étudiants: n.total, Femmes: n.femmes, Hommes: n.hommes })), 'Niveaux');
  feuille(a.parType.map((t) => ({ Type: t.libelle, Établissements: t.etablissements, Étudiants: t.total, Femmes: t.femmes, Enseignants: t.enseignants })), 'Types');
  feuille([{ Licence: a.totaux.offre.licence, Master: a.totaux.offre.master, Doctorat: a.totaux.offre.doctorat, Total: a.totaux.formations }], 'Offre de formation');
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------
// Rapport d'inspection
// ---------------------------------------------------------------------------
async function rapportInspectionPDF(inspection, etablissement, recommandations, agent) {
  const certification = await certifier({
    cle: `rapport_inspection_${inspection.id}`, type: 'rapport_inspection', etablissement: { id: etablissement.id },
    titre: `Rapport d'inspection ${inspection.reference} : ${etablissement.nom}`,
    elements: [
      ['Référence', inspection.reference], ['Établissement', etablissement.nom], ['Nature', LIBELLES_NATURE[inspection.nature]],
      ['Réalisée le', dateCourte(inspection.dateRealisee)], ['Avis', LIBELLES_AVIS[inspection.avis] || 'Non rendu'], ['Recommandations', String(recommandations.length)],
    ],
    donnees: [inspection.constats, recommandations.map((r) => [r.texte, r.echeance, r.statut])], emisParId: agent?.id ?? null,
  });
  const { doc, termine } = nouveauPDF({});
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - marge - doc.page.margins.right;
  let y = entete(doc, certification, "RAPPORT D'INSPECTION", inspection.reference);
  y = blocIdentite(doc, marge, y, largeur, [
    ['Établissement', etablissement.nom, 2], ['Nature', LIBELLES_NATURE[inspection.nature]], ['Réalisée le', dateCourte(inspection.dateRealisee) || 'Non réalisée'],
  ]) + 10;
  y = blocIdentite(doc, marge, y, largeur, [['Inspecteurs', inspection.inspecteurs, 2], ['Avis', LIBELLES_AVIS[inspection.avis] || 'Non rendu', 1.2]]) + 16;
  y = titreSection(doc, y, 'Objet de la mission');
  doc.font('Helvetica').fontSize(9.5).fillColor(C.COULEUR_TEXTE).text(inspection.objet, marge, y, { width: largeur, lineGap: 2 });
  y = titreSection(doc, doc.y + 14, 'Constats');
  doc.font('Helvetica').fontSize(9.5).fillColor(C.COULEUR_TEXTE).text(inspection.constats || 'Aucun constat consigné.', marge, y, { width: largeur, lineGap: 2 });
  y = titreSection(doc, doc.y + 14, 'Recommandations');
  y = tableau(doc, marge, y, colonnes(largeur, [24, 280, 80, 100]), ['N°', 'Recommandation', 'Échéance', 'Suivi'],
    recommandations.map((r, i) => [{ texte: String(i + 1), align: 'center' }, { texte: r.texte }, { texte: dateCourte(r.echeance) || '-' }, { texte: LIBELLES_RECO[r.statut], gras: true }]),
    { hauteur: 24, taille: 8, reserveFin: 120 }) + 14;
  return signerEtFinir(doc, termine, certification, "Rapport d'inspection", y);
}

module.exports = {
  classer, CRITERES, lignesRegistre, registrePDF, lignesClassement, classementPDF, annuaire, annuairePDF, annuaireXlsx, rapportInspectionPDF,
  LIBELLES_CYCLE, LIBELLES_HABILITATION, LIBELLES_NATURE, LIBELLES_AVIS, LIBELLES_RECO,
};
