const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { Etablissement, DecisionAgrement, Circulaire, AccuseCirculaire, Utilisateur, Notification } = require('../models');
const { lireNational, LISTE_PROVINCES, etatRole } = require('../services/ministereService');
const { journaliserAudit } = require('../services/auditService');
const { rapportNationalPDF } = require('../services/rapportNationalService');

// Espace du Ministère de l'Enseignement supérieur : tutelle des
// établissements (agréments), statistiques nationales agrégées, alertes de
// décrochage, circulaires, vérification des documents, rapports.

const STATUTS_AGREMENT = ['en_instruction', 'provisoire', 'agree', 'suspendu', 'retire'];
const LIBELLES_AGREMENT = { en_instruction: 'En instruction', provisoire: 'Agrément provisoire', agree: 'Agréé', suspendu: 'Agrément suspendu', retire: 'Agrément retiré' };
const TYPES = ['universite_publique', 'universite_privee', 'institut_superieur', 'grande_ecole'];
const LIBELLES_TYPE = { universite_publique: 'Université publique', universite_privee: 'Université privée', institut_superieur: 'Institut supérieur', grande_ecole: 'Grande école' };

const taux = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

// Toutes les données nationales, lues sous le rôle PostgreSQL restreint.
async function donneesNationales() {
  const [etablissements, resultats, assiduite, risques, documents] = await Promise.all([
    lireNational('SELECT * FROM vue_ministere_etablissements ORDER BY nom'),
    lireNational('SELECT * FROM vue_ministere_resultats'),
    lireNational('SELECT * FROM vue_ministere_assiduite'),
    lireNational('SELECT * FROM vue_ministere_risques'),
    lireNational('SELECT * FROM vue_ministere_documents'),
  ]);
  const parEtab = (liste) => new Map(liste.map((l) => [l.etablissementId, l]));
  const assid = parEtab(assiduite);
  const risq = parEtab(risques);

  const fiches = etablissements.map((e) => {
    const res = resultats.filter((r) => r.etablissementId === e.id);
    const evalues = res.reduce((s, r) => s + r.evalues, 0);
    const admis = res.reduce((s, r) => s + r.admis, 0);
    const moyenne = evalues ? Math.round((res.reduce((s, r) => s + r.moyenne * r.evalues, 0) / evalues) * 100) / 100 : null;
    const a = assid.get(e.id) || {};
    const r = risq.get(e.id) || {};
    const docs = documents.filter((d) => d.etablissementId === e.id);
    return {
      ...e,
      libelleType: LIBELLES_TYPE[e.typeEtablissement],
      libelleAgrement: LIBELLES_AGREMENT[e.agrementStatut],
      evalues, admis, tauxReussite: taux(admis, evalues), moyenne,
      absencesNonJustifiees: a.absences_non_justifiees || 0, retards: a.retards || 0,
      absencesParEtudiant: e.effectif ? Math.round(((a.absences_non_justifiees || 0) / e.effectif) * 10) / 10 : 0,
      risqueEleve: r.risque_eleve || 0, risqueMoyen: r.risque_moyen || 0, risqueFaible: r.risque_faible || 0,
      tauxRisque: taux(r.risque_eleve || 0, e.effectif),
      documentsEmis: docs.reduce((s, d) => s + d.nombre, 0),
      documentsVerifies: docs.reduce((s, d) => s + (d.verifications || 0), 0),
      parNiveau: res.map((x) => ({ niveau: x.niveau, evalues: x.evalues, admis: x.admis, tauxReussite: taux(x.admis, x.evalues), moyenne: x.moyenne })),
    };
  });
  return { fiches, resultats, documents };
}

