const XLSX = require('xlsx');
const { Eleve, Classe, DossierBourse, PieceBourse, Utilisateur, Notification, Semestre } = require('../models');
const { sha256 } = require('../utils/chiffrement');
const { journaliserAudit } = require('../services/auditService');
const { obtenirEtablissementDe } = require('../services/etablissementService');

// Dossier de bourse ANBG (Agence nationale des bourses du Gabon) :
// l'étudiant (ou son parent) téléverse ses pièces, l'Académie les examine,
// valide le dossier et exporte la liste des boursiers pour l'agence.

const TYPES = {
  piece_identite: { libelle: "Pièce d'identité (CNI ou passeport)", obligatoire: true },
  decision_anbg: { libelle: "Décision d'attribution ou attestation de bourse ANBG", obligatoire: true },
  attestation_inscription: { libelle: "Attestation d'inscription de l'année", obligatoire: true, generable: true },
  releve_notes: { libelle: 'Relevé de notes de la dernière année', obligatoire: true, generable: true },
  rib: { libelle: 'Relevé d’identité bancaire (RIB)', obligatoire: true },
  photo: { libelle: "Photo d'identité", obligatoire: false },
  autre: { libelle: 'Autre justificatif', obligatoire: false },
};
const TAILLE_MAX = 5 * 1024 * 1024;
const PIECES_MAX = 20;
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

// Type réel du fichier, lu dans ses premiers octets (jamais d'après le nom
// ou l'en-tête envoyé par le navigateur) : PDF, PNG ou JPEG seulement.
function typeReel(contenu) {
  if (contenu.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (contenu.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (contenu[0] === 0xff && contenu[1] === 0xd8 && contenu[2] === 0xff) return 'image/jpeg';
  return null;
}
const EXTENSIONS = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
const nomPropre = (nom, mime) => {
  const base = String(nom || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[^\w-]+/g, '-').slice(0, 120) || 'document';
  return `${base}.${EXTENSIONS[mime]}`;
};

function completude(pieces) {
  const obligatoires = Object.entries(TYPES).filter(([, t]) => t.obligatoire).map(([k]) => k);
  const presents = obligatoires.filter((k) => pieces.some((p) => p.type === k && p.statut !== 'refuse'));
  const valides = obligatoires.filter((k) => pieces.some((p) => p.type === k && p.statut === 'valide'));
  return { obligatoires: obligatoires.length, presents: presents.length, valides: valides.length, manquants: obligatoires.filter((k) => !presents.includes(k)).map((k) => TYPES[k].libelle) };
}

async function dossierDe(eleve) {
  const [dossier] = await DossierBourse.findOrCreate({ where: { eleveId: eleve.id }, defaults: { etablissementId: eleve.etablissementId } });
  return dossier;
}

async function vueDossier(dossier) {
  const pieces = await PieceBourse.findAll({ where: { dossierId: dossier.id }, order: [['createdAt', 'DESC']] });
  return {
    dossier,
    pieces: pieces.map((p) => ({ ...p.toJSON(), libelleType: TYPES[p.type]?.libelle || p.type })),
    completude: completude(pieces),
    types: Object.entries(TYPES).map(([valeur, t]) => ({ valeur, ...t })),
  };
}

async function eleveDuCompte(req) {
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } });
  if (!eleve) throw Object.assign(new Error('dossier étudiant introuvable'), { status: 404 });
  return eleve;
}

async function eleveDeLEcole(req) {
  const eleve = await Eleve.findOne({ where: { id: Number(req.params.eleveId), etablissementId: req.utilisateur.etablissementId }, include: [Classe] });
  if (!eleve) throw Object.assign(new Error('étudiant introuvable'), { status: 404 });
  return eleve;
}

