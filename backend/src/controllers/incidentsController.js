const { IncidentComportement, Eleve } = require('../models');

// Saisie par l'Académie — troisième signal du module IA aux côtés des
// notes et des absences (voir services/riskService.js).
async function creerIncident(req, res) {
  const { eleveId, date, description, gravite } = req.body;
  if (!eleveId || !date || !description) {
    return res.status(400).json({ erreur: 'élève, date et description sont obligatoires' });
  }
  const eleve = await Eleve.findByPk(eleveId);
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
  return res.status(201).json({ incident });
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
  const incidents = await IncidentComportement.findAll({ where: { eleveId }, order: [['date', 'DESC']] });
  return res.json({ incidents });
}

module.exports = { creerIncident, listerIncidentsEleve };