function synthese(fiches, resultats) {
  const somme = (cle, liste = fiches) => liste.reduce((s, f) => s + (f[cle] || 0), 0);
  const evalues = somme('evalues');
  const admis = somme('admis');
  const regrouper = (cle, libelles) => {
    const groupes = new Map();
    for (const f of fiches) {
      const k = f[cle] || 'Non renseignée';
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(f);
    }
    return [...groupes.entries()].map(([k, liste]) => {
      const ev = somme('evalues', liste);
      return {
        cle: k, libelle: libelles?.[k] || k, etablissements: liste.length, effectif: somme('effectif', liste),
        evalues: ev, admis: somme('admis', liste), tauxReussite: taux(somme('admis', liste), ev),
        risqueEleve: somme('risqueEleve', liste),
      };
    }).sort((a, b) => b.effectif - a.effectif);
  };
  const niveaux = new Map();
  for (const r of resultats) {
    const n = niveaux.get(r.niveau) || { niveau: r.niveau, evalues: 0, admis: 0, somme: 0 };
    n.evalues += r.evalues; n.admis += r.admis; n.somme += r.moyenne * r.evalues;
    niveaux.set(r.niveau, n);
  }
  const dans90 = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return {
    totaux: {
      etablissements: fiches.length,
      agrees: fiches.filter((f) => f.agrementStatut === 'agree').length,
      provisoires: fiches.filter((f) => f.agrementStatut === 'provisoire').length,
      enInstruction: fiches.filter((f) => f.agrementStatut === 'en_instruction').length,
      suspendusOuRetires: fiches.filter((f) => ['suspendu', 'retire'].includes(f.agrementStatut)).length,
      effectif: somme('effectif'), enseignants: somme('enseignants'), classes: somme('classes'),
      evalues, admis, tauxReussite: taux(admis, evalues),
      moyenne: evalues ? Math.round((fiches.reduce((s, f) => s + (f.moyenne || 0) * f.evalues, 0) / evalues) * 100) / 100 : null,
      risqueEleve: somme('risqueEleve'), risqueMoyen: somme('risqueMoyen'),
      absencesNonJustifiees: somme('absencesNonJustifiees'),
      documentsEmis: somme('documentsEmis'), documentsVerifies: somme('documentsVerifies'),
    },
    parProvince: regrouper('province'),
    parType: regrouper('typeEtablissement', LIBELLES_TYPE),
    parNiveau: [...niveaux.values()].map((n) => ({ niveau: n.niveau, evalues: n.evalues, admis: n.admis, tauxReussite: taux(n.admis, n.evalues), moyenne: n.evalues ? Math.round((n.somme / n.evalues) * 100) / 100 : null }))
      .sort((a, b) => a.niveau.localeCompare(b.niveau, 'fr')),
    agrementsAEcheance: fiches.filter((f) => f.agrementExpiration && f.agrementExpiration <= dans90 && ['agree', 'provisoire'].includes(f.agrementStatut))
      .map((f) => ({ id: f.id, nom: f.nom, agrementExpiration: f.agrementExpiration, libelleAgrement: f.libelleAgrement })),
  };
}

async function vueNationale(req, res) {
  const { fiches, resultats } = await donneesNationales();
  return res.json({
    ...synthese(fiches, resultats),
    etablissements: fiches,
    provinces: LISTE_PROVINCES,
    types: TYPES.map((t) => ({ valeur: t, libelle: LIBELLES_TYPE[t] })),
    statutsAgrement: STATUTS_AGREMENT.map((s) => ({ valeur: s, libelle: LIBELLES_AGREMENT[s] })),
    lectureRestreinte: etatRole(),
    calculeLe: new Date(),
  });
}

async function ficheEtablissement(req, res) {
  const { fiches } = await donneesNationales();
  const fiche = fiches.find((f) => f.id === Number(req.params.id));
  if (!fiche) return res.status(404).json({ erreur: 'établissement introuvable' });
  const decisions = await DecisionAgrement.findAll({ where: { etablissementId: fiche.id }, order: [['createdAt', 'DESC']] });
  const accuses = await AccuseCirculaire.findAll({ where: { etablissementId: fiche.id }, include: [{ model: Circulaire, attributes: ['reference', 'titre', 'publieeLe'] }], order: [['createdAt', 'DESC']], limit: 20 });
  return res.json({ etablissement: fiche, decisions, accuses });
}