// Enregistre une pièce reçue en binaire (corps de la requête).
async function enregistrerPiece(req, eleve, origine) {
  const type = String(req.query.type || '');
  if (!TYPES[type]) throw Object.assign(new Error('type de pièce inconnu'), { status: 400 });
  const contenu = req.body;
  if (!Buffer.isBuffer(contenu) || !contenu.length) throw Object.assign(new Error('fichier vide'), { status: 400 });
  if (contenu.length > TAILLE_MAX) throw Object.assign(new Error('fichier trop lourd (5 Mo au plus)'), { status: 413 });
  const mime = typeReel(contenu);
  if (!mime) throw Object.assign(new Error('format refusé : seuls les PDF, PNG et JPEG sont acceptés'), { status: 415 });
  const dossier = await dossierDe(eleve);
  if (dossier.statut === 'valide') throw Object.assign(new Error('dossier déjà validé par l’établissement'), { status: 409 });
  if (await PieceBourse.count({ where: { dossierId: dossier.id } }) >= PIECES_MAX) throw Object.assign(new Error(`${PIECES_MAX} pièces au plus par dossier`), { status: 400 });
  const piece = await PieceBourse.create({
    dossierId: dossier.id, eleveId: eleve.id, etablissementId: eleve.etablissementId, type,
    nomFichier: nomPropre(req.query.nom, mime), mime, taille: contenu.length, contenu, empreinte: sha256(contenu), origine,
  });
  if (dossier.statut === 'a_corriger') await dossier.update({ statut: 'incomplet' });
  return piece;
}

// ---------------------------------------------------------------------------
// Étudiant
// ---------------------------------------------------------------------------
async function monDossier(req, res) {
  return res.json(await vueDossier(await dossierDe(await eleveDuCompte(req))));
}

async function majMonDossier(req, res) {
  const dossier = await dossierDe(await eleveDuCompte(req));
  if (dossier.statut === 'valide') return res.status(409).json({ erreur: 'dossier déjà validé' });
  const numero = String(req.body?.numeroBoursier || '').trim().toUpperCase();
  if (numero && !/^[A-Z0-9/-]{3,40}$/.test(numero)) return res.status(400).json({ erreur: 'numéro de boursier invalide' });
  await dossier.update({ numeroBoursier: numero || null });
  return res.json(await vueDossier(dossier));
}

async function deposerMaPiece(req, res) {
  const eleve = await eleveDuCompte(req);
  const piece = await enregistrerPiece(req, eleve, req.sessionParent ? 'parent' : 'etudiant');
  return res.status(201).json({ piece: { ...piece.toJSON(), contenu: undefined } });
}

// Attestation d'inscription ou relevé de notes : générés et certifiés par
// la plateforme, joints directement au dossier (déjà validés).
async function genererPiece(req, res) {
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id }, include: [Classe] });
  if (!eleve) return res.status(404).json({ erreur: 'dossier étudiant introuvable' });
  const type = req.query.type;
  if (!TYPES[type]?.generable) return res.status(400).json({ erreur: 'cette pièce ne peut pas être générée' });
  const dossier = await dossierDe(eleve);
  if (dossier.statut === 'valide') return res.status(409).json({ erreur: 'dossier déjà validé' });
  const etablissement = await obtenirEtablissementDe(eleve.etablissementId);
  const { attestationPDF, relevePDF } = require('../services/documentsOfficielsService');
  const { calculerBulletin } = require('../services/moyenneService');
  let contenu;
  if (type === 'attestation_inscription') {
    if (!eleve.Classe) return res.status(400).json({ erreur: "inscription dans une classe requise" });
    const dernier = await Semestre.findOne({ where: { etablissementId: eleve.etablissementId }, order: [['anneeScolaire', 'DESC']] });
    contenu = await attestationPDF({ etablissement, eleve, classe: eleve.Classe, type: 'inscription', anneeScolaire: dernier?.anneeScolaire, emisParId: req.utilisateur.id });
  } else {
    const semestres = await Semestre.findAll({ where: { etablissementId: eleve.etablissementId }, order: [['anneeScolaire', 'ASC'], ['numero', 'ASC']] });
    const liste = [];
    for (const semestre of semestres) {
      const calcul = await calculerBulletin(eleve.id, semestre.id);
      if (calcul.detailParUE.length) liste.push({ semestre, calcul });
    }
    contenu = await relevePDF({ etablissement, eleve, classe: eleve.Classe, semestres: liste, emisParId: req.utilisateur.id });
  }
  await PieceBourse.destroy({ where: { dossierId: dossier.id, type, origine: 'plateforme' } });
  const piece = await PieceBourse.create({
    dossierId: dossier.id, eleveId: eleve.id, etablissementId: eleve.etablissementId, type,
    nomFichier: `${type === 'releve_notes' ? 'releve-de-notes' : 'attestation-inscription'}-${eleve.matricule || eleve.id}.pdf`,
    mime: 'application/pdf', taille: contenu.length, contenu, empreinte: sha256(contenu), origine: 'plateforme',
    statut: 'valide', commentaire: 'Document certifié par l’établissement (QR code)', examineParNom: 'EduSphere', examineLe: new Date(),
  });
  return res.status(201).json({ piece: { ...piece.toJSON(), contenu: undefined } });
}

