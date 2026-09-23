const { CompteEphemere, Professeur, Classe, Matiere, UniteEnseignement, Semestre, Eleve } = require('../models');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { enregistrerMoyenne } = require('./notesController');
const { envoyerEmail } = require('../services/emailService');

// Diagramme 4 : Academie -> creer un compte ephemere (portee, duree de
// validite) -> genererCompteEphemere -> enregistrer -> envoyer le lien
// (ici : on le renvoie dans la reponse et on le "logge", faute de service
// SMTP reel en environnement de demo).
async function creerCompteEphemere(req, res) {
  const { professeurId, classeId, matiereId, categorie, evaluationLibelle, dureeMinutes, tache } = req.body;
  // La matière n'a de sens que pour la saisie de notes — un relevé
  // d'absences porte sur la classe entière, pas une matière précise.
  const tacheFinale = tache === 'saisie_absences' ? 'saisie_absences' : 'saisie_notes';

  if (!professeurId || !classeId || (tacheFinale === 'saisie_notes' && !matiereId)) {
    return res.status(400).json({
      erreur: `portée incomplète (professeur, classe${tacheFinale === 'saisie_notes' ? ', matière' : ''} requis)`,
    });
  }

  const [professeur, classe, matiere] = await Promise.all([
    Professeur.findByPk(professeurId),
    Classe.findByPk(classeId),
    matiereId ? Matiere.findByPk(matiereId, { include: [{ model: UniteEnseignement, include: [Semestre] }] }) : null,
  ]);
  const etabId = req.utilisateur.etablissementId;
  if (
    !professeur || professeur.etablissementId !== etabId ||
    !classe || classe.etablissementId !== etabId ||
    (tacheFinale === 'saisie_notes' && (!matiere || matiere.UniteEnseignement?.Semestre?.etablissementId !== etabId))
  ) {
    return res.status(404).json({ erreur: 'professeur, classe ou matière introuvable' });
  }

  const duree = Number(dureeMinutes) > 0 ? Number(dureeMinutes) : 60; // 1h par defaut
  const dateExpiration = new Date(Date.now() + duree * 60 * 1000);

  const compte = await CompteEphemere.create({
    jeton: genererJetonEphemere(),
    tache: tacheFinale,
    categorie: categorie === 'examen' ? 'examen' : 'cc',
    evaluationLibelle: evaluationLibelle || null,
    dateExpiration,
    statut: 'actif',
    professeurId,
    classeId,
    matiereId: matiereId || null,
    creeParAcademieId: req.utilisateur.id,
  });

  const lien = `${process.env.EPHEMERE_LIEN_BASE_URL}/${compte.jeton}`;
  const libelleTache = tacheFinale === 'saisie_absences' ? "faire l'appel" : 'saisir les notes';
  const expirationFormatee = dateExpiration.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  await envoyerEmail(
    professeur.email,
    `Accès temporaire — ${libelleTache} pour ${classe.nom}`,
    `Bonjour ${professeur.prenom},\n\nUn accès temporaire vous permet de ${libelleTache} pour la classe ${classe.nom}${matiere ? ` (${matiere.intitule})` : ''}.\n\nOuvrez ce lien pour commencer : ${lien}\n\nCe lien expire le ${expirationFormatee} et se révoque automatiquement une fois la saisie envoyée.`
  );

  return res.status(201).json({
    compte: {
      id: compte.id,
      statut: compte.statut,
      dateExpiration: compte.dateExpiration,
      tache: compte.tache,
      portee: {
        classe: classe.nom,
        ue: matiere?.UniteEnseignement?.intitule,
        matiere: matiere?.intitule,
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
    compte.matiereId ? Matiere.findByPk(compte.matiereId, { include: [UniteEnseignement] }) : null,
    Professeur.findByPk(compte.professeurId),
    Eleve.findAll({ where: { classeId: compte.classeId }, order: [['nom', 'ASC']] }),
  ]);
  // Le jeton peut rester valide (durée non écoulée) alors que le professeur
  // ou la classe visée a été supprimé entre-temps — sans ce contrôle,
  // `professeur.nom`/`classe.nom` plantait en 500 au lieu d'un message clair.
  if (!professeur || !classe) {
    return res.status(410).json({ erreur: 'ce lien ne correspond plus à un professeur ou une classe existant(e)' });
  }

  return res.json({
    session: 'temporaire',
    tache: compte.tache,
    professeur: { nom: professeur.nom, prenom: professeur.prenom },
    portee: {
      classe: classe.nom,
      ue: matiere?.UniteEnseignement?.intitule,
      matiere: matiere?.intitule,
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
