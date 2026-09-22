const { Note, Matiere, UniteEnseignement } = require('../models');

const SEUIL_VALIDATION_UE = 10; // sur 20, convention systeme LMD
const NOTE_ELIMINATOIRE = 7; // sur 20 : sous ce seuil, la matière bloque la validation de l'UE même si la moyenne pondérée compenserait

// Note finale d'une matière = moyenne simple entre CC et Examen (50/50), pas
// une pondération. La pondération par coefficient n'intervient qu'au niveau
// supérieur (moyenne d'une UE = moyenne de ses matières pondérée par leur
// coefficient, moyenne générale = moyenne des UE pondérée par leur
// coefficient) — jamais dans le calcul CC/Examen lui-même. Si une seule des
// deux a été saisie, elle sert de note finale provisoire plutôt que de
// bloquer l'affichage.
function calculerNoteFinale(moyenneCC, moyenneExamen) {
  if (moyenneCC === null || moyenneCC === undefined) {
    return moyenneExamen ?? null;
  }
  if (moyenneExamen === null || moyenneExamen === undefined) {
    return moyenneCC;
  }
  return Math.round(((moyenneCC + moyenneExamen) / 2) * 100) / 100;
}

async function obtenirNoteSession(eleveId, matiereId, session) {
  const note = await Note.findOne({ where: { eleveId, matiereId, session } });
  if (!note) return null;
  const noteFinale = calculerNoteFinale(note.moyenneCC, note.moyenneExamen);
  if (noteFinale === null) return null;
  return {
    moyenneCC: note.moyenneCC,
    moyenneExamen: note.moyenneExamen,
    noteFinale,
    eliminatoire: noteFinale < NOTE_ELIMINATOIRE,
  };
}

// Quand une matière a été repassée, la note retenue est la MOYENNE de la
// session normale et de la session de rattrapage (convention LMD) — jamais
// seulement la meilleure des deux, pour ne pas effacer complètement l'échec
// initial. S'il n'y a pas de note normale (cas rare), le rattrapage sert
// seul de note retenue.
async function obtenirResultatMatiere(eleveId, matiereId) {
  const normale = await obtenirNoteSession(eleveId, matiereId, 'normale');
  const rattrapage = await obtenirNoteSession(eleveId, matiereId, 'rattrapage');
  if (!normale && !rattrapage) return null;

  let retenue;
  let sessionRetenue;
  if (rattrapage) {
    const baseNormale = normale ? normale.noteFinale : rattrapage.noteFinale;
    const noteFinale = Math.round(((baseNormale + rattrapage.noteFinale) / 2) * 100) / 100;
    retenue = {
      moyenneCC: rattrapage.moyenneCC,
      moyenneExamen: rattrapage.moyenneExamen,
      noteFinale,
      eliminatoire: noteFinale < NOTE_ELIMINATOIRE,
    };
    sessionRetenue = 'rattrapage';
  } else {
    retenue = normale;
    sessionRetenue = 'normale';
  }

  return { normale, rattrapage, retenue, sessionRetenue };
}

