const {
  Classe,
  Professeur,
  Eleve,
  Semestre,
  UniteEnseignement,
  Matiere,
  EmploiDuTemps,
  Utilisateur,
  CahierDeTextes,
  MessageAnnonce,
  Notification,
} = require('../models');
const { envoyerEmail } = require('../services/emailService');
const { obtenirEtablissementDe } = require('../services/etablissementService');

// Identité de l'établissement (nom, ville…) DE L'UTILISATEUR CONNECTÉ,
// utilisée sur les documents officiels (bulletin, reçu). Paramétrable en
// base par l'Académie — jamais codée en dur, pour que la plateforme
// s'adapte à n'importe quelle école, et jamais partagée entre écoles.
async function obtenirEtablissement(req, res) {
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'aucun établissement rattaché à ce compte' });
  return res.json({ etablissement });
}

// "Paramètres" (Académie) : renseigner/mettre à jour la fiche de son propre
// établissement — jamais celui d'une autre école.
async function configurerEtablissement(req, res) {
  const { nom, sigle, devise, ville, pays, boitePostale, telephone, email } = req.body;
  if (!nom || !ville) {
    return res.status(400).json({ erreur: 'le nom et la ville sont obligatoires' });
  }
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'aucun établissement rattaché à ce compte' });
  await etablissement.update({ nom, sigle, devise, ville, pays, boitePostale, telephone, email });
  return res.json({ etablissement });
}

const LIBELLES_TYPE_MESSAGE = { message: 'Message', annonce: 'Annonce', convocation: 'Convocation' };

// Gestion de la structure pédagogique (Espace Académie, diagramme 1) :
// classes, professeurs, élèves, semestres, UE, emplois du temps. CRUD
// volontairement minimal (create + list) pour rester focalisé sur les
// flux détaillés dans les diagrammes de séquence/activité.
//
// Multi-établissement : chaque création est rattachée à l'établissement du
// compte connecté, jamais choisie librement, et chaque liste ne renvoie que
// les données de cet établissement — deux écoles ne se voient jamais.

async function creerClasse(req, res) {
  const classe = await Classe.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ classe });
}
async function listerClasses(req, res) {
  const classes = await Classe.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, include: [Eleve] });
  return res.json({ classes });
}

async function creerProfesseur(req, res) {
  const professeur = await Professeur.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ professeur });
}
async function listerProfesseurs(req, res) {
  const professeurs = await Professeur.findAll({ where: { etablissementId: req.utilisateur.etablissementId } });
  return res.json({ professeurs });
}

async function creerEleve(req, res) {
  const { nom, prenom, dateNaissance, classeId, parentEmail } = req.body;

  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }

  let parentId = null;
  if (parentEmail) {
    const parent = await Utilisateur.findOne({ where: { email: parentEmail, role: 'parent' } });
    if (parent && parent.etablissementId === req.utilisateur.etablissementId) parentId = parent.id;
  }
  const eleve = await Eleve.create({ nom, prenom, dateNaissance, classeId, parentId, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ eleve });
}
async function listerEleves(req, res) {
  const where = { etablissementId: req.utilisateur.etablissementId };
  if (req.query.classeId) where.classeId = req.query.classeId;
  if (req.utilisateur.role === 'parent') where.parentId = req.utilisateur.id;
  const eleves = await Eleve.findAll({ where, include: [Classe] });
  return res.json({ eleves });
}

async function creerSemestre(req, res) {
  const semestre = await Semestre.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ semestre });
}
async function listerSemestres(req, res) {
  const semestres = await Semestre.findAll({ where: { etablissementId: req.utilisateur.etablissementId } });
  return res.json({ semestres });
}

async function creerUE(req, res) {
  const { semestreId } = req.body;
  const semestre = await Semestre.findByPk(semestreId);
  if (!semestre || semestre.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'semestre introuvable' });
  }
  const ue = await UniteEnseignement.create(req.body);
  return res.status(201).json({ ue });
}
async function listerUE(req, res) {
  const where = {};
  if (req.query.semestreId) where.semestreId = req.query.semestreId;
  const ues = await UniteEnseignement.findAll({
    where,
    include: [{ model: Semestre, where: { etablissementId: req.utilisateur.etablissementId } }, Matiere],
  });
  return res.json({ ues });
}

