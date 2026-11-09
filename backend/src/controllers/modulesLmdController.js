const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  Preinscription, PieceCandidature, NumeroAnonymat, Memoire, Diplome, CreditExterne,
  Etablissement, Formation, Classe, Eleve, Utilisateur, Matiere, UniteEnseignement, Semestre, Note,
} = require('../models');
const { calculerParcours } = require('../services/moyenneService');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { journaliserAudit } = require('../services/auditService');
const { envoyerEmail } = require('../services/emailService');
const { attribuerMatricule } = require('../services/matriculeService');
const { motDePasseAleatoire } = require('../utils/tokenGenerator');
const { fonctionnaliteOuverte } = require('../services/plateformeService');
const { diplomePDF, supplementPDF, pvSoutenancePDF, GRADES } = require('../services/documentsLmdService');
const { outils } = require('../services/pdfService');

const erreur = (message, status = 400) => Object.assign(new Error(message), { status });
const nomAgent = (u) => `${u.prenom} ${u.nom}`.trim();
const texte = (v, max = 200) => String(v ?? '').trim().slice(0, max) || null;
function envoyerPdf(res, pdf, nom) {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nom}.pdf"`, 'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'private, no-store' });
  return res.send(pdf);
}
async function eleveDeLEcole(id, etablissementId) {
  const eleve = await Eleve.findOne({ where: { id, etablissementId }, include: [Classe] });
  if (!eleve) throw erreur('étudiant introuvable', 404);
  return eleve;
}

// =========================================================================
// Préinscription en ligne
// =========================================================================
const PIECES = { identite: 'Pièce d’identité', diplome: 'Diplôme d’accès', releve: 'Relevé de notes', photo: 'Photo', autre: 'Autre pièce' };
const TYPES_FICHIER = ['application/pdf', 'image/jpeg', 'image/png'];
const TAILLE_MAX = 2 * 1024 * 1024;

// Public : établissements ouverts à la préinscription et leurs formations.
async function offresPubliques(req, res) {
  const ecoles = await Etablissement.findAll({ where: { statut: 'actif' }, attributes: ['id', 'nom', 'sigle', 'ville', 'logo'], order: [['nom', 'ASC']] });
  const ouvertes = [];
  for (const e of ecoles) {
    if (!(await fonctionnaliteOuverte('preinscription', e.id))) continue;
    const formations = await Formation.findAll({ where: { etablissementId: e.id }, attributes: ['id', 'cycle', 'mention', 'parcours'], order: [['cycle', 'ASC'], ['mention', 'ASC']] });
    ouvertes.push({ ...e.toJSON(), formations });
  }
  return res.json({ etablissements: ouvertes });
}