async function retirerMaPiece(req, res) {
  const eleve = await eleveDuCompte(req);
  const piece = await PieceBourse.findOne({ where: { id: req.params.id, eleveId: eleve.id } });
  if (!piece) return res.status(404).json({ erreur: 'pièce introuvable' });
  if (piece.statut === 'valide') return res.status(409).json({ erreur: 'une pièce validée ne peut plus être retirée' });
  await piece.destroy();
  return res.json({ ok: true });
}

async function soumettre(req, res) {
  const dossier = await dossierDe(await eleveDuCompte(req));
  const vue = await vueDossier(dossier);
  if (vue.completude.manquants.length) return res.status(400).json({ erreur: `pièces manquantes : ${vue.completude.manquants.join(', ')}` });
  if (!dossier.numeroBoursier) return res.status(400).json({ erreur: 'indiquez votre numéro de boursier ANBG' });
  if (['soumis', 'valide'].includes(dossier.statut)) return res.status(409).json({ erreur: 'dossier déjà transmis' });
  await dossier.update({ statut: 'soumis', soumisLe: new Date() });
  const academies = await Utilisateur.findAll({ where: { etablissementId: dossier.etablissementId, role: 'academie' }, attributes: ['id'] });
  const eleve = await Eleve.findByPk(dossier.eleveId, { attributes: ['nom', 'prenom'] });
  await Notification.bulkCreate(academies.map((u) => ({ utilisateurId: u.id, dateEnvoi: new Date(), contenu: `Dossier de bourse ANBG soumis : ${eleve.prenom} ${eleve.nom}.` }))).catch(() => {});
  return res.json(await vueDossier(dossier));
}

// Téléchargement d'une pièce : l'étudiant pour son dossier, l'Académie pour
// son école. Toujours en pièce jointe, jamais interprété par le navigateur.
async function telechargerPiece(req, res) {
  const piece = await PieceBourse.scope('avecContenu').findByPk(req.params.id);
  let autorise = false;
  if (piece && req.utilisateur.role === 'academie') autorise = piece.etablissementId === req.utilisateur.etablissementId;
  if (piece && req.utilisateur.role === 'etudiant') autorise = Boolean(await Eleve.count({ where: { id: piece.eleveId, compteEtudiantId: req.utilisateur.id } }));
  if (!autorise) return res.status(404).json({ erreur: 'pièce introuvable' });
  res.set({
    'Content-Type': piece.mime, 'Content-Disposition': `attachment; filename="${piece.nomFichier}"`, 'Access-Control-Expose-Headers': 'Content-Disposition',
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'",
  });
  return res.send(piece.contenu);
}

// ---------------------------------------------------------------------------
// Académie
// ---------------------------------------------------------------------------
async function listerDossiers(req, res) {
  const where = { etablissementId: req.utilisateur.etablissementId };
  if (['incomplet', 'soumis', 'a_corriger', 'valide'].includes(req.query.statut)) where.statut = req.query.statut;
  const dossiers = await DossierBourse.findAll({ where, include: [{ model: Eleve, include: [Classe] }], order: [['updatedAt', 'DESC']] });
  const pieces = await PieceBourse.findAll({ where: { dossierId: dossiers.map((d) => d.id) }, attributes: ['dossierId', 'type', 'statut'] });
  const totaux = await DossierBourse.count({ where: { etablissementId: req.utilisateur.etablissementId }, group: ['statut'] });
  return res.json({
    dossiers: dossiers.map((d) => {
      const p = pieces.filter((x) => x.dossierId === d.id);
      return {
        eleveId: d.eleveId, nom: d.Eleve?.nom, prenom: d.Eleve?.prenom, matricule: d.Eleve?.matricule, classe: d.Eleve?.Classe?.nom || '',
        numeroBoursier: d.numeroBoursier, statut: d.statut, soumisLe: d.soumisLe, pieces: p.length, aExaminer: p.filter((x) => x.statut === 'depose').length,
        completude: completude(p),
      };
    }),
    totaux: Object.fromEntries(totaux.map((t) => [t.statut, Number(t.count)])),
  });
}