// Une matière (ex. Python, PHP, Java) appartient à une UE (ex. "Programmation").
async function creerMatiere(req, res) {
  const { uniteEnseignementId } = req.body;
  const ue = await UniteEnseignement.findByPk(uniteEnseignementId, { include: [Semestre] });
  if (!ue || ue.Semestre?.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: "unité d'enseignement introuvable" });
  }
  const matiere = await Matiere.create(req.body);
  return res.status(201).json({ matiere });
}
async function listerMatieres(req, res) {
  const where = {};
  if (req.query.uniteEnseignementId) where.uniteEnseignementId = req.query.uniteEnseignementId;
  const matieres = await Matiere.findAll({
    where,
    include: [{ model: UniteEnseignement, include: [{ model: Semestre, where: { etablissementId: req.utilisateur.etablissementId } }] }],
  });
  return res.json({ matieres });
}

async function creerEmploiDuTemps(req, res) {
  const { classeId } = req.body;
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const emploi = await EmploiDuTemps.create(req.body);
  return res.status(201).json({ emploi });
}
async function listerEmploisDuTemps(req, res) {
  const where = {};
  if (req.query.classeId) where.classeId = req.query.classeId;
  const emplois = await EmploiDuTemps.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
  });
  return res.json({ emplois });
}

async function listerCahierDeTextes(req, res) {
  const { classeId } = req.query;
  const where = classeId ? { classeId } : {};
  const cahier = await CahierDeTextes.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['date', 'DESC']],
  });
  return res.json({ cahier });
}
async function ajouterCahierDeTextes(req, res) {
  const classe = await Classe.findByPk(req.body.classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const entree = await CahierDeTextes.create({ ...req.body, academieId: req.utilisateur.id });
  return res.status(201).json({ entree });
}

// "Envoyer un message/une annonce/une convocation" (diagramme communication
// École-Parents) : les parents des élèves de la classe visée sont notifiés
// dans l'appli ET par e-mail.
async function envoyerMessage(req, res) {
  const { titre, contenu, type, classeId } = req.body;
  if (!classeId) {
    return res.status(400).json({ erreur: 'classeId requis' });
  }
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }

  const message = await MessageAnnonce.create({ titre, contenu, type, classeId, auteurId: req.utilisateur.id });

  const eleves = await Eleve.findAll({ where: { classeId }, include: [{ model: Utilisateur, as: 'parent' }] });
  const parentsUniques = new Map();
  eleves.forEach((el) => { if (el.parent) parentsUniques.set(el.parent.id, el.parent); });

  for (const parent of parentsUniques.values()) {
    await Notification.create({
      utilisateurId: parent.id,
      contenu: `${LIBELLES_TYPE_MESSAGE[message.type] || 'Message'} : ${titre}`,
    });
    await envoyerEmail(parent.email, titre, contenu);
  }

  return res.status(201).json({ message, parentsNotifies: parentsUniques.size });
}

async function listerMessages(req, res) {
  const where = {};
  if (req.query.classeId) where.classeId = req.query.classeId;

  if (req.utilisateur.role === 'parent') {
    const eleves = await Eleve.findAll({ where: { parentId: req.utilisateur.id } });
    where.classeId = eleves.map((el) => el.classeId);
  }

  const messages = await MessageAnnonce.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['dateEnvoi', 'DESC']],
  });
  return res.json({ messages });
}

module.exports = {
  creerClasse,
  listerClasses,
  creerProfesseur,
  listerProfesseurs,
  creerEleve,
  listerEleves,
  creerSemestre,
  listerSemestres,
  creerUE,
  listerUE,
  creerMatiere,
  listerMatieres,
  creerEmploiDuTemps,
  listerEmploisDuTemps,
  listerCahierDeTextes,
  ajouterCahierDeTextes,
  envoyerMessage,
  listerMessages,
  obtenirEtablissement,
  configurerEtablissement,
};
