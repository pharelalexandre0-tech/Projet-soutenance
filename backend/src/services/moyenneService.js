const { Note, Matiere, UniteEnseignement, Semestre, Etablissement, Eleve } = require('../models');

// Valeurs par défaut (convention LMD), remplacées par celles de l'école :
// seuil de validation d'une UE, et note sous laquelle une matière est
// éliminatoire (elle bloque l'UE même si la moyenne pondérée compenserait).
const REGLES_PAR_DEFAUT = { seuil: 10, eliminatoire: 7 };

function reglesDe(etablissement) {
  if (!etablissement) return { ...REGLES_PAR_DEFAUT };
  const seuil = Number(etablissement.seuilValidation);
  const eliminatoire = Number(etablissement.noteEliminatoire);
  return {
    seuil: Number.isFinite(seuil) ? seuil : REGLES_PAR_DEFAUT.seuil,
    eliminatoire: Number.isFinite(eliminatoire) ? eliminatoire : REGLES_PAR_DEFAUT.eliminatoire,
  };
}
async function reglesEtablissement(etablissementId) {
  return reglesDe(etablissementId ? await Etablissement.findByPk(etablissementId, { attributes: ['seuilValidation', 'noteEliminatoire'] }) : null);
}
async function reglesEleve(eleveId) {
  const eleve = await Eleve.findByPk(eleveId, { attributes: ['etablissementId'] });
  return reglesEtablissement(eleve?.etablissementId);
}

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

// `notes` (facultatif) : notes déjà chargées pour l'élève, indexées par
// « matiereId|session » (calcul d'une classe entière en une seule lecture).
async function obtenirNoteSession(eleveId, matiereId, session, regles = REGLES_PAR_DEFAUT, notes = null) {
  const note = notes ? notes.get(`${matiereId}|${session}`) : await Note.findOne({ where: { eleveId, matiereId, session } });
  if (!note) return null;
  const noteFinale = calculerNoteFinale(note.moyenneCC, note.moyenneExamen);
  if (noteFinale === null) return null;
  return {
    moyenneCC: note.moyenneCC,
    moyenneExamen: note.moyenneExamen,
    noteFinale,
    eliminatoire: noteFinale < regles.eliminatoire,
  };
}

// Quand une matière a été repassée, la note retenue est la MOYENNE de la
// session normale et de la session de rattrapage (convention LMD) — jamais
// seulement la meilleure des deux, pour ne pas effacer complètement l'échec
// initial. S'il n'y a pas de note normale (cas rare), le rattrapage sert
// seul de note retenue.
async function obtenirResultatMatiere(eleveId, matiereId, regles = null, notes = null) {
  regles = regles || (await reglesEleve(eleveId));
  const normale = await obtenirNoteSession(eleveId, matiereId, 'normale', regles, notes);
  const rattrapage = await obtenirNoteSession(eleveId, matiereId, 'rattrapage', regles, notes);
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
      eliminatoire: noteFinale < regles.eliminatoire,
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
// `contexte` (facultatif) : { ues, regles, notes } déjà chargés, pour
// calculer toute une classe sans relire la base élève par élève.
async function calculerBulletin(eleveId, semestreId, contexte = null) {
  const ues = contexte?.ues || await UniteEnseignement.findAll({ where: { semestreId }, include: [Matiere] });
  let regles = contexte?.regles;
  if (!regles) {
    const semestre = await Semestre.findByPk(semestreId, { attributes: ['etablissementId'] });
    regles = await reglesEtablissement(semestre?.etablissementId);
  }
  const notes = contexte?.notes || null;

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
      const resultat = await obtenirResultatMatiere(eleveId, matiere.id, regles, notes);
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
    const seuilAtteint = moyenneUE >= regles.seuil && !eliminatoireUE;
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

  // Décision du jury (délibération close) : elle prime sur la décision
  // calculée ; « admis par décision du jury » reste distingué partout.
  let jury = contexte?.decisionsJury ? contexte.decisionsJury.get(eleveId) : undefined;
  if (jury === undefined) {
    const { decisionsJury } = require('./deliberationService');
    jury = (await decisionsJury([eleveId], semestreId)).get(eleveId);
  }
  const decisionJury = jury?.decision || null;
  const admisRetenu = decisionJury ? decisionJury !== 'rattrapage' : admis;

  return { moyenneGenerale, creditsValides, creditsTotal, admis: admisRetenu, admisCalcule: admis, decisionJury, sessionGlobale, detailParUE, regles };
}

// Bulletins de plusieurs élèves d'un même semestre : les UE, les règles et
// toutes les notes sont lues une seule fois.
async function calculerBulletinsClasse(eleveIds, semestreId) {
  const ues = await UniteEnseignement.findAll({ where: { semestreId }, include: [Matiere] });
  const semestre = await Semestre.findByPk(semestreId, { attributes: ['etablissementId'] });
  const regles = await reglesEtablissement(semestre?.etablissementId);
  const matiereIds = ues.flatMap((ue) => ue.Matieres.map((m) => m.id));
  const toutes = eleveIds.length && matiereIds.length ? await Note.findAll({ where: { eleveId: eleveIds, matiereId: matiereIds } }) : [];
  const parEleve = new Map(eleveIds.map((id) => [id, new Map()]));
  for (const n of toutes) parEleve.get(n.eleveId)?.set(`${n.matiereId}|${n.session}`, n);
  const resultats = new Map();
  const jury = await require('./deliberationService').decisionsJury(eleveIds, semestreId);
  for (const id of eleveIds) resultats.set(id, await calculerBulletin(id, semestreId, { ues, regles, notes: parEleve.get(id), decisionsJury: jury }));
  return resultats;
}

module.exports = {
  REGLES_PAR_DEFAUT,
  calculerBulletinsClasse,
  reglesDe,
  reglesEtablissement,
  calculerNoteFinale,
  obtenirResultatMatiere,
  calculerBulletin,
};
