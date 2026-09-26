const { Eleve, Classe, PredictionIA, Utilisateur, Notification, ModeleIA } = require('../models');
const { calculerRisqueEleve, modeleActif, oublierModele } = require('../services/riskService');
const { entrainerModele } = require('../services/ia/entrainement');
const { CARACTERISTIQUES } = require('../services/ia/caracteristiques');

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

// "Consulter le dossier de l'élève concerné" : tableau de bord des risques
// pour l'Académie. Filtrer sur alerteGeneree=true laissait ce tableau
// (et les tuiles risque moyen/faible, qui ne comptent que ce qu'il reçoit)
// vides dès qu'aucun élève ne franchissait le seuil — alors que l'analyse
// avait bien tourné et calculé un score pour chacun. On renvoie plutôt le
// dernier résultat de CHAQUE élève, quel que soit son niveau : l'Académie
// voit toujours ce que l'analyse a trouvé, pas seulement les cas les plus graves.
async function listerAlertes(req, res) {
  const predictions = await PredictionIA.findAll({
    include: [{ model: Eleve, where: { etablissementId: req.utilisateur.etablissementId }, include: [{ model: Classe, attributes: ['id', 'nom', 'niveau'] }] }],
    order: [['dateCalcul', 'DESC']],
  });
  const vus = new Set();
  const dernieresParEleve = predictions.filter((p) => {
    if (vus.has(p.eleveId)) return false;
    vus.add(p.eleveId);
    return true;
  });
  return res.json({ alertes: dernieresParEleve });
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

// Fiche du modèle actif (sans les paramètres appris, trop volumineux) :
// algorithme, performances, comparaison, importance des signaux, données.
function presenterModele(m) {
  return {
    version: m.version,
    algorithme: m.algorithme,
    entraineLe: m.entraineLe,
    dureeMs: m.dureeMs,
    parametres: m.parametres,
    metriques: m.metriques,
    comparaison: m.comparaison,
    donnees: m.donnees,
    importances: CARACTERISTIQUES
      .map((c) => ({ cle: c.cle, libelle: c.libelle, importance: m.importances[c.cle] || 0 }))
      .sort((a, b) => b.importance - a.importance),
  };
}

async function obtenirModele(req, res) {
  const modele = await modeleActif();
  const versions = await ModeleIA.findAll({ attributes: ['version', 'algorithme', 'entraineLe', 'metriques', 'actif'], order: [['version', 'DESC']] });
  return res.json({
    modele: presenterModele(modele),
    versions: versions.map((v) => ({ version: v.version, algorithme: v.algorithme, entraineLe: v.entraineLe, auc: v.metriques.auc, actif: v.actif })),
  });
}

// Réentraîner : la base d'apprentissage est reconstruite (cohorte de
// référence + semestres terminés des établissements), les deux algorithmes
// sont comparés et le meilleur devient le modèle actif. Les scores des
// élèves de l'école sont ensuite recalculés avec lui.
async function reentrainerModele(req, res) {
  const modele = await entrainerModele({ entraineParId: req.utilisateur.id });
  oublierModele();
  const analyse = await executerAnalyseRisque(req.utilisateur.etablissementId);
  return res.status(201).json({ modele: presenterModele(modele.toJSON()), analyse });
}

module.exports = { lancerAnalyse, listerAlertes, historiqueEleve, executerAnalyseRisque, obtenirModele, reentrainerModele };