// Décision d'agrément : met à jour l'établissement, ajoute la décision à
// l'historique, prévient l'Académie de l'école et l'inscrit au journal.
async function deciderAgrement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  const { statut, numero, dateEffet, dateExpiration, motif, typeEtablissement, province } = req.body || {};
  if (!STATUTS_AGREMENT.includes(statut)) return res.status(400).json({ erreur: 'décision invalide' });
  if (!motif || String(motif).trim().length < 10) return res.status(400).json({ erreur: 'motivez la décision (10 caractères au moins)' });
  if (['agree', 'provisoire'].includes(statut) && !String(numero || '').trim()) return res.status(400).json({ erreur: "le numéro de l'arrêté d'agrément est obligatoire" });
  if (dateExpiration && dateEffet && dateExpiration <= dateEffet) return res.status(400).json({ erreur: "la date d'expiration doit suivre la date d'effet" });
  if (typeEtablissement && !TYPES.includes(typeEtablissement)) return res.status(400).json({ erreur: "type d'établissement invalide" });
  if (province && !LISTE_PROVINCES.includes(province)) return res.status(400).json({ erreur: 'province inconnue' });

  const effet = dateEffet || new Date().toISOString().slice(0, 10);
  const decision = await DecisionAgrement.create({
    etablissementId: etablissement.id, statut, numero: numero || null, dateEffet: effet, dateExpiration: dateExpiration || null,
    motif: String(motif).trim(), decideParId: req.utilisateur.id, decideParNom: nomAgent(req.utilisateur),
  });
  await etablissement.update({
    agrementStatut: statut,
    agrementNumero: numero || etablissement.agrementNumero,
    agrementDate: ['agree', 'provisoire'].includes(statut) ? effet : etablissement.agrementDate,
    agrementExpiration: dateExpiration || (['agree', 'provisoire'].includes(statut) ? null : etablissement.agrementExpiration),
    ...(typeEtablissement && { typeEtablissement }),
    ...(province && { province }),
  });
  const academies = await Utilisateur.findAll({ where: { etablissementId: etablissement.id, role: 'academie' }, attributes: ['id'] });
  await Notification.bulkCreate(academies.map((u) => ({
    utilisateurId: u.id, dateEnvoi: new Date(),
    contenu: `Ministère de l'Enseignement supérieur : ${LIBELLES_AGREMENT[statut]}${numero ? ` (arrêté ${numero})` : ''}. ${String(motif).trim()}`.slice(0, 250),
  }))).catch(() => {});
  await journaliserAudit(req, { action: 'decision_agrement', cible: etablissement.nom, details: { statut, numero: numero || null }, etablissementId: etablissement.id });
  return res.json({ decision, etablissement });
}

// ---------------------------------------------------------------------------
// Circulaires
// ---------------------------------------------------------------------------

function cibleEtablissement(cible, e) {
  if (!cible || cible.toutes) return true;
  return (cible.provinces || []).includes(e.province) || (cible.types || []).includes(e.typeEtablissement) || (cible.etablissements || []).includes(e.id);
}

async function destinatairesDe(circulaire) {
  const etablissements = await Etablissement.findAll({ attributes: ['id', 'nom', 'province', 'typeEtablissement'] });
  return etablissements.filter((e) => cibleEtablissement(circulaire.cible, e));
}

async function listerCirculaires(req, res) {
  const circulaires = await Circulaire.findAll({ order: [['publieeLe', 'DESC']], include: [AccuseCirculaire] });
  const etablissements = await Etablissement.findAll({ attributes: ['id', 'province', 'typeEtablissement'] });
  return res.json({
    circulaires: circulaires.map((c) => {
      const cibles = etablissements.filter((e) => cibleEtablissement(c.cible, e)).length;
      return {
        ...c.toJSON(), AccuseCirculaires: undefined, destinataires: cibles,
        lues: c.AccuseCirculaires.filter((a) => a.lueLe).length, accusees: c.AccuseCirculaires.filter((a) => a.accuseLe).length,
      };
    }),
  });
}

