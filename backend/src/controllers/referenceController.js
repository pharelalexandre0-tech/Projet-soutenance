const bcrypt = require('bcryptjs');
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
  Absence,
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
async function modifierClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const { nom, niveau } = req.body;
  await classe.update({ nom, niveau });
  return res.json({ classe });
}
// Une classe avec des élèves ne se supprime pas directement — il faut
// d'abord les déplacer ou les retirer, pour ne jamais perdre un dossier
// élève par effet de bord d'une suppression de classe.
async function supprimerClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id, { include: [Eleve] });
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  if (classe.Eleves && classe.Eleves.length > 0) {
    return res.status(400).json({ erreur: `impossible de supprimer : ${classe.Eleves.length} élève(s) encore inscrit(s) dans cette classe` });
  }
  await classe.destroy();
  return res.status(204).send();
}
async function statistiquesClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id, { include: [Eleve] });
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const eleveIds = classe.Eleves.map((e) => e.id);
  const absences = eleveIds.length > 0 ? await Absence.findAll({ where: { eleveId: eleveIds } }) : [];
  const justifiees = absences.filter((a) => a.justifie).length;
  const nonJustifiees = absences.length - justifiees;
  return res.json({
    effectif: classe.Eleves.length,
    statut: classe.Eleves.length > 0 ? 'active' : 'vide',
    absences: { total: absences.length, justifiees, nonJustifiees },
  });
}

async function creerProfesseur(req, res) {
  const professeur = await Professeur.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ professeur });
}
async function listerProfesseurs(req, res) {
  const professeurs = await Professeur.findAll({ where: { etablissementId: req.utilisateur.etablissementId } });
  return res.json({ professeurs });
}
async function supprimerProfesseur(req, res) {
  const professeur = await Professeur.findByPk(req.params.id);
  if (!professeur || professeur.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'professeur introuvable' });
  }
  await professeur.destroy();
  return res.status(204).send();
}

// Plateforme universitaire : inscrire un étudiant crée dans le même geste
// son propre compte (pas de compte "parent" séparé) — sans ça, il n'aurait
// aucun moyen d'accéder à son dossier.
async function creerEleve(req, res) {
  const { nom, prenom, dateNaissance, classeId, email, motDePasse } = req.body;

  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: "l'e-mail et le mot de passe du compte étudiant sont obligatoires" });
  }
  const emailExistant = await Utilisateur.findOne({ where: { email } });
  if (emailExistant) {
    return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  }

  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
  const compteEtudiant = await Utilisateur.create({
    nom,
    prenom,
    email,
    motDePasse: motDePasseHache,
    role: 'etudiant',
    etablissementId: req.utilisateur.etablissementId,
  });
  const eleve = await Eleve.create({
    nom, prenom, dateNaissance, classeId,
    compteEtudiantId: compteEtudiant.id,
    etablissementId: req.utilisateur.etablissementId,
  });
  return res.status(201).json({ eleve, compteEtudiant: compteEtudiant.toPublicJSON() });
}
async function listerEleves(req, res) {
  const where = { etablissementId: req.utilisateur.etablissementId };
  if (req.query.classeId) where.classeId = req.query.classeId;
  if (req.utilisateur.role === 'etudiant') where.compteEtudiantId = req.utilisateur.id;
  const eleves = await Eleve.findAll({ where, include: [Classe] });
  return res.json({ eleves });
}
// Supprime la fiche élève ET son compte étudiant (login) — un élève retiré
// ne doit pas laisser un compte orphelin qui peut encore se connecter.
async function supprimerEleve(req, res) {
  const eleve = await Eleve.findByPk(req.params.id);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  const compteEtudiantId = eleve.compteEtudiantId;
  await eleve.destroy();
  if (compteEtudiantId) await Utilisateur.destroy({ where: { id: compteEtudiantId } });
  return res.status(204).send();
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
// École-Étudiants) : les étudiants de la classe visée sont notifiés dans
// l'appli ET par e-mail, directement sur leur propre compte.
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

  const eleves = await Eleve.findAll({ where: { classeId }, include: [{ model: Utilisateur, as: 'compteEtudiant' }] });
  const destinatairesUniques = new Map();
  eleves.forEach((el) => { if (el.compteEtudiant) destinatairesUniques.set(el.compteEtudiant.id, el.compteEtudiant); });

  for (const etudiant of destinatairesUniques.values()) {
    await Notification.create({
      utilisateurId: etudiant.id,
      contenu: `${LIBELLES_TYPE_MESSAGE[message.type] || 'Message'} : ${titre}`,
    });
    await envoyerEmail(etudiant.email, titre, contenu);
  }

  return res.status(201).json({ message, etudiantsNotifies: destinatairesUniques.size });
}

async function listerMessages(req, res) {
  const where = {};
  if (req.query.classeId) where.classeId = req.query.classeId;

  if (req.utilisateur.role === 'etudiant') {
    const eleves = await Eleve.findAll({ where: { compteEtudiantId: req.utilisateur.id } });
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
  modifierClasse,
  supprimerClasse,
  statistiquesClasse,
  creerProfesseur,
  listerProfesseurs,
  supprimerProfesseur,
  creerEleve,
  listerEleves,
  supprimerEleve,
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
