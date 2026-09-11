const { FraisScolarite, Paiement, Recu, Eleve, Classe, Utilisateur, Notification, Salaire, Personnel } = require('../models');
const { genererRecuPDF } = require('../services/pdfService');
const { envoyerEmail } = require('../services/emailService');
const { verifierImpayesService } = require('../services/impayesService');
const { obtenirEtablissementDe } = require('../services/etablissementService');

// "Définir les frais de scolarité (par semestre)" - diagramme 1 (Espace
// Finance).
async function definirFrais(req, res) {
  const { eleveId, semestreId, libelle, montant, dateEcheance } = req.body;
  if (!eleveId || !semestreId || !libelle || !montant || !dateEcheance) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  const frais = await FraisScolarite.create({ eleveId, semestreId, libelle, montant, dateEcheance });
  return res.status(201).json({ frais });
}

// "Consulter mes frais et échéances" (Étudiant) / consultation Finance.
async function listerFraisEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  const frais = await FraisScolarite.findAll({ where: { eleveId }, order: [['dateEcheance', 'ASC']] });
  return res.json({ frais });
}

// Diagramme 8 : enregistrerPaiement -> vérifier le montant par rapport au
// frais dû -> alt [valide] génère reçu + notifie / [invalide] message
// d'erreur.
async function enregistrerPaiement(req, res) {
  const { fraisId, montant, modePaiement } = req.body;
  if (!fraisId || !montant || !modePaiement) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }

  const frais = await FraisScolarite.findByPk(fraisId, {
    include: [{ model: Eleve, include: [{ model: Utilisateur, as: 'compteEtudiant' }] }],
  });
  if (!frais || frais.Eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'frais introuvable' });
  }

  const resteDu = frais.montant - frais.montantRegle;
  if (montant <= 0 || montant > resteDu + 0.01) {
    return res.status(400).json({ erreur: 'erreur (montant incorrect)' });
  }

  const paiement = await Paiement.create({
    fraisId,
    montant,
    modePaiement,
    statut: 'valide',
    enregistreParFinanceId: req.utilisateur.id,
  });

  frais.montantRegle += montant;
  frais.statut = frais.montantRegle >= frais.montant ? 'solde' : 'partiel';
  await frais.save();

  const recuNumero = `REC-${new Date().getFullYear()}-${String(paiement.id).padStart(5, '0')}`;
  const { cheminRelatif } = await genererRecuPDF({
    recuNumero,
    eleve: frais.Eleve,
    frais,
    paiement,
    etablissement: await obtenirEtablissementDe(req.utilisateur.etablissementId),
  });
  const recu = await Recu.create({ numero: recuNumero, paiementId: paiement.id, fichierPDF: cheminRelatif });

  let recuEnvoyeA = null;
  if (frais.Eleve.compteEtudiant) {
    await envoyerEmail(
      frais.Eleve.compteEtudiant.email,
      `Reçu de paiement — ${frais.libelle}`,
      `Votre paiement de ${montant} FCFA a été enregistré. Reçu n° ${recuNumero} : ${cheminRelatif}`
    );
    await Notification.create({
      utilisateurId: frais.Eleve.compteEtudiant.id,
      contenu: `Paiement de ${montant} FCFA reçu pour "${frais.libelle}". Statut du frais : ${frais.statut}.`,
    });
    recuEnvoyeA = frais.Eleve.compteEtudiant.email;
  }

  return res.status(201).json({ paiement, recu, frais, recuEnvoyeA });
}

async function listerPaiementsEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }

  const frais = await FraisScolarite.findAll({
    where: { eleveId },
    include: [{ model: Paiement, include: [Recu] }],
  });
  return res.json({ frais });
}

// Diagramme 9 : vérification quotidienne des échéances -> marquer "impayé"
// + notifier l'étudiant, ou classer "à jour". Déclenchable manuellement par
// la Finance ici, ou automatiquement via src/scripts/checkImpayes.js.
async function verifierImpayes(req, res) {
  const resultat = await verifierImpayesService(req.utilisateur.etablissementId);
  return res.json(resultat);
}

