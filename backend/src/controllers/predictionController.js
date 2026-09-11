const { Eleve, PredictionIA, Utilisateur, Notification } = require('../models');
const { calculerRisqueEleve } = require('../services/riskService');

// "Déclencher l'analyse périodique (ex. hebdomadaire)" -> collecte ->
// calcul -> décision seuil -> alerte/archive -> notifier l'équipe
// pédagogique (diagramme d'activité 7). Appelable via l'API par
// l'Académie (bouton "lancer l'analyse", scopé à son établissement) ou via
// le script planifié src/scripts/runPrediction.js (toutes les écoles,
// analysées et notifiées séparément).
async function executerAnalyseRisque(etablissementId) {
  const where = etablissementId ? { etablissementId } : {};
  const eleves = await Eleve.findAll({ where });
  const resultats = [];

  for (const eleve of eleves) {
    const { scoreRisque, niveauRisque, facteursCles, alerteGeneree } = await calculerRisqueEleve(eleve.id);
    const prediction = await PredictionIA.create({
      eleveId: eleve.id,
      scoreRisque,
      niveauRisque,
      facteursCles,
      alerteGeneree,
    });
    resultats.push(prediction);
  }

  const alertes = resultats.filter((p) => p.alerteGeneree);
  if (alertes.length > 0) {
    const academiciens = await Utilisateur.findAll({ where: { role: 'academie', etablissementId } });
    for (const academie of academiciens) {
      await Notification.create({
        utilisateurId: academie.id,
        contenu: `${alertes.length} élève(s) signalé(s) à risque après l'analyse du ${new Date().toLocaleDateString('fr-FR')}.`,
      });
    }
  }

  return { analysés: resultats.length, alertesGenerees: alertes.length };
}

async function lancerAnalyse(req, res) {
  const resultat = await executerAnalyseRisque(req.utilisateur.etablissementId);
  return res.status(201).json(resultat);
}

// "Consulter le dossier de l'élève concerné" : tableau de bord des alertes
// actives pour l'Académie.
async function listerAlertes(req, res) {
  const predictions = await PredictionIA.findAll({
    where: { alerteGeneree: true },
    include: [{ model: Eleve, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['dateCalcul', 'DESC']],
  });
  return res.json({ alertes: predictions });
}

async function historiqueEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }

  const predictions = await PredictionIA.findAll({
    where: { eleveId },
    order: [['dateCalcul', 'DESC']],
  });
  return res.json({ predictions });
}

module.exports = { lancerAnalyse, listerAlertes, historiqueEleve, executerAnalyseRisque };