async function publierCirculaire(req, res) {
  const { titre, objet, contenu, priorite = 'information', cible = { toutes: true }, echeance, signataire } = req.body || {};
  if (!titre || String(titre).trim().length < 5) return res.status(400).json({ erreur: 'titre trop court' });
  if (!contenu || String(contenu).trim().length < 20) return res.status(400).json({ erreur: 'le texte de la circulaire est trop court' });
  const propre = cible.toutes ? { toutes: true } : {
    provinces: (cible.provinces || []).filter((p) => LISTE_PROVINCES.includes(p)),
    types: (cible.types || []).filter((t) => TYPES.includes(t)),
    etablissements: (cible.etablissements || []).map(Number).filter(Number.isInteger),
  };
  if (!propre.toutes && !propre.provinces.length && !propre.types.length && !propre.etablissements.length) return res.status(400).json({ erreur: 'choisissez au moins un destinataire' });
  const annee = new Date().getFullYear();
  const deLAnnee = await Circulaire.count({ where: { reference: { [Op.like]: `MESR/${annee}/%` } } });
  const circulaire = await Circulaire.create({
    reference: `MESR/${annee}/${String(deLAnnee + 1).padStart(4, '0')}`,
    titre: String(titre).trim().slice(0, 200), objet: objet ? String(objet).trim().slice(0, 300) : null,
    contenu: String(contenu).trim(), priorite, cible: propre, echeance: echeance || null,
    auteurId: req.utilisateur.id, auteurNom: nomAgent(req.utilisateur), signataire: signataire || nomAgent(req.utilisateur),
  });
  const destinataires = await destinatairesDe(circulaire);
  const academies = await Utilisateur.findAll({ where: { etablissementId: destinataires.map((d) => d.id), role: 'academie' }, attributes: ['id'] });
  await Notification.bulkCreate(academies.map((u) => ({
    utilisateurId: u.id, dateEnvoi: new Date(),
    contenu: `Nouvelle circulaire du Ministère (${circulaire.reference}) : ${circulaire.titre}`.slice(0, 250),
  }))).catch(() => {});
  await journaliserAudit(req, { action: 'circulaire_publiee', cible: circulaire.reference, details: { destinataires: destinataires.length } });
  return res.status(201).json({ circulaire, destinataires: destinataires.length });
}

async function suiviCirculaire(req, res) {
  const circulaire = await Circulaire.findByPk(req.params.id, { include: [AccuseCirculaire] });
  if (!circulaire) return res.status(404).json({ erreur: 'circulaire introuvable' });
  const destinataires = await destinatairesDe(circulaire);
  const parEtab = new Map(circulaire.AccuseCirculaires.map((a) => [a.etablissementId, a]));
  return res.json({
    circulaire: { ...circulaire.toJSON(), AccuseCirculaires: undefined },
    destinataires: destinataires.map((e) => {
      const a = parEtab.get(e.id);
      return { id: e.id, nom: e.nom, province: e.province, lueLe: a?.lueLe || null, accuseLe: a?.accuseLe || null, accuseParNom: a?.accuseParNom || null };
    }),
  });
}

// Côté établissement : circulaires reçues, lecture et accusé de réception.
async function circulairesRecues(req, res) {
  const etablissement = await Etablissement.findByPk(req.utilisateur.etablissementId, { attributes: ['id', 'province', 'typeEtablissement', 'agrementStatut', 'agrementNumero', 'agrementExpiration'] });
  const toutes = await Circulaire.findAll({ order: [['publieeLe', 'DESC']] });
  const recues = toutes.filter((c) => cibleEtablissement(c.cible, etablissement));
  const accuses = await AccuseCirculaire.findAll({ where: { etablissementId: etablissement.id } });
  const parCirc = new Map(accuses.map((a) => [a.circulaireId, a]));
  return res.json({
    circulaires: recues.map((c) => ({ ...c.toJSON(), cible: undefined, lueLe: parCirc.get(c.id)?.lueLe || null, accuseLe: parCirc.get(c.id)?.accuseLe || null })),
    nonLues: recues.filter((c) => !parCirc.get(c.id)?.lueLe).length,
    agrement: { statut: etablissement.agrementStatut, libelle: LIBELLES_AGREMENT[etablissement.agrementStatut], numero: etablissement.agrementNumero, expiration: etablissement.agrementExpiration },
  });
}