// Utilisé par le diagramme 5 (Bulletin) et par le relevé de notes de l'Étudiant :
// moyenne générale pondérée par le coefficient de chaque UE (chaque UE étant
// elle-même la moyenne de ses matières pondérée par leur propre coefficient).
// Une UE n'est "validée" que si sa moyenne atteint le seuil, qu'aucune de ses
// matières retenues n'est éliminatoire, ET qu'aucune n'est passée par le
// rattrapage — une UE rattrapée reste étiquetée "rattrapage", jamais confondue
// avec une validation en session normale, même quand la moyenne suffirait.
async function calculerBulletin(eleveId, semestreId) {
  const ues = await UniteEnseignement.findAll({ where: { semestreId }, include: [Matiere] });

  let sommePondereeGenerale = 0;
  let sommeCoefficientsGenerale = 0;
  let creditsValides = 0;
  let creditsTotal = 0;
  const detailParUE = [];

  for (const ue of ues) {
    let sommePondereeUE = 0;
    let sommeCoefficientsUE = 0;
    let eliminatoireUE = false;
    let rattrapageUtilise = false;
    let uneMatiereNotee = false;
    const detailMatieres = [];

    for (const matiere of ue.Matieres) {
      const resultat = await obtenirResultatMatiere(eleveId, matiere.id);
      if (!resultat) continue;
      uneMatiereNotee = true;
      const { normale, rattrapage, retenue, sessionRetenue } = resultat;

      sommePondereeUE += retenue.noteFinale * matiere.coefficient;
      sommeCoefficientsUE += matiere.coefficient;
      if (retenue.eliminatoire) eliminatoireUE = true;
      if (sessionRetenue === 'rattrapage') rattrapageUtilise = true;

      detailMatieres.push({
        matiere: matiere.intitule,
        code: matiere.code,
        coefficient: matiere.coefficient,
        moyenneCC: retenue.moyenneCC,
        moyenneExamen: retenue.moyenneExamen,
        noteFinale: retenue.noteFinale,
        eliminatoire: retenue.eliminatoire,
        session: sessionRetenue,
        rattrapage: rattrapage ? { moyenneCC: rattrapage.moyenneCC, moyenneExamen: rattrapage.moyenneExamen, noteFinale: rattrapage.noteFinale } : null,
        normale: normale ? { moyenneCC: normale.moyenneCC, moyenneExamen: normale.moyenneExamen, noteFinale: normale.noteFinale } : null,
      });
    }

    if (!uneMatiereNotee) continue; // aucune matière notée pour cette UE
    // `sommeCoefficientsUE` peut rester à 0 même quand une matière EST notée
    // (coefficient 0 mal saisi) — auparavant ce cas était confondu avec
    // "rien de noté" et faisait disparaître toute l'UE du bulletin, y
    // compris une note éliminatoire qu'elle contenait.
    const moyenneUE = sommeCoefficientsUE > 0 ? Math.round((sommePondereeUE / sommeCoefficientsUE) * 100) / 100 : 0;
    const seuilAtteint = moyenneUE >= SEUIL_VALIDATION_UE && !eliminatoireUE;
    // Une UE qui est passée par le rattrapage n'est jamais comptée comme
    // "validée" au même titre qu'une validation en session normale — même
    // si la moyenne recalculée franchit le seuil, elle reste étiquetée
    // "rattrapage" et ne rapporte pas les crédits de la session normale.
    const valide = seuilAtteint && !rattrapageUtilise;

    sommePondereeGenerale += moyenneUE * ue.coefficient;
    sommeCoefficientsGenerale += ue.coefficient;
    creditsTotal += ue.credits;
    if (valide) creditsValides += ue.credits;

    detailParUE.push({
      ue: ue.intitule,
      code: ue.code,
      moyenne: moyenneUE,
      credits: ue.credits,
      coefficient: ue.coefficient,
      valide,
      seuilAtteint,
      eliminatoire: eliminatoireUE,
      session: rattrapageUtilise ? 'rattrapage' : 'normale',
      matieres: detailMatieres,
    });
  }

  const moyenneGenerale =
    sommeCoefficientsGenerale > 0
      ? Math.round((sommePondereeGenerale / sommeCoefficientsGenerale) * 100) / 100
      : 0;

  // Admis seulement si chaque UE évaluée est individuellement validée — la
  // moyenne générale seule ne suffit pas à compenser une UE éliminatoire ou
  // sous le seuil (conforme au fonctionnement réel d'un jury LMD).
  const admis = detailParUE.length > 0 && detailParUE.every((u) => u.valide);
  const sessionGlobale = detailParUE.some((u) => u.session === 'rattrapage') ? 'rattrapage' : 'normale';

  return { moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE };
}

module.exports = {
  calculerNoteFinale,
  obtenirResultatMatiere,
  calculerBulletin,
  SEUIL_VALIDATION_UE,
  NOTE_ELIMINATOIRE,
};