async function dossierEtudiant(req, res) {
  const eleve = await eleveDeLEcole(req);
  const vue = await vueDossier(await dossierDe(eleve));
  return res.json({ ...vue, eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, matricule: eleve.matricule, classe: eleve.Classe?.nom || '' } });
}

async function deposerPourEtudiant(req, res) {
  const eleve = await eleveDeLEcole(req);
  const piece = await enregistrerPiece(req, eleve, 'academie');
  return res.status(201).json({ piece: { ...piece.toJSON(), contenu: undefined } });
}

async function examinerPiece(req, res) {
  const piece = await PieceBourse.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!piece) return res.status(404).json({ erreur: 'pièce introuvable' });
  const { statut, commentaire } = req.body || {};
  if (!['valide', 'refuse'].includes(statut)) return res.status(400).json({ erreur: 'décision invalide' });
  if (statut === 'refuse' && String(commentaire || '').trim().length < 5) return res.status(400).json({ erreur: "indiquez à l'étudiant ce qui ne va pas" });
  await piece.update({ statut, commentaire: commentaire ? String(commentaire).trim().slice(0, 400) : null, examineParNom: nomAgent(req.utilisateur), examineLe: new Date() });
  return res.json({ piece });
}

async function deciderDossier(req, res) {
  const eleve = await eleveDeLEcole(req);
  const dossier = await dossierDe(eleve);
  const { statut, observations } = req.body || {};
  if (!['valide', 'a_corriger'].includes(statut)) return res.status(400).json({ erreur: 'décision invalide' });
  const vue = await vueDossier(dossier);
  if (statut === 'valide' && vue.completude.valides < vue.completude.obligatoires) return res.status(400).json({ erreur: 'validez d’abord chaque pièce obligatoire' });
  if (statut === 'a_corriger' && String(observations || '').trim().length < 5) return res.status(400).json({ erreur: 'précisez les corrections attendues' });
  await dossier.update({ statut, observations: observations || null, ...(statut === 'valide' && { valideLe: new Date(), valideParNom: nomAgent(req.utilisateur) }) });
  if (eleve.compteEtudiantId) {
    await Notification.create({
      utilisateurId: eleve.compteEtudiantId, dateEnvoi: new Date(),
      contenu: statut === 'valide' ? 'Votre dossier de bourse ANBG est validé par l’établissement.' : `Dossier de bourse ANBG à corriger : ${String(observations).trim()}`.slice(0, 250),
    }).catch(() => {});
  }
  await journaliserAudit(req, { action: 'dossier_bourse', cible: eleve.matricule || String(eleve.id), details: { statut } });
  return res.json(await vueDossier(dossier));
}

// Liste des boursiers à transmettre à l'ANBG (Excel).
async function exporter(req, res) {
  const dossiers = await DossierBourse.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, include: [{ model: Eleve, include: [Classe] }], order: [['statut', 'ASC']] });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const LIB = { incomplet: 'Incomplet', soumis: 'Soumis', a_corriger: 'À corriger', valide: 'Validé' };
  const lignes = dossiers.map((d) => ({
    'N° boursier ANBG': d.numeroBoursier || '', Matricule: d.Eleve?.matricule || '', Nom: d.Eleve?.nom || '', 'Prénom': d.Eleve?.prenom || '',
    'Date de naissance': d.Eleve?.dateNaissance || '', Classe: d.Eleve?.Classe?.nom || '', Niveau: d.Eleve?.Classe?.niveau || '',
    'Établissement': etablissement.nom, 'Statut du dossier': LIB[d.statut], 'Validé le': d.valideLe ? new Date(d.valideLe).toLocaleDateString('fr-FR') : '',
  }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ 'N° boursier ANBG': 'Aucun dossier' }]), 'Boursiers ANBG');
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="boursiers-anbg-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Access-Control-Expose-Headers': 'Content-Disposition' });
  return res.send(XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }));
}

module.exports = {
  monDossier, majMonDossier, deposerMaPiece, genererPiece, retirerMaPiece, soumettre, telechargerPiece,
  listerDossiers, dossierEtudiant, deposerPourEtudiant, examinerPiece, deciderDossier, exporter, TYPES,
};