async function marquerCirculaire(req, res, champ) {
  const circulaire = await Circulaire.findByPk(req.params.id);
  const etablissement = await Etablissement.findByPk(req.utilisateur.etablissementId);
  if (!circulaire || !cibleEtablissement(circulaire.cible, etablissement)) return res.status(404).json({ erreur: 'circulaire introuvable' });
  const [accuse] = await AccuseCirculaire.findOrCreate({ where: { circulaireId: circulaire.id, etablissementId: etablissement.id } });
  const maintenant = new Date();
  if (!accuse.lueLe) accuse.lueLe = maintenant;
  if (champ === 'accuse' && !accuse.accuseLe) {
    accuse.accuseLe = maintenant;
    accuse.accuseParNom = nomAgent(req.utilisateur);
  }
  await accuse.save();
  return res.json({ lueLe: accuse.lueLe, accuseLe: accuse.accuseLe });
}

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------

async function rapport(req, res) {
  const { fiches, resultats } = await donneesNationales();
  const donnees = { ...synthese(fiches, resultats), etablissements: fiches };
  if (req.query.format === 'xlsx') {
    const classeur = XLSX.utils.book_new();
    const feuille = (lignes, nom) => XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes), nom);
    feuille(fiches.map((f) => ({
      Établissement: f.nom, Sigle: f.sigle, Province: f.province || '', Ville: f.ville, Type: f.libelleType, Agrément: f.libelleAgrement,
      'N° agrément': f.agrementNumero || '', 'Expire le': f.agrementExpiration || '', Effectif: f.effectif, Enseignants: f.enseignants,
      'Étudiants évalués': f.evalues, Admis: f.admis, 'Taux de réussite (%)': f.tauxReussite ?? '', 'Moyenne': f.moyenne ?? '',
      'Absences non justifiées': f.absencesNonJustifiees, 'Risque de décrochage élevé': f.risqueEleve, 'Documents certifiés': f.documentsEmis,
    })), 'Établissements');
    feuille(donnees.parProvince.map((p) => ({ Province: p.libelle, Établissements: p.etablissements, Effectif: p.effectif, 'Évalués': p.evalues, Admis: p.admis, 'Taux de réussite (%)': p.tauxReussite ?? '', 'Risque élevé': p.risqueEleve })), 'Provinces');
    feuille(donnees.parNiveau.map((n) => ({ Niveau: n.niveau, 'Évalués': n.evalues, Admis: n.admis, 'Taux de réussite (%)': n.tauxReussite ?? '', Moyenne: n.moyenne ?? '' })), 'Niveaux');
    const contenu = XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="rapport-national-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.send(contenu);
  }
  const pdf = await rapportNationalPDF(donnees, req.utilisateur);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="rapport-national-${new Date().toISOString().slice(0, 10)}.pdf"`);
  res.set('Cache-Control', 'private, no-store');
  return res.send(pdf);
}

async function statistiquesDocuments(req, res) {
  const lignes = await lireNational('SELECT "typeDocument", statut, sum(nombre)::int AS nombre, sum(verifications)::int AS verifications FROM vue_ministere_documents GROUP BY "typeDocument", statut');
  return res.json({ lignes });
}

module.exports = {
  vueNationale, ficheEtablissement, deciderAgrement, listerCirculaires, publierCirculaire, suiviCirculaire,
  circulairesRecues, marquerLue: (req, res) => marquerCirculaire(req, res, 'lue'), accuserReception: (req, res) => marquerCirculaire(req, res, 'accuse'),
  rapport, statistiquesDocuments, LIBELLES_AGREMENT, LIBELLES_TYPE,
};
