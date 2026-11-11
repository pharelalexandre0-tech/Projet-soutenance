const crypto = require('crypto');
const { Op } = require('sequelize');
const { Preinscription, PieceCandidature, Etablissement, Formation, Classe } = require('../models');
const { envoyerEmail } = require('../services/emailService');
const { fonctionnaliteOuverte } = require('../services/plateformeService');
const { journaliserAudit } = require('../services/auditService');

// Candidatures en ligne (préinscription) : dépôt selon le profil du
// candidat (nouveau bachelier, étudiant en Licence, candidat en Master),
// suivi public du dossier (numéro + e-mail), e-mail à chaque étape et
// décisions de l'Académie, une par une ou en lot.

const FRONTEND = (process.env.FRONTEND_URL || 'https://edusphere-frontend-pryg.onrender.com').replace(/\/$/, '');
const erreur = (message, status = 400) => Object.assign(new Error(message), { status });
const texte = (v, max = 200) => String(v ?? '').trim().slice(0, max) || null;
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();

const PROFILS = {
  bachelier: { libelle: 'Nouveau bachelier', niveaux: ['Licence 1'], cycle: 'licence' },
  licence: { libelle: 'Étudiant en Licence', niveaux: ['Licence 2', 'Licence 3'], cycle: 'licence' },
  master: { libelle: 'Candidat en Master', niveaux: ['Master 1', 'Master 2'], cycle: 'master' },
};
const PIECES = {
  identite: 'Pièce d’identité', naissance: 'Acte de naissance', photo: 'Photo d’identité', diplome: 'Diplôme',
  releve: 'Relevé de notes', cv: 'CV', motivation: 'Lettre de motivation', autre: 'Autre pièce',
};
// Pièces demandées selon le profil (les obligatoires d'abord).
const PIECES_PROFIL = {
  bachelier: { obligatoires: ['releve', 'naissance', 'photo'], facultatives: ['identite', 'diplome'] },
  licence: { obligatoires: ['releve', 'diplome', 'photo'], facultatives: ['identite', 'naissance'] },
  master: { obligatoires: ['diplome', 'releve', 'cv'], facultatives: ['motivation', 'photo', 'identite'] },
};
const TYPES_FICHIER = ['application/pdf', 'image/jpeg', 'image/png'];
const SIGNATURES = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xFF, 0xD8, 0xFF], 'image/png': [0x89, 0x50, 0x4E, 0x47] };
const TAILLE_MAX = 2 * 1024 * 1024;
const MAX_PIECES = 8;

// Étapes visibles par le candidat sur sa page de suivi.
const ETAPES = [
  ['deposee', 'Dossier déposé'], ['en_examen', 'En étude'], ['acceptee', 'Accepté'], ['frais', 'Inscription en ligne'], ['inscrite', 'Inscrit'],
];
const EXPLICATIONS = {
  deposee: 'Votre dossier est bien arrivé. L’établissement va l’étudier ; vous recevrez un e-mail à chaque étape.',
  en_examen: 'L’établissement étudie votre dossier. Aucune action n’est attendue de votre part pour l’instant.',
  piece_demandee: 'L’établissement vous demande une pièce : ajoutez-la ci-dessous pour que l’étude reprenne.',
  liste_attente: 'Votre dossier est sur liste d’attente : une place peut se libérer. Vous serez prévenu par e-mail.',
  acceptee: 'Félicitations, votre candidature est acceptée. Finalisez votre inscription en ligne avec le lien reçu par e-mail.',
  refusee: 'Votre candidature n’a pas été retenue.',
  inscrite: 'Votre inscription est terminée : vos identifiants vous ont été envoyés par e-mail.',
};

function lienSuivi(numero) {
  return `${FRONTEND}/preinscription/suivi?numero=${encodeURIComponent(numero)}`;
}

