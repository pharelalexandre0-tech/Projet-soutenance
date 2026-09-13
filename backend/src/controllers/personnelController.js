const { Personnel, Salaire } = require('../models');

// Liste du personnel (panneau de gauche de "Paie du personnel").
async function listerPersonnel(req, res) {
  const personnel = await Personnel.findAll({
    where: { etablissementId: req.utilisateur.etablissementId },
    order: [['nom', 'ASC']],
  });
  return res.json({ personnel });
}

// Une école neuve démarre sans aucun personnel — l'Académie/la Finance doit
// pouvoir en ajouter elle-même, pas dépendre de données pré-chargées.
async function creerPersonnel(req, res) {
  const { nom, prenom, email, poste, salaireBase, dateEmbauche } = req.body;
  if (!nom || !prenom || !poste) {
    return res.status(400).json({ erreur: 'nom, prénom et poste sont obligatoires' });
  }
  const personne = await Personnel.create({
    nom, prenom, poste,
    email: email || null,
    salaireBase: salaireBase || null,
    dateEmbauche: dateEmbauche || null,
    etablissementId: req.utilisateur.etablissementId,
  });
  return res.status(201).json({ personnel: personne });
}

// Fiche de paie d'une personne : son identité + l'historique de ses
// versements (panneau de droite, une fois une personne sélectionnée).
async function obtenirFichePaie(req, res) {
  const { personnelId } = req.params;
  const personne = await Personnel.findByPk(personnelId);
  if (!personne || personne.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'personnel introuvable' });
  }

  const salaires = await Salaire.findAll({
    where: { personnelId },
    order: [['dateVersement', 'DESC'], ['createdAt', 'DESC']],
  });

  return res.json({ personnel: personne, salaires });
}

module.exports = { listerPersonnel, creerPersonnel, obtenirFichePaie };
