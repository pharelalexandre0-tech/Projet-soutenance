const { CompteEphemere, Professeur, Classe, Matiere, UniteEnseignement, Semestre, Eleve } = require('../models');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { enregistrerMoyenne } = require('./notesController');

// Diagramme 4 : Academie -> creer un compte ephemere (portee, duree de
// validite) -> genererCompteEphemere -> enregistrer -> envoyer le lien
// (ici : on le renvoie dans la reponse et on le "logge", faute de service
// SMTP reel en environnement de demo).
async function creerCompteEphemere(req, res) {
  const { professeurId, classeId, matiereId, categorie, evaluationLibelle, dureeMinutes, tache } = req.body;

  if (!professeurId || !classeId || !matiereId) {
    return res.status(400).json({ erreur: 'portée incomplète (professeur, classe, matière requis)' });
  }

  const [professeur, classe, matiere] = await Promise.all([
    Professeur.findByPk(professeurId),
    Classe.findByPk(classeId),
    Matiere.findByPk(matiereId, { include: [{ model: UniteEnseignement, include: [Semestre] }] }),
  ]);
  const etabId = req.utilisateur.etablissementId;
  if (
    !professeur || professeur.etablissementId !== etabId ||
    !classe || classe.etablissementId !== etabId ||
    !matiere || matiere.UniteEnseignement?.Semestre?.etablissementId !== etabId
  ) {
    return res.status(404).json({ erreur: 'professeur, classe ou matière introuvable' });
  }

  const duree = Number(dureeMinutes) > 0 ? Number(dureeMinutes) : 60; // 1h par defaut
  const dateExpiration = new Date(Date.now() + duree * 60 * 1000);

  const compte = await CompteEphemere.create({
    jeton: genererJetonEphemere(),
    tache: tache || 'saisie_notes',
    categorie: categorie === 'examen' ? 'examen' : 'cc',
    evaluationLibelle: evaluationLibelle || null,
    dateExpiration,
    statut: 'actif',
    professeurId,
    classeId,
    matiereId,
    creeParAcademieId: req.utilisateur.id,
  });

  const lien = `${process.env.EPHEMERE_LIEN_BASE_URL}/${compte.jeton}`;
  // "envoyer le lien / jeton" au Professeur : log serveur en environnement
  // de demo (remplacer par un vrai service e-mail en production).
  console.log(`[Service E-mail] Lien d'accès temporaire envoyé à ${professeur.email} : ${lien}`);

  return res.status(201).json({
    compte: {
      id: compte.id,
      statut: compte.statut,
      dateExpiration: compte.dateExpiration,
      portee: {
        classe: classe.nom,
        ue: matiere.UniteEnseignement?.intitule,
        matiere: matiere.intitule,
        categorie: compte.categorie,
        evaluation: compte.evaluationLibelle,
      },
    },
    lien,
  });
}

// verifierJeton(jeton) : ouvre la session temporaire si le jeton est valide
// (le middleware verifierCompteEphemere a deja fait le controle).
async function verifierJeton(req, res) {
  const compte = req.compteEphemere;
  const [classe, matiere, professeur, eleves] = await Promise.all([
    Classe.findByPk(compte.classeId),
    Matiere.findByPk(compte.matiereId, { include: [UniteEnseignement] }),
    Professeur.findByPk(compte.professeurId),
    Eleve.findAll({ where: { classeId: compte.classeId }, order: [['nom', 'ASC']] }),
  ]);

  return res.json({
    session: 'temporaire',
    professeur: { nom: professeur.nom, prenom: professeur.prenom },
    portee: {
      classe: classe.nom,
      ue: matiere.UniteEnseignement?.intitule,
      matiere: matiere.intitule,
      categorie: compte.categorie,
      evaluation: compte.evaluationLibelle,
    },
    dateExpiration: compte.dateExpiration,
    eleves: eleves.map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom })),
  });
}

// enregistrerNotes(liste des moyennes, jeton) -> sauvegarder -> confirmation
// -> signaler tache terminee -> revoquer le compte.
async function enregistrerNotesEphemere(req, res) {
  const compte = req.compteEphemere;
  const { notes } = req.body; // [{ eleveId, valeur }] — valeur = moyenne CC ou Examen selon compte.categorie

  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ erreur: 'aucune note fournie' });
  }

  const eleves = await Eleve.findAll({ where: { classeId: compte.classeId } });
  const idsEleveClasse = new Set(eleves.map((e) => e.id));
  for (const n of notes) {
    if (!idsEleveClasse.has(n.eleveId)) {
      return res.status(400).json({ erreur: "un élève ne correspond pas à la portée du compte éphémère" });
    }
  }

  const resultats = [];
  for (const n of notes) {
    if (n.valeur === '' || n.valeur === undefined || n.valeur === null) continue;
    resultats.push(
      await enregistrerMoyenne({
        eleveId: n.eleveId,
        matiereId: compte.matiereId,
        categorie: compte.categorie,
        valeur: Number(n.valeur),
        compteEphemereId: compte.id,
        etablissementId: eleves.find((e) => e.id === n.eleveId)?.etablissementId,
      })
    );
  }

  // signaler tâche terminée -> révoquer le compte éphémère (fin de tâche).
  compte.statut = 'revoque';
  await compte.save();

  return res.status(201).json({
    message: 'notes enregistrées',
    resultats,
    compte: { statut: compte.statut },
  });
}

module.exports = { creerCompteEphemere, verifierJeton, enregistrerNotesEphemere };
