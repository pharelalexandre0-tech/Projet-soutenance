const {
  IncidentComportement, Eleve, Classe, Utilisateur, PredictionIA, Notification, Etablissement,
} = require('../models');
const { calculerRisqueEleve } = require('../services/riskService');
const { envoyerEmail } = require('../services/emailService');
const { emailIncident, nomPropre } = require('../services/modelesEmail');

function dateLisible(dateIso) {
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function presenter(incident) {
  const eleve = incident.Eleve;
  return {
    id: incident.id,
    date: incident.date,
    gravite: incident.gravite,
    description: incident.description,
    parentInformeLe: incident.parentInformeLe,
    creeLe: incident.createdAt,
    eleve: eleve ? { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, matricule: eleve.matricule } : null,
    classe: eleve?.Classe ? { id: eleve.Classe.id, nom: eleve.Classe.nom, niveau: eleve.Classe.niveau } : null,
    saisiPar: incident.saisiParAcademie ? `${incident.saisiParAcademie.prenom} ${incident.saisiParAcademie.nom}` : null,
  };
}

// Signalement par l'Académie. Un incident va à trois endroits : le dossier
// de l'élève (journal ci-dessous et espace Parents), le score de risque de
// décrochage (recalculé tout de suite, c'est un des trois signaux du module
// IA avec les notes et les absences) et, si demandé, le parent (notification
// et e-mail).
async function creerIncident(req, res) {
  const { eleveId, date, gravite, informerParent } = req.body;
  const description = String(req.body.description || '').trim();
  if (!eleveId || !date || !description) {
    return res.status(400).json({ erreur: 'élève, date et description sont obligatoires' });
  }
  if (description.length > 250) {
    return res.status(400).json({ erreur: 'la description ne doit pas dépasser 250 caractères' });
  }
  const eleve = await Eleve.findByPk(eleveId, { include: [{ model: Utilisateur, as: 'parent' }, Classe] });
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  const incident = await IncidentComportement.create({
    eleveId,
    date,
    description,
    gravite: gravite === 'majeur' ? 'majeur' : 'mineur',
    saisiParAcademieId: req.utilisateur.id,
  });

  const risque = await calculerRisqueEleve(eleve.id);
  await PredictionIA.create({ eleveId: eleve.id, ...risque });

  const nomEleve = `${nomPropre(eleve.prenom)} ${nomPropre(eleve.nom)}`;
  let parent = { rattache: !!eleve.parent, informe: false, envoye: false };
  if (eleve.parent && informerParent !== false) {
    await Notification.create({
      utilisateurId: eleve.parent.id,
      contenu: `Incident ${incident.gravite} signalé pour ${nomEleve} le ${dateLisible(date)}.`,
    });
    const etablissement = await Etablissement.findByPk(eleve.etablissementId);
    const message = emailIncident({
      prenom: eleve.parent.prenom, eleve: nomEleve, date: dateLisible(date), gravite: incident.gravite, description, etablissement,
    });
    const envoi = await envoyerEmail(eleve.parent.email, message.sujet, message.texte, [], { html: message.html });
    incident.parentInformeLe = new Date();
    await incident.save();
    parent = { rattache: true, informe: true, envoye: !envoi.simule, email: eleve.parent.email };
  }

  incident.Eleve = eleve;
  return res.status(201).json({
    incident: presenter(incident),
    risque: { scoreRisque: risque.scoreRisque, niveauRisque: risque.niveauRisque, alerte: risque.alerteGeneree },
    parent,
  });
}

// Journal de l'établissement : tous les incidents consignés, du plus récent
// au plus ancien.
async function listerIncidents(req, res) {
  const whereEleve = { etablissementId: req.utilisateur.etablissementId };
  if (req.query.classeId) whereEleve.classeId = req.query.classeId;
  const incidents = await IncidentComportement.findAll({
    include: [
      { model: Eleve, where: whereEleve, include: [Classe] },
      { model: Utilisateur, as: 'saisiParAcademie', attributes: ['prenom', 'nom'] },
    ],
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    limit: 500,
  });
  return res.json({ incidents: incidents.map(presenter) });
}

// Retirer un signalement saisi par erreur (le score se recalcule sans lui).
async function supprimerIncident(req, res) {
  const incident = await IncidentComportement.findByPk(req.params.id, { include: [Eleve] });
  if (!incident || incident.Eleve?.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'incident introuvable' });
  }
  const { eleveId } = incident;
  await incident.destroy();
  const risque = await calculerRisqueEleve(eleveId);
  await PredictionIA.create({ eleveId, ...risque });
  return res.status(204).send();
}

async function listerIncidentsEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  if (req.utilisateur.role === 'parent' && eleve.parentId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  const incidents = await IncidentComportement.findAll({ where: { eleveId }, order: [['date', 'DESC'], ['createdAt', 'DESC']] });
  return res.json({ incidents });
}

module.exports = { creerIncident, listerIncidents, supprimerIncident, listerIncidentsEleve };
