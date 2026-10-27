const { Note, Eleve, Matiere, UniteEnseignement, Semestre } = require('../models');
const { calculerNoteFinale, obtenirResultatMatiere } = require('../services/moyenneService');

// Enregistre (ou met à jour) la moyenne de CC ou d'Examen d'un élève dans
// une matière, pour une session donnée (normale ou rattrapage) — une seule
// ligne Note par (élève, matière, session), pas une ligne par évaluation.
// Réutilisé par la saisie directe (Académie) et par la saisie via compte
// éphémère (Professeur, toujours en session normale).
// Une note est un nombre de 0 à 20 (virgule ou point accepté). Toute autre
// valeur est refusée : jamais de 25/20 ni de note négative en base.
function lireNote(valeur) {
  const n = Number(String(valeur).trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : null;
}

// Contrôle tout le lot avant d'enregistrer quoi que ce soit (pas de saisie
// à moitié enregistrée). Renvoie un message d'erreur, ou null.
function erreurLotNotes(notes) {
  const invalides = notes.filter((n) => !(n.valeur === '' || n.valeur === undefined || n.valeur === null) && lireNote(n.valeur) === null);
  if (!invalides.length) return null;
  const exemples = invalides.slice(0, 3).map((n) => `« ${n.valeur} »`).join(', ');
  return `${invalides.length} note${invalides.length > 1 ? 's' : ''} hors de l'échelle 0 à 20 (${exemples}) : rien n'a été enregistré, corrigez-${invalides.length > 1 ? 'les' : 'la'} puis réessayez`;
}

async function enregistrerMoyenne({ eleveId, matiereId, categorie, valeur, session, saisiParAcademieId, compteEphemereId, etablissementId }) {
  if (etablissementId) {
    const eleve = await Eleve.findByPk(eleveId);
    if (!eleve || eleve.etablissementId !== etablissementId) {
      throw Object.assign(new Error('élève introuvable'), { status: 404 });
    }
  }

  valeur = lireNote(valeur);
  if (valeur === null) throw Object.assign(new Error("note hors de l'échelle 0 à 20"), { status: 400 });
  // Délibération close pour la classe et le semestre : notes verrouillées.
  await require('../services/deliberationService').verifierNotesModifiables(eleveId, matiereId);
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
  const erreurLot = erreurLotNotes(notes);
  if (erreurLot) return res.status(400).json({ erreur: erreurLot });

  const resultats = [];
  try {
    for (const n of notes) {
      if (n.valeur === '' || n.valeur === undefined || n.valeur === null) continue;
      resultats.push(
        await enregistrerMoyenne({
          eleveId: n.eleveId,
          matiereId: n.matiereId,
          categorie: n.categorie,
          valeur: n.valeur,
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

module.exports = { enregistrerMoyenne, saisirNotesAcademie, listerNotesEleve, erreurLotNotes };
