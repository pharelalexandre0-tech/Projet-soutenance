const XLSX = require('xlsx');
const { Op } = require('sequelize');
const { Eleve, Classe, DossierBourse, PieceBourse, Semestre } = require('../models');
const { sha256 } = require('../utils/chiffrement');
const { obtenirEtablissementDe } = require('../services/etablissementService');

// Dossier de bourse ANBG (Agence nationale des bourses du Gabon) :
// l'étudiant prépare son dossier et l'envoie à l'agence.
// L'Académie ne voit que la liste de ses boursiers (et son export Excel).

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
  if (['soumis', 'valide'].includes(dossier.statut)) return res.status(409).json({ erreur: 'dossier déjà envoyé à l’ANBG' });
  await dossier.update({ statut: 'soumis', soumisLe: new Date() });
  return res.json(await vueDossier(dossier));
}

// Téléchargement d'une pièce, par l'étudiant seulement. Toujours en pièce
// jointe, jamais interprété par le navigateur.
async function telechargerPiece(req, res) {
  const piece = await PieceBourse.scope('avecContenu').findByPk(req.params.id);
  const autorise = Boolean(piece) && Boolean(await Eleve.count({ where: { id: piece.eleveId, compteEtudiantId: req.utilisateur.id } }));
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
// Boursiers de l'établissement : étudiants ayant renseigné un numéro de
// boursier ANBG. Ni pièces ni décision : l'Académie consulte, c'est tout.
async function listerBoursiers(req, res) {
  const dossiers = await DossierBourse.findAll({
    where: { etablissementId: req.utilisateur.etablissementId, numeroBoursier: { [Op.ne]: null } },
    include: [{ model: Eleve, include: [Classe] }],
    order: [[Eleve, 'nom', 'ASC'], [Eleve, 'prenom', 'ASC']],
  });
  return res.json({
    boursiers: dossiers.filter((d) => d.Eleve && String(d.numeroBoursier).trim()).map((d) => ({
      eleveId: d.eleveId, nom: d.Eleve.nom, prenom: d.Eleve.prenom, matricule: d.Eleve.matricule,
      classe: d.Eleve.Classe?.nom || '', niveau: d.Eleve.Classe?.niveau || '',
      numeroBoursier: d.numeroBoursier, envoye: ['soumis', 'valide'].includes(d.statut), envoyeLe: d.soumisLe,
    })),
  });
}

// Liste des boursiers à transmettre à l'ANBG (Excel).
async function exporter(req, res) {
  const dossiers = (await DossierBourse.findAll({
    where: { etablissementId: req.utilisateur.etablissementId, numeroBoursier: { [Op.ne]: null } },
    include: [{ model: Eleve, include: [Classe] }],
    order: [[Eleve, 'nom', 'ASC'], [Eleve, 'prenom', 'ASC']],
  })).filter((d) => d.Eleve);
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);

  const lignes = dossiers.map((d) => ({
    'N° boursier ANBG': d.numeroBoursier || '', Matricule: d.Eleve?.matricule || '', Nom: d.Eleve?.nom || '', 'Prénom': d.Eleve?.prenom || '',
    'Date de naissance': d.Eleve?.dateNaissance || '', Classe: d.Eleve?.Classe?.nom || '', Niveau: d.Eleve?.Classe?.niveau || '',
    'Établissement': etablissement.nom,
    'Dossier ANBG': ['soumis', 'valide'].includes(d.statut) ? 'Envoyé' : 'En préparation',
    'Envoyé le': d.soumisLe ? new Date(d.soumisLe).toLocaleDateString('fr-FR') : '',
  }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ 'N° boursier ANBG': 'Aucun boursier' }]), 'Boursiers ANBG');
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="boursiers-anbg-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Access-Control-Expose-Headers': 'Content-Disposition' });
  return res.send(XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }));
}

module.exports = {
  monDossier, majMonDossier, deposerMaPiece, genererPiece, retirerMaPiece, soumettre, telechargerPiece,
  listerBoursiers, exporter, TYPES,
};