async function deposer(req, res) {
  const b = req.body || {};
  if (b.siteWeb) return res.status(201).json({ numero: 'PRE-OK' }); // champ piège anti-robots
  const etablissementId = Number(b.etablissementId);
  if (!(await fonctionnaliteOuverte('preinscription', etablissementId))) throw erreur('cet établissement n’accepte pas de préinscription en ligne', 404);
  const email = String(b.email || '').trim().toLowerCase();
  if (!texte(b.nom) || !texte(b.prenom) || !/^\S+@\S+\.\S+$/.test(email) || !texte(b.niveauDemande)) throw erreur('nom, prénom, e-mail et niveau demandé sont obligatoires');
  const recente = await Preinscription.count({ where: { email, etablissementId, createdAt: { [Op.gt]: new Date(Date.now() - 24 * 3600 * 1000) } } });
  if (recente >= 3) throw erreur('trop de dossiers déposés avec cette adresse aujourd’hui', 429);
  let formationId = null;
  if (b.formationId) {
    const f = await Formation.findOne({ where: { id: b.formationId, etablissementId } });
    if (!f) throw erreur('formation introuvable');
    formationId = f.id;
  }
  const pieces = Array.isArray(b.pieces) ? b.pieces.slice(0, 4) : [];
  const fichiers = [];
  for (const p of pieces) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(p.contenu || ''));
    if (!m || !TYPES_FICHIER.includes(m[1])) throw erreur('chaque pièce doit être un PDF, un JPEG ou un PNG');
    const contenu = Buffer.from(m[2], 'base64');
    if (contenu.length > TAILLE_MAX) throw erreur('chaque pièce doit faire moins de 2 Mo');
    fichiers.push({ type: PIECES[p.type] ? p.type : 'autre', nomFichier: texte(p.nomFichier, 200) || 'piece', typeMime: m[1], taille: contenu.length, contenu });
  }
  const numero = `PRE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const dossier = await Preinscription.create({
    etablissementId, numero, formationId, niveauDemande: texte(b.niveauDemande, 40), nom: texte(b.nom, 120), prenom: texte(b.prenom, 120),
    dateNaissance: /^\d{4}-\d{2}-\d{2}$/.test(b.dateNaissance || '') ? b.dateNaissance : null, sexe: ['F', 'M'].includes(b.sexe) ? b.sexe : null,
    email, telephone: texte(b.telephone, 30), nationalite: texte(b.nationalite, 80), diplomeAcces: texte(b.diplomeAcces, 160),
    anneeDiplome: texte(b.anneeDiplome, 9), mentionDiplome: texte(b.mentionDiplome, 40), etablissementOrigine: texte(b.etablissementOrigine, 200),
  });
  for (const f of fichiers) await PieceCandidature.create({ ...f, preinscriptionId: dossier.id });
  const ecole = await Etablissement.findByPk(etablissementId, { attributes: ['nom'] });
  envoyerEmail(email, `Préinscription reçue : ${numero}`, `Bonjour ${dossier.prenom},\n\nVotre dossier de préinscription à ${ecole.nom} a bien été reçu sous le numéro ${numero}. L’établissement vous répondra par e-mail après examen.\n`).catch(() => {});
  return res.status(201).json({ numero });
}

async function listerPreinscriptions(req, res) {
  const dossiers = await Preinscription.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, order: [['createdAt', 'DESC']], limit: 500 });
  const pieces = dossiers.length ? await PieceCandidature.findAll({ where: { preinscriptionId: dossiers.map((d) => d.id) }, attributes: ['id', 'preinscriptionId', 'type', 'nomFichier', 'typeMime', 'taille'] }) : [];
  const formations = await Formation.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, attributes: ['id', 'cycle', 'mention', 'parcours'] });
  return res.json({ dossiers: dossiers.map((d) => ({ ...d.toJSON(), pieces: pieces.filter((p) => p.preinscriptionId === d.id) })), formations });
}

async function telechargerPiece(req, res) {
  const piece = await PieceCandidature.findByPk(req.params.id);
  const dossier = piece && await Preinscription.findOne({ where: { id: piece.preinscriptionId, etablissementId: req.utilisateur.etablissementId } });
  if (!dossier) throw erreur('pièce introuvable', 404);
  res.set({ 'Content-Type': piece.typeMime, 'Content-Disposition': `inline; filename="${encodeURIComponent(piece.nomFichier)}"`, 'Cache-Control': 'private, no-store' });
  return res.send(piece.contenu);
}

async function deciderPreinscription(req, res) {
  const dossier = await Preinscription.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!dossier) throw erreur('dossier introuvable', 404);
  const statut = ['en_examen', 'acceptee', 'refusee'].includes(req.body.statut) ? req.body.statut : null;
  if (!statut) throw erreur('décision invalide');
  if (dossier.statut === 'inscrite') throw erreur('ce candidat est déjà inscrit');
  await dossier.update({ statut, commentaire: texte(req.body.commentaire, 2000), decideParNom: nomAgent(req.utilisateur) });
  if (statut !== 'en_examen') {
    const ecole = await Etablissement.findByPk(dossier.etablissementId, { attributes: ['nom'] });
    const corps = statut === 'acceptee'
      ? `Bonjour ${dossier.prenom},\n\nVotre préinscription ${dossier.numero} à ${ecole.nom} est acceptée. L’établissement vous contactera pour finaliser votre inscription.${dossier.commentaire ? `\n\n${dossier.commentaire}` : ''}\n`
      : `Bonjour ${dossier.prenom},\n\nVotre préinscription ${dossier.numero} à ${ecole.nom} n’a pas été retenue.${dossier.commentaire ? `\n\nMotif : ${dossier.commentaire}` : ''}\n`;
    envoyerEmail(dossier.email, `Préinscription ${dossier.numero} : ${statut === 'acceptee' ? 'acceptée' : 'non retenue'}`, corps).catch(() => {});
  }
  return res.json({ dossier });
}

// Candidat accepté -> étudiant inscrit dans une classe (compte et matricule créés).
async function inscrireCandidat(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const dossier = await Preinscription.findOne({ where: { id: req.params.id, etablissementId } });
  if (!dossier) throw erreur('dossier introuvable', 404);
  if (dossier.statut !== 'acceptee') throw erreur('seul un dossier accepté peut être inscrit');
  const classe = await Classe.findOne({ where: { id: req.body.classeId, etablissementId } });
  if (!classe) throw erreur('choisissez la classe d’inscription');
  await require('../services/parametrageEcoleService').verifierQuotaEtudiants(etablissementId);
  if (await Utilisateur.findOne({ where: { email: dossier.email } })) throw erreur('un compte existe déjà avec l’adresse e-mail du candidat');
  const compte = await Utilisateur.create({ nom: dossier.nom, prenom: dossier.prenom, email: dossier.email, motDePasse: await bcrypt.hash(motDePasseAleatoire(), 10), role: 'etudiant', etablissementId });
  const eleve = await Eleve.create({ nom: dossier.nom, prenom: dossier.prenom, dateNaissance: dossier.dateNaissance, sexe: dossier.sexe, classeId: classe.id, compteEtudiantId: compte.id, etablissementId });
  await attribuerMatricule(eleve);
  await dossier.update({ statut: 'inscrite', eleveId: eleve.id, decideParNom: nomAgent(req.utilisateur) });
  await journaliserAudit(req, { action: 'preinscription_inscrite', cible: dossier.numero, etablissementId });
  return res.status(201).json({ eleve, dossier });
}

// =========================================================================
// Anonymat des copies
// =========================================================================
async function matiereDeLEcole(matiereId, etablissementId) {
  const m = await Matiere.findByPk(matiereId, { include: [{ model: UniteEnseignement, include: [Semestre] }] });
  if (!m || m.UniteEnseignement?.Semestre?.etablissementId !== etablissementId) throw erreur('matière introuvable', 404);
  return m;
}
const sessionDe = (s) => (s === 'rattrapage' ? 'rattrapage' : 'normale');

async function listeAnonymat(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  await matiereDeLEcole(req.query.matiereId, etablissementId);
  const lignes = await NumeroAnonymat.findAll({ where: { matiereId: req.query.matiereId, session: sessionDe(req.query.session), etablissementId }, include: [{ model: Eleve, attributes: ['id', 'nom', 'prenom', 'matricule', 'classeId'] }], order: [['numero', 'ASC']] });
  const leve = lignes.some((l) => l.leveLe);
  const notes = await Note.findAll({ where: { matiereId: req.query.matiereId, session: sessionDe(req.query.session), eleveId: lignes.map((l) => l.eleveId) }, attributes: ['eleveId', 'moyenneExamen'] });
  const parEleve = new Map(notes.map((n) => [n.eleveId, n.moyenneExamen]));
  return res.json({
    leve,
    lignes: lignes.map((l) => ({ numero: l.numero, eleveId: l.eleveId, moyenneExamen: parEleve.get(l.eleveId) ?? null, ...(req.query.correspondance === '1' || leve ? { eleve: l.Eleve } : {}) })),
  });
}

async function genererAnonymat(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const matiere = await matiereDeLEcole(req.body.matiereId, etablissementId);
  const session = sessionDe(req.body.session);
  const classe = await Classe.findOne({ where: { id: req.body.classeId, etablissementId } });
  if (!classe) throw erreur('classe introuvable');
  const eleves = await Eleve.findAll({ where: { classeId: classe.id }, attributes: ['id'] });
  const existants = await NumeroAnonymat.findAll({ where: { matiereId: matiere.id, session } });
  const pris = new Set(existants.map((e) => e.numero));
  const deja = new Set(existants.map((e) => e.eleveId));
  let crees = 0;
  for (const e of eleves) {
    if (deja.has(e.id)) continue;
    let numero;
    do { numero = String(crypto.randomInt(10000, 99999)); } while (pris.has(numero));
    pris.add(numero);
    await NumeroAnonymat.create({ etablissementId, matiereId: matiere.id, session, eleveId: e.id, numero });
    crees += 1;
  }
  return res.status(201).json({ crees, total: existants.length + crees });
}

// Notes d'examen saisies par numéro, sans voir les noms.
async function saisirParNumero(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const matiere = await matiereDeLEcole(req.body.matiereId, etablissementId);
  const session = sessionDe(req.body.session);
  const saisies = Array.isArray(req.body.notes) ? req.body.notes : [];
  const numeros = await NumeroAnonymat.findAll({ where: { matiereId: matiere.id, session } });
  const parNumero = new Map(numeros.map((n) => [n.numero, n.eleveId]));
  const { enregistrerMoyenne } = require('./notesController');
  let enregistrees = 0;
  const inconnus = [];
  for (const s of saisies) {
    const eleveId = parNumero.get(String(s.numero).trim());
    if (!eleveId) { inconnus.push(s.numero); continue; }
    if (s.valeur === '' || s.valeur == null) continue;
    await enregistrerMoyenne({ eleveId, matiereId: matiere.id, categorie: 'examen', valeur: s.valeur, session, saisiParAcademieId: req.utilisateur.id, etablissementId });
    enregistrees += 1;
  }
  return res.json({ enregistrees, inconnus });
}

async function leverAnonymat(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const matiere = await matiereDeLEcole(req.body.matiereId, etablissementId);
  const [n] = await NumeroAnonymat.update({ leveLe: new Date() }, { where: { matiereId: matiere.id, session: sessionDe(req.body.session), leveLe: null } });
  await journaliserAudit(req, { action: 'anonymat_leve', cible: matiere.code || matiere.intitule, etablissementId });
  return res.json({ leves: n });
}

// =========================================================================
// Mémoires, soutenances, thèses
// =========================================================================
const QUALITES = ['Président', 'Rapporteur', 'Examinateur', 'Encadrant', 'Membre invité'];
function validerJury(type, jury) {
  const liste = (Array.isArray(jury) ? jury : []).map((j) => ({ nom: texte(j.nom, 160), qualite: QUALITES.includes(j.qualite) ? j.qualite : 'Examinateur' })).filter((j) => j.nom);
  if (type === 'these') {
    if (liste.length < 3 || liste.length > 5) throw erreur('le jury d’une thèse compte de 3 à 5 membres');
    if (liste.filter((j) => j.qualite === 'Rapporteur').length < 2) throw erreur('une thèse demande au moins deux rapporteurs');
  }
  return liste;
}

async function listerMemoires(req, res) {
  const memoires = await Memoire.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, include: [{ model: Eleve, attributes: ['id', 'nom', 'prenom', 'matricule'], include: [{ model: Classe, attributes: ['nom', 'niveau'] }] }], order: [['updatedAt', 'DESC']] });
  return res.json({ memoires });
}

async function enregistrerMemoire(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const b = req.body || {};
  const memoire = req.params.id ? await Memoire.findOne({ where: { id: req.params.id, etablissementId } }) : null;
  if (req.params.id && !memoire) throw erreur('mémoire introuvable', 404);
  const eleve = await eleveDeLEcole(memoire?.eleveId || b.eleveId, etablissementId);
  const type = ['rapport_stage', 'memoire_licence', 'memoire_master', 'these'].includes(b.type) ? b.type : memoire?.type;
  if (!type) throw erreur('choisissez le type de travail');
  const sujet = texte(b.sujet, 400) || memoire?.sujet;
  if (!sujet) throw erreur('indiquez le sujet');
  const champs = {
    type, sujet, encadrant: texte(b.encadrant, 160), coEncadrant: texte(b.coEncadrant, 160),
    statut: ['sujet_valide', 'en_redaction', 'depose', 'soutenance_programmee', 'soutenu', 'ajourne'].includes(b.statut) ? b.statut : (memoire?.statut || 'sujet_valide'),
    dateDepot: /^\d{4}-\d{2}-\d{2}$/.test(b.dateDepot || '') ? b.dateDepot : null,
    dateSoutenance: b.dateSoutenance ? new Date(b.dateSoutenance) : null, lieu: texte(b.lieu, 160),
    observations: texte(b.observations, 3000),
  };
  if (['soutenance_programmee', 'soutenu', 'ajourne'].includes(champs.statut)) {
    champs.jury = validerJury(type, b.jury);
    if (!champs.dateSoutenance) throw erreur('indiquez la date de la soutenance');
  } else champs.jury = Array.isArray(b.jury) ? validerJury('autre', b.jury) : (memoire?.jury || []);
  if (['soutenu', 'ajourne'].includes(champs.statut)) {
    const note = Number(String(b.note ?? '').replace(',', '.'));
    if (!Number.isFinite(note) || note < 0 || note > 20) throw erreur('la note de soutenance doit être comprise entre 0 et 20');
    champs.note = note;
    champs.mention = outils.mention(note);
  } else { champs.note = null; champs.mention = null; }
  const resultat = memoire ? await memoire.update(champs) : await Memoire.create({ ...champs, etablissementId, eleveId: eleve.id });
  return res.status(memoire ? 200 : 201).json({ memoire: resultat });
}

async function pvSoutenance(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const where = { id: req.params.id };
  if (req.utilisateur.role === 'etudiant') where.eleveId = (await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } }))?.id || 0;
  else where.etablissementId = etablissementId;
  const memoire = await Memoire.findOne({ where });
  if (!memoire || !['soutenu', 'ajourne'].includes(memoire.statut)) throw erreur('procès-verbal disponible après la soutenance', 404);
  const eleve = await Eleve.findByPk(memoire.eleveId);
  const pdf = await pvSoutenancePDF({ etablissement: await obtenirEtablissementDe(memoire.etablissementId), eleve, memoire, emisParId: req.utilisateur.id });
  return envoyerPdf(res, pdf, `pv-soutenance-${eleve.matricule || eleve.id}`);
}

async function monMemoire(req, res) {
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } });
  const memoires = eleve ? await Memoire.findAll({ where: { eleveId: eleve.id }, order: [['createdAt', 'DESC']] }) : [];
  return res.json({ memoires });
}

// =========================================================================
// Diplômes et supplément au diplôme
// =========================================================================
function moyenneDuCycle(p) {
  const sems = p.semestres.filter((s) => s.cycle === p.cycle && s.ues.length);
  if (!sems.length) return null;
  return Math.round((sems.reduce((t, s) => t + s.moyenne, 0) / sems.length) * 100) / 100;
}

async function eligibles(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const where = { etablissementId };
  if (req.query.classeId) where.classeId = Number(req.query.classeId);
  const eleves = await Eleve.findAll({ where, include: [Classe], order: [['nom', 'ASC'], ['prenom', 'ASC']], limit: 400 });
  const diplomes = await Diplome.findAll({ where: { etablissementId } });
  const cache = {};
  const lignes = [];
  for (const e of eleves) {
    const p = await calculerParcours(e.id, cache);
    const d = diplomes.find((x) => x.eleveId === e.id && x.cycle === p.cycle);
    lignes.push({ eleveId: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule, classe: e.Classe?.nom, cycle: p.cycle, creditsAcquis: p.creditsAcquis, creditsRequis: p.creditsRequis, moyenne: moyenneDuCycle(p), eligible: p.creditsAcquis >= p.creditsRequis, diplome: d || null });
  }
  return res.json({ lignes });
}

async function delivrerDiplome(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const eleve = await eleveDeLEcole(req.params.eleveId, etablissementId);
  const p = await calculerParcours(eleve.id);
  if (p.creditsAcquis < p.creditsRequis) throw erreur(`${p.creditsAcquis} crédits acquis sur ${p.creditsRequis} : le cycle n’est pas encore validé`);
  if (await Diplome.findOne({ where: { eleveId: eleve.id, cycle: p.cycle } })) throw erreur('le diplôme de ce cycle a déjà été délivré');
  const etab = await Etablissement.findByPk(etablissementId, { attributes: ['sigle'] });
  const moyenne = moyenneDuCycle(p);
  const annee = p.semestres.filter((s) => s.cycle === p.cycle).map((s) => s.anneeScolaire).sort().pop() || null;
  const nb = await Diplome.count({ where: { etablissementId } });
  const diplome = await Diplome.create({
    etablissementId, eleveId: eleve.id, cycle: p.cycle,
    numero: `${(etab.sigle || 'DIP').toUpperCase()}-${p.cycle.slice(0, 1).toUpperCase()}-${new Date().getFullYear()}-${String(nb + 1).padStart(4, '0')}`,
    domaine: p.formation?.domaine || null, specialite: [p.formation?.mention, p.formation?.parcours].filter(Boolean).join(', ') || null,
    moyenne, mentionObtenue: outils.mention(moyenne), creditsAcquis: p.creditsAcquis, anneeObtention: annee,
    dateDelivrance: new Date().toISOString().slice(0, 10), delivreParNom: nomAgent(req.utilisateur),
  });
  await journaliserAudit(req, { action: 'diplome_delivre', cible: diplome.numero, etablissementId });
  return res.status(201).json({ diplome });
}

async function diplomeAutorise(req) {
  const where = { id: req.params.id };
  if (req.utilisateur.role === 'etudiant') where.eleveId = (await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } }))?.id || 0;
  else where.etablissementId = req.utilisateur.etablissementId;
  const diplome = await Diplome.findOne({ where });
  if (!diplome) throw erreur('diplôme introuvable', 404);
  return { diplome, eleve: await Eleve.findByPk(diplome.eleveId), etablissement: await obtenirEtablissementDe(diplome.etablissementId) };
}

async function pdfDiplome(req, res) {
  const { diplome, eleve, etablissement } = await diplomeAutorise(req);
  return envoyerPdf(res, await diplomePDF({ etablissement, eleve, diplome, emisParId: req.utilisateur.id }), `diplome-${diplome.numero}`);
}

async function pdfSupplement(req, res) {
  const { diplome, eleve, etablissement } = await diplomeAutorise(req);
  const parcours = await calculerParcours(eleve.id);
  return envoyerPdf(res, await supplementPDF({ etablissement, eleve, diplome, parcours, emisParId: req.utilisateur.id }), `supplement-diplome-${diplome.numero}`);
}

async function mesDiplomes(req, res) {
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: req.utilisateur.id } });
  return res.json({ diplomes: eleve ? await Diplome.findAll({ where: { eleveId: eleve.id } }) : [] });
}

// =========================================================================
// Mobilité : crédits obtenus ailleurs
// =========================================================================
async function listerTransferts(req, res) {
  const eleve = await eleveDeLEcole(req.query.eleveId, req.utilisateur.etablissementId);
  return res.json({ transferts: await CreditExterne.findAll({ where: { eleveId: eleve.id }, order: [['createdAt', 'DESC']] }) });
}

async function ajouterTransfert(req, res) {
  const etablissementId = req.utilisateur.etablissementId;
  const b = req.body || {};
  const eleve = await eleveDeLEcole(b.eleveId, etablissementId);
  const credits = Number(b.credits);
  const numeroSemestre = Number(b.numeroSemestre);
  if (!texte(b.etablissementOrigine) || !texte(b.intitule) || !Number.isInteger(credits) || credits < 1 || credits > 60) throw erreur('établissement d’origine, intitulé et crédits (1 à 60) sont obligatoires');
  if (!Number.isInteger(numeroSemestre) || numeroSemestre < 1 || numeroSemestre > 8) throw erreur('indiquez le semestre d’équivalence (1 à 8)');
  const note = b.note === '' || b.note == null ? null : Number(String(b.note).replace(',', '.'));
  if (note !== null && (!Number.isFinite(note) || note < 0 || note > 20)) throw erreur('la note doit être comprise entre 0 et 20');
  const t = await CreditExterne.create({
    etablissementId, eleveId: eleve.id, etablissementOrigine: texte(b.etablissementOrigine), pays: texte(b.pays, 80), code: texte(b.code, 40), intitule: texte(b.intitule),
    credits, note, cycle: ['licence', 'master', 'doctorat'].includes(b.cycle) ? b.cycle : 'licence', numeroSemestre, anneeScolaire: texte(b.anneeScolaire, 9),
    decideParNom: nomAgent(req.utilisateur), observations: texte(b.observations, 2000),
  });
  await journaliserAudit(req, { action: 'credits_transferes', cible: `${eleve.matricule || eleve.id} : ${credits} crédits`, etablissementId });
  return res.status(201).json({ transfert: t });
}

async function retirerTransfert(req, res) {
  const t = await CreditExterne.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!t) throw erreur('transfert introuvable', 404);
  await t.destroy();
  return res.json({ message: 'transfert retiré' });
}

module.exports = {
  offresPubliques, deposer, listerPreinscriptions, telechargerPiece, deciderPreinscription, inscrireCandidat,
  listeAnonymat, genererAnonymat, saisirParNumero, leverAnonymat,
  listerMemoires, enregistrerMemoire, pvSoutenance, monMemoire,
  eligibles, delivrerDiplome, pdfDiplome, pdfSupplement, mesDiplomes,
  listerTransferts, ajouterTransfert, retirerTransfert, GRADES,
};