// "Consulter le tableau de bord des impayés" (Finance).
async function tableauDeBordImpayes(req, res) {
  const impayes = await FraisScolarite.findAll({
    where: { statut: 'impaye' },
    include: [{ model: Eleve, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['dateEcheance', 'ASC']],
  });
  return res.json({ impayes });
}

// Vue d'ensemble par niveau puis par classe : tous les élèves (pas
// seulement les impayés) avec leur statut de paiement agrégé, pour repérer
// d'un coup d'œil quelle classe/niveau a le plus de retards.
async function roulementFraisParClasse(req, res) {
  const classes = await Classe.findAll({
    where: { etablissementId: req.utilisateur.etablissementId },
    include: [{ model: Eleve, include: [FraisScolarite] }],
    order: [['niveau', 'ASC'], ['nom', 'ASC']],
  });

  const parNiveau = new Map();
  for (const classe of classes) {
    if (!parNiveau.has(classe.niveau)) parNiveau.set(classe.niveau, []);
    const eleves = (classe.Eleves || []).map((eleve) => {
      const frais = eleve.FraisScolarites || [];
      const totalDu = frais.reduce((s, f) => s + f.montant, 0);
      const totalRegle = frais.reduce((s, f) => s + f.montantRegle, 0);
      const aUnImpaye = frais.some((f) => f.statut === 'impaye');
      const statutGlobal = frais.length === 0 ? 'sans_frais'
        : aUnImpaye ? 'impaye'
        : totalRegle >= totalDu ? 'solde'
        : totalRegle > 0 ? 'partiel'
        : 'du';
      // Frais à relancer en priorité (impayé d'abord, sinon partiel) — pour
      // que le bouton "Relancer" de la liste sache quel frais cibler.
      const fraisARelancer = frais.find((f) => f.statut === 'impaye') || frais.find((f) => f.statut === 'partiel');
      return {
        id: eleve.id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        totalDu,
        totalRegle,
        resteDu: totalDu - totalRegle,
        statutGlobal,
        fraisARelancerId: fraisARelancer ? fraisARelancer.id : null,
      };
    });
    parNiveau.get(classe.niveau).push({ id: classe.id, nom: classe.nom, eleves });
  }

  const niveaux = [...parNiveau.entries()].map(([niveau, classesDuNiveau]) => ({ niveau, classes: classesDuNiveau }));
  return res.json({ niveaux });
}

// "Envoyer une relance (message / convocation)".
async function envoyerRelance(req, res) {
  const { fraisId } = req.params;
  const frais = await FraisScolarite.findByPk(fraisId, {
    include: [{ model: Eleve, include: [{ model: Utilisateur, as: 'compteEtudiant' }] }],
  });
  if (!frais || frais.Eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'frais introuvable' });
  }
  if (!frais.Eleve.compteEtudiant) return res.status(400).json({ erreur: 'aucun compte étudiant associé' });

  await envoyerEmail(
    frais.Eleve.compteEtudiant.email,
    `Relance — ${frais.libelle}`,
    `Merci de régulariser le paiement de "${frais.libelle}" (${frais.montant - frais.montantRegle} FCFA restants) dans les meilleurs délais.`
  );
  await Notification.create({
    utilisateurId: frais.Eleve.compteEtudiant.id,
    contenu: `Relance envoyée pour le frais "${frais.libelle}".`,
  });

  return res.json({ message: 'relance envoyée' });
}

// Gestion de la paie (Espace Finance, hors des diagrammes détaillés mais
// présent dans le cas d'utilisation global) : un versement est toujours
// rattaché à une fiche Personnel existante, jamais à un nom libre.
async function verserSalaire(req, res) {
  const { personnelId, montant, periode, dateVersement } = req.body;
  if (!personnelId || !montant || !periode) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }
  const personne = await Personnel.findByPk(personnelId);
  if (!personne || personne.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'personnel introuvable' });
  }

  const salaire = await Salaire.create({
    personnelId,
    montant,
    periode,
    dateVersement,
    statut: 'verse',
    gereParFinanceId: req.utilisateur.id,
  });
  return res.status(201).json({ salaire });
}

module.exports = {
  definirFrais,
  roulementFraisParClasse,
  listerFraisEleve,
  enregistrerPaiement,
  listerPaiementsEleve,
  verifierImpayes,
  tableauDeBordImpayes,
  envoyerRelance,
  verserSalaire,
};