async function prevenir(dossier, sujet, message) {
  const ecole = await Etablissement.findByPk(dossier.etablissementId, { attributes: ['nom'] });
  return envoyerEmail(dossier.email, `${sujet} : ${dossier.numero}`,
    `Bonjour ${dossier.prenom},\n\n${message.replace('{ecole}', ecole.nom)}\n\nSuivre votre dossier (numéro ${dossier.numero} et votre adresse e-mail) :\n${lienSuivi(dossier.numero)}\n`).catch(() => {});
}

// Pièces jointes envoyées en data URI : type, signature et taille vérifiés.
function lirePieces(liste, max) {
  const pieces = Array.isArray(liste) ? liste.slice(0, max) : [];
  return pieces.map((p) => {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(p.contenu || ''));
    if (!m || !TYPES_FICHIER.includes(m[1])) throw erreur('chaque pièce doit être un PDF, un JPEG ou un PNG');
    const contenu = Buffer.from(m[2], 'base64');
    if (!SIGNATURES[m[1]].every((o, i) => contenu[i] === o)) throw erreur(`le fichier « ${String(p.nomFichier || '').slice(0, 60)} » n’est pas un vrai ${m[1] === 'application/pdf' ? 'PDF' : 'fichier image'}`);
    if (contenu.length > TAILLE_MAX) throw erreur('chaque pièce doit faire moins de 2 Mo');
    return { type: PIECES[p.type] ? p.type : 'autre', nomFichier: texte(p.nomFichier, 200) || 'piece', typeMime: m[1], taille: contenu.length, contenu };
  });
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
async function offres(req, res) {
  const ecoles = await Etablissement.findAll({ where: { statut: 'actif' }, attributes: ['id', 'nom', 'sigle', 'ville', 'logo'], order: [['nom', 'ASC']] });
  const ouvertes = [];
  for (const e of ecoles) {
    if (!(await fonctionnaliteOuverte('preinscription', e.id))) continue;
    const formations = await Formation.findAll({ where: { etablissementId: e.id }, attributes: ['id', 'cycle', 'mention', 'parcours'], order: [['cycle', 'ASC'], ['mention', 'ASC']] });
    ouvertes.push({ ...e.toJSON(), formations });
  }
  return res.json({
    etablissements: ouvertes,
    profils: Object.entries(PROFILS).map(([cle, p]) => ({ cle, ...p, pieces: PIECES_PROFIL[cle] })),
    pieces: PIECES,
  });
}

