const { Personnel, Salaire, Professeur } = require('../models');
const { rattacherProfesseursALaPaie } = require('../services/paieService');

function presenter(personne, stats = {}) {
  return {
    id: personne.id,
    nom: personne.nom,
    prenom: personne.prenom,
    email: personne.email,
    poste: personne.poste,
    salaireBase: personne.salaireBase,
    dateEmbauche: personne.dateEmbauche,
    professeurId: personne.professeurId,
    enseignant: !!personne.professeurId,
    nbVersements: stats.nb || 0,
    dernierVersement: stats.dernier || null,
    totalVerse: stats.total || 0,
  };
}

// Liste du personnel (panneau de gauche de "Paie du personnel") : le
// personnel ajouté par la Finance et, automatiquement, les professeurs
// enregistrés par l'Académie.
async function listerPersonnel(req, res) {
  await rattacherProfesseursALaPaie(req.utilisateur.etablissementId);
  const personnel = await Personnel.findAll({
    where: { etablissementId: req.utilisateur.etablissementId },
    include: [{ model: Salaire, attributes: ['montant', 'dateVersement', 'statut'] }],
    order: [['nom', 'ASC'], ['prenom', 'ASC']],
  });
  return res.json({
    personnel: personnel.map((p) => {
      const verses = (p.Salaires || []).filter((s) => s.statut === 'verse');
      return presenter(p, {
        nb: verses.length,
        total: verses.reduce((a, s) => a + s.montant, 0),
        dernier: verses.map((s) => s.dateVersement).filter(Boolean).sort().pop() || null,
      });
    }),
  });
}

// Une école neuve démarre sans aucun personnel : la Finance peut en
// ajouter elle-même (surveillant, comptable...). Les professeurs, eux,
// arrivent depuis l'Académie.
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
  return res.status(201).json({ personnel: presenter(personne) });
}

// Modifier une fiche : poste, salaire de base, date d'embauche (et, pour
// le personnel hors enseignants, nom et e-mail ; ceux d'un professeur se
// modifient côté Académie).
async function modifierPersonnel(req, res) {
  const personne = await Personnel.findByPk(req.params.personnelId);
  if (!personne || personne.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'personnel introuvable' });
  }
  const { nom, prenom, email, poste, salaireBase, dateEmbauche } = req.body;
  if (poste !== undefined && !String(poste).trim()) return res.status(400).json({ erreur: 'le poste est obligatoire' });
  await personne.update({
    ...(poste !== undefined && { poste: String(poste).trim() }),
    ...(salaireBase !== undefined && { salaireBase: salaireBase === '' || salaireBase === null ? null : Number(salaireBase) }),
    ...(dateEmbauche !== undefined && { dateEmbauche: dateEmbauche || null }),
    ...(!personne.professeurId && nom !== undefined && { nom }),
    ...(!personne.professeurId && prenom !== undefined && { prenom }),
    ...(!personne.professeurId && email !== undefined && { email: email || null }),
  });
  return res.json({ personnel: presenter(personne) });
}

// Fiche de paie d'une personne : son identité + l'historique de ses
// versements (panneau de droite, une fois une personne sélectionnée).
async function obtenirFichePaie(req, res) {
  const { personnelId } = req.params;
  const personne = await Personnel.findByPk(personnelId, { include: [{ model: Professeur, attributes: ['matiere'] }] });
  if (!personne || personne.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'personnel introuvable' });
  }

  const salaires = await Salaire.findAll({
    where: { personnelId },
    order: [['dateVersement', 'DESC'], ['createdAt', 'DESC']],
  });

  return res.json({ personnel: presenter(personne), salaires });
}

module.exports = { listerPersonnel, creerPersonnel, modifierPersonnel, obtenirFichePaie };
