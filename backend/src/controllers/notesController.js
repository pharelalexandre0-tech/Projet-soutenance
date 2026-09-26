const { Note, Eleve, Matiere, UniteEnseignement, Semestre } = require('../models');
const { calculerNoteFinale, obtenirResultatMatiere } = require('../services/moyenneService');

// Enregistre (ou met à jour) la moyenne de CC ou d'Examen d'un élève dans
// une matière, pour une session donnée (normale ou rattrapage) — une seule
// ligne Note par (élève, matière, session), pas une ligne par évaluation.
// Réutilisé par la saisie directe (Académie) et par la saisie via compte
// éphémère (Professeur, toujours en session normale).
async function enregistrerMoyenne({ eleveId, matiereId, categorie, valeur, session, saisiParAcademieId, compteEphemereId, etablissementId }) {
  if (etablissementId) {
    const eleve = await Eleve.findByPk(eleveId);
    if (!eleve || eleve.etablissementId !== etablissementId) {
      throw Object.assign(new Error('élève introuvable'), { status: 404 });
    }
  }

  const champ = categorie === 'examen' ? 'moyenneExamen' : 'moyenneCC';
  const sessionUtilisee = session === 'rattrapage' ? 'rattrapage' : 'normale';

  let note = await Note.findOne({ where: { eleveId, matiereId, session: sessionUtilisee } });
  if (!note) {
    note = await Note.create({
      eleveId,
      matiereId,
      session: sessionUtilisee,
      [champ]: valeur,
      saisiParAcademieId: saisiParAcademieId || null,
      compteEphemereId: compteEphemereId || null,
    });
  } else {
    note[champ] = valeur;
    if (saisiParAcademieId) note.saisiParAcademieId = saisiParAcademieId;
    if (compteEphemereId) note.compteEphemereId = compteEphemereId;
    await note.save();
  }

  return {
    eleveId,
    matiereId,
    session: sessionUtilisee,
    moyenneCC: note.moyenneCC,
    moyenneExamen: note.moyenneExamen,
    noteFinale: calculerNoteFinale(note.moyenneCC, note.moyenneExamen),
  };
}

// Cas nominal (diagramme 4, note en bas) : l'Académie saisit directement les
// moyennes d'une classe pour une matière, sans passer par un compte éphémère.
// `session` s'applique à tout le lot (une saisie = une session normale ou de
// rattrapage, jamais un mélange des deux dans le même formulaire).
async function saisirNotesAcademie(req, res) {
  const { notes, session } = req.body; // [{ eleveId, matiereId, categorie, valeur }]
  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ erreur: 'aucune note fournie' });
  }

  const resultats = [];
  try {
    for (const n of notes) {
      if (n.valeur === '' || n.valeur === undefined || n.valeur === null) continue;
      resultats.push(
        await enregistrerMoyenne({
          eleveId: n.eleveId,
          matiereId: n.matiereId,
          categorie: n.categorie,
          valeur: Number(n.valeur),
          session,
          saisiParAcademieId: req.utilisateur.id,
          etablissementId: req.utilisateur.etablissementId,
        })
      );
    }
  } catch (err) {
    return res.status(err.status || 500).json({ erreur: err.message });
  }

  return res.status(201).json({ message: 'notes enregistrées', resultats });
}

// listerNotesEleve : une ligne par matière notée (session normale et
// rattrapage déjà fusionnées côté service — la meilleure des deux est
// retenue), pour que le relevé de l'Étudiant affiche le même résultat que
// le bulletin plutôt que deux lignes brutes par matière.
async function listerNotesEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }

  const lignes = await Note.findAll({
    where: { eleveId },
    include: [{ model: Matiere, include: [{ model: UniteEnseignement, include: [Semestre] }] }],
  });

  const matieresVues = new Map();
  lignes.forEach((n) => {
    if (!matieresVues.has(n.matiereId)) matieresVues.set(n.matiereId, n.Matiere);
  });

  const notes = [];
  for (const [matiereId, matiere] of matieresVues) {
    const resultat = await obtenirResultatMatiere(eleveId, matiereId);
    if (!resultat) continue;
    notes.push({
      matiereId,
      Matiere: matiere,
      moyenneCC: resultat.retenue.moyenneCC,
      moyenneExamen: resultat.retenue.moyenneExamen,
      noteFinale: resultat.retenue.noteFinale,
      eliminatoire: resultat.retenue.eliminatoire,
      session: resultat.sessionRetenue,
      aRattrapage: !!resultat.rattrapage,
    });
  }

  return res.json({ notes });
}

module.exports = { enregistrerMoyenne, saisirNotesAcademie, listerNotesEleve };