async function deposer(req, res) {
  const b = req.body || {};
  if (b.siteWeb) return res.status(201).json({ numero: 'PRE-OK' }); // champ piège anti-robots
  const profil = PROFILS[b.profil] ? b.profil : null;
  if (!profil) throw erreur('choisissez votre profil : nouveau bachelier, étudiant en Licence ou candidat en Master');
  const etablissementId = Number(b.etablissementId);
  if (!(await fonctionnaliteOuverte('preinscription', etablissementId))) throw erreur('cet établissement n’accepte pas de candidature en ligne', 404);
  const email = String(b.email || '').trim().toLowerCase();
  if (!texte(b.nom) || !texte(b.prenom) || !/^\S+@\S+\.\S+$/.test(email)) throw erreur('nom, prénom et e-mail sont obligatoires');
  if (!PROFILS[profil].niveaux.includes(b.niveauDemande)) throw erreur('niveau demandé incompatible avec votre profil');
  const recente = await Preinscription.count({ where: { email, etablissementId, createdAt: { [Op.gt]: new Date(Date.now() - 24 * 3600 * 1000) } } });
  if (recente >= 3) throw erreur('trop de dossiers déposés avec cette adresse aujourd’hui', 429);
  let formationId = null;
  if (b.formationId) {
    const f = await Formation.findOne({ where: { id: b.formationId, etablissementId } });
    if (!f) throw erreur('formation introuvable');
    formationId = f.id;
  }
  // Champs propres au profil.
  const champs = {};
  if (profil === 'bachelier') {
    if (!texte(b.serieBac) || !texte(b.anneeDiplome)) throw erreur('indiquez la série et l’année de votre baccalauréat');
    Object.assign(champs, { serieBac: texte(b.serieBac, 10), numeroTable: texte(b.numeroTable, 30), diplomeAcces: `Baccalauréat série ${texte(b.serieBac, 10)}` });
  } else if (profil === 'licence') {
    if (!texte(b.etablissementOrigine) || !texte(b.dernierNiveauValide)) throw erreur('indiquez votre établissement actuel et le dernier niveau validé');
    const credits = Number(b.creditsAcquis);
    Object.assign(champs, {
      filiereActuelle: texte(b.filiereActuelle, 160), dernierNiveauValide: texte(b.dernierNiveauValide, 40),
      creditsAcquis: Number.isInteger(credits) && credits >= 0 && credits <= 240 ? credits : null, diplomeAcces: texte(b.diplomeAcces, 160) || 'Baccalauréat',
    });
  } else {
    if (!texte(b.specialiteLicence) || !texte(b.anneeDiplome)) throw erreur('indiquez la spécialité et l’année de votre licence');
    const moyenne = Number(String(b.moyenneDiplome || '').replace(',', '.'));
    Object.assign(champs, {
      specialiteLicence: texte(b.specialiteLicence, 160), diplomeAcces: texte(b.diplomeAcces, 160) || `Licence ${texte(b.specialiteLicence, 120)}`,
      moyenneDiplome: Number.isFinite(moyenne) && moyenne >= 0 && moyenne <= 20 ? moyenne : null, motivation: texte(b.motivation, 3000),
    });
  }
  const fichiers = lirePieces(b.pieces, MAX_PIECES);
  const manquantes = PIECES_PROFIL[profil].obligatoires.filter((t) => !fichiers.some((f) => f.type === t));
  if (manquantes.length) throw erreur(`pièce obligatoire manquante : ${manquantes.map((t) => PIECES[t].toLowerCase()).join(', ')}`);
  const numero = `PRE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const dossier = await Preinscription.create({
    etablissementId, numero, formationId, profil, niveauDemande: b.niveauDemande, nom: texte(b.nom, 120), prenom: texte(b.prenom, 120),
    dateNaissance: /^\d{4}-\d{2}-\d{2}$/.test(b.dateNaissance || '') ? b.dateNaissance : null, sexe: ['F', 'M'].includes(b.sexe) ? b.sexe : null,
    email, telephone: texte(b.telephone, 30), nationalite: texte(b.nationalite, 80), villeResidence: texte(b.villeResidence, 80),
    anneeDiplome: texte(b.anneeDiplome, 9), mentionDiplome: texte(b.mentionDiplome, 40), etablissementOrigine: texte(b.etablissementOrigine, 200),
    ...champs,
  });
  for (const f of fichiers) await PieceCandidature.create({ ...f, preinscriptionId: dossier.id });
  await prevenir(dossier, 'Candidature reçue', `Votre candidature à {ecole} (${dossier.niveauDemande}) a bien été reçue. L’établissement va l’étudier et vous préviendra par e-mail à chaque étape.`);
  return res.status(201).json({ numero, lienSuivi: lienSuivi(numero) });
}

// Retrouve un dossier par son numéro ET l'adresse du candidat.
async function dossierDuCandidat(b) {
  const numero = String(b.numero || '').trim().toUpperCase();
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^PRE-\d{4}-[0-9A-F]{6}$/.test(numero) || !email) throw erreur('saisissez le numéro de dossier et l’adresse e-mail utilisée lors du dépôt');
  const dossier = await Preinscription.findOne({ where: { numero, email } });
  if (!dossier) throw erreur('aucun dossier ne correspond à ce numéro et à cette adresse', 404);
  return dossier;
}

async function vueSuivi(dossier) {
  const [ecole, classe, pieces] = await Promise.all([
    Etablissement.findByPk(dossier.etablissementId, { attributes: ['nom', 'sigle', 'ville', 'logo', 'email', 'telephone'] }),
    dossier.classeId ? Classe.findByPk(dossier.classeId, { attributes: ['nom', 'niveau'] }) : null,
    PieceCandidature.findAll({ where: { preinscriptionId: dossier.id }, attributes: ['type', 'nomFichier', 'createdAt'] }),
  ]);
  // Étape atteinte : les statuts de côté (pièce demandée, liste d'attente,
  // refus) restent sur « En étude ».
  const rang = { deposee: 0, en_examen: 1, piece_demandee: 1, liste_attente: 1, refusee: 1, acceptee: 2, inscrite: 4 }[dossier.statut] ?? 0;
  const atteinte = dossier.statut === 'acceptee' && dossier.paiementStatut && dossier.paiementStatut !== 'non_requis' ? 3 : rang;
  return {
    numero: dossier.numero, prenom: dossier.prenom, nom: dossier.nom, profil: PROFILS[dossier.profil]?.libelle || null,
    niveauDemande: dossier.niveauDemande, deposeLe: dossier.createdAt, statut: dossier.statut, explication: EXPLICATIONS[dossier.statut],
    etapes: ETAPES.map(([cle, libelle], i) => ({ cle, libelle, etat: i < atteinte ? 'faite' : i === atteinte ? (dossier.statut === 'refusee' ? 'refusee' : 'en_cours') : 'a_venir' })),
    message: dossier.commentaire || null, pieceDemandee: dossier.statut === 'piece_demandee' ? dossier.pieceDemandee : null,
    ecole, classe, pieces: pieces.map((p) => ({ type: PIECES[p.type] || p.type, nomFichier: p.nomFichier, ajouteeLe: p.createdAt })),
    peutRecevoirLien: dossier.statut === 'acceptee',
  };
}

async function suivre(req, res) {
  return res.json({ dossier: await vueSuivi(await dossierDuCandidat(req.body)) });
}

// Le candidat ajoute la pièce demandée : l'étude reprend.
async function completer(req, res) {
  const dossier = await dossierDuCandidat(req.body);
  if (!['piece_demandee', 'deposee', 'en_examen'].includes(dossier.statut)) throw erreur('ce dossier ne peut plus être complété');
  const fichiers = lirePieces(req.body.pieces, 4);
  if (!fichiers.length) throw erreur('ajoutez au moins une pièce');
  const deja = await PieceCandidature.count({ where: { preinscriptionId: dossier.id } });
  if (deja + fichiers.length > 12) throw erreur('le dossier contient déjà trop de pièces');
  for (const f of fichiers) await PieceCandidature.create({ ...f, preinscriptionId: dossier.id });
  if (dossier.statut === 'piece_demandee') await dossier.update({ statut: 'en_examen', pieceDemandee: null });
  return res.json({ dossier: await vueSuivi(dossier) });
}

// Lien d'inscription perdu : un nouveau est envoyé à l'adresse du dossier.
async function renvoyerLien(req, res) {
  const dossier = await dossierDuCandidat(req.body);
  if (dossier.statut !== 'acceptee' || !dossier.classeId) throw erreur('aucun lien d’inscription à renvoyer pour ce dossier');
  await require('./inscriptionEnLigneController').ouvrirInscription(dossier, { classeId: dossier.classeId, fraisInscription: dossier.fraisInscription });
  return res.json({ envoye: true });
}

// ---------------------------------------------------------------------------
// Académie
// ---------------------------------------------------------------------------
const MESSAGES = {
  en_examen: ['Candidature en étude', 'L’établissement {ecole} étudie votre dossier.'],
  liste_attente: ['Candidature sur liste d’attente', 'Votre dossier à {ecole} est placé sur liste d’attente. Vous serez prévenu si une place se libère.'],
  refusee: ['Candidature non retenue', 'Votre candidature à {ecole} n’a pas été retenue.'],
};

// Applique une décision à un dossier et prévient le candidat.
async function appliquer(dossier, corps, agent) {
  const statut = corps.statut;
  if (dossier.statut === 'inscrite') throw erreur(`${dossier.prenom} ${dossier.nom} est déjà inscrit(e)`);
  const commentaire = texte(corps.commentaire, 2000);
  if (statut === 'piece_demandee') {
    const piece = texte(corps.pieceDemandee, 500);
    if (!piece) throw erreur('précisez la pièce demandée');
    await dossier.update({ statut, pieceDemandee: piece, commentaire, decideParNom: agent });
    await prevenir(dossier, 'Pièce demandée pour votre candidature', `L’établissement {ecole} a besoin d’une pièce pour étudier votre dossier :\n${piece}\n\nAjoutez-la depuis la page de suivi.`);
    return;
  }
  if (statut === 'acceptee') {
    // La classe est vérifiée avant tout changement : pas de dossier « accepté » sans lien.
    const classe = corps.classeId ? await Classe.findOne({ where: { id: Number(corps.classeId) || 0, etablissementId: dossier.etablissementId } }) : null;
    if (!classe) throw erreur('choisissez la classe dans laquelle le candidat sera inscrit');
    await dossier.update({ statut, commentaire, decideParNom: agent, pieceDemandee: null });
    await require('./inscriptionEnLigneController').ouvrirInscription(dossier, { ...corps, classeId: classe.id });
    return;
  }
  await dossier.update({ statut, commentaire, decideParNom: agent, pieceDemandee: null });
  const [sujet, message] = MESSAGES[statut];
  await prevenir(dossier, sujet, `${message}${commentaire ? `\n\n${statut === 'refusee' ? 'Motif : ' : ''}${commentaire}` : ''}`);
}

const STATUTS_DECISION = ['en_examen', 'piece_demandee', 'liste_attente', 'acceptee', 'refusee'];

async function decider(req, res) {
  const dossier = await Preinscription.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!dossier) throw erreur('dossier introuvable', 404);
  if (!STATUTS_DECISION.includes(req.body.statut)) throw erreur('décision invalide');
  await appliquer(dossier, req.body, nomAgent(req.utilisateur));
  await journaliserAudit(req, { action: 'candidature_decision', cible: dossier.numero, details: { statut: req.body.statut }, etablissementId: dossier.etablissementId });
  return res.json({ dossier });
}

// Même décision pour plusieurs dossiers cochés.
async function deciderLot(req, res) {
  const { ids, statut } = req.body || {};
  if (!STATUTS_DECISION.includes(statut)) throw erreur('décision invalide');
  const liste = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
  if (!liste.length) throw erreur('sélectionnez au moins un dossier');
  if (liste.length > 300) throw erreur('300 dossiers au plus à la fois');
  const dossiers = await Preinscription.findAll({ where: { id: liste, etablissementId: req.utilisateur.etablissementId } });
  if (dossiers.length !== liste.length) throw erreur('un des dossiers est introuvable', 404);
  const agent = nomAgent(req.utilisateur);
  const resultats = [];
  for (const d of dossiers) {
    try {
      await appliquer(d, req.body, agent);
      resultats.push({ id: d.id, ok: true });
    } catch (e) {
      if (!e.status) throw e;
      resultats.push({ id: d.id, ok: false, message: e.message });
    }
  }
  await journaliserAudit(req, { action: 'candidature_decision_lot', cible: `${dossiers.length} dossiers`, details: { statut }, etablissementId: req.utilisateur.etablissementId });
  return res.json({ traites: resultats.filter((r) => r.ok).length, echecs: resultats.filter((r) => !r.ok) });
}

module.exports = { offres, deposer, suivre, completer, renvoyerLien, decider, deciderLot, PROFILS, PIECES };
