const { Note, Matiere, UniteEnseignement, Semestre, Etablissement, Eleve, Classe, Formation, ParcoursEleve } = require('../models');

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
    compensationActive: Boolean(etablissement.compensationActive),
    noteMinCompensation: etablissement.noteMinCompensation ?? null,
    passageDetteActif: Boolean(etablissement.passageDetteActif),
    creditsMinPassagePct: etablissement.creditsMinPassagePct ?? null,
  };
}
async function reglesEtablissement(etablissementId) {
  return reglesDe(etablissementId ? await Etablissement.findByPk(etablissementId, { attributes: ['seuilValidation', 'noteEliminatoire', 'compensationActive', 'noteMinCompensation', 'passageDetteActif', 'creditsMinPassagePct'] }) : null);
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
// Une UE est acquise (et donne ses crédits) quand sa moyenne atteint le seuil
// sans matière éliminatoire, en session normale comme au rattrapage ; `etat`
// garde la distinction : acquise, acquise_rattrapage, compensee, jury,
// eliminatoire ou non_validee.
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
    const valide = seuilAtteint;

    sommePondereeGenerale += moyenneUE * ue.coefficient;
    sommeCoefficientsGenerale += ue.coefficient;
    creditsTotal += ue.credits;
    if (valide) creditsValides += ue.credits;

    detailParUE.push({
      ueId: ue.id,
      semestreId,
      etat: valide ? (rattrapageUtilise ? 'acquise_rattrapage' : 'acquise') : (eliminatoireUE ? 'eliminatoire' : 'non_validee'),
      acquise: valide,
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

  // Compensation entre les UE du semestre, seulement si l'école l'a activée :
  // moyenne du semestre au seuil, UE au-dessus du minimum fixé par l'école et
  // sans matière éliminatoire.
  if (regles.compensationActive && regles.noteMinCompensation != null && moyenneGenerale >= regles.seuil) {
    for (const u of detailParUE) {
      if (u.valide || u.eliminatoire || u.moyenne < regles.noteMinCompensation) continue;
      u.valide = true;
      u.acquise = true;
      u.etat = 'compensee';
      creditsValides += u.credits;
    }
  }

  // Admis quand chaque UE évaluée est acquise (normale, rattrapage ou
  // compensation) ; une moyenne générale seule ne rachète jamais une UE.
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
  // Semestre accordé par le jury : les UE restantes donnent leurs crédits,
  // sans être confondues avec une validation par les notes.
  if (decisionJury === 'admis_jury') {
    for (const u of detailParUE) {
      if (u.acquise) continue;
      u.acquise = true;
      u.etat = 'jury';
      creditsValides += u.credits;
    }
  }

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

// Libellé du résultat d'une UE, le même sur tous les documents.
function libelleEtatUE(u, court = false) {
  switch (u.etat) {
    case 'acquise': return 'Validée';
    case 'acquise_rattrapage': return court ? 'Validée (rattr.)' : 'Validée au rattrapage';
    case 'compensee': return 'Compensée';
    case 'jury': return court ? 'Validée (jury)' : 'Validée par le jury';
    case 'eliminatoire': return u.session === 'rattrapage' ? 'Éliminatoire (rattr.)' : 'Éliminatoire';
    default: return 'Non validée';
  }
}

// ---------------------------------------------------------------------------
// Parcours LMD : capitalisation et crédits cumulés sur tout le cycle
// ---------------------------------------------------------------------------
const CREDITS_CYCLE = { licence: 180, master: 120, doctorat: 180 };
const LIBELLES_CYCLE = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };

function cycleDeNiveau(niveau) {
  const m = /licence|master|doctorat/i.exec(niveau || '');
  return m ? m[0].toLowerCase() : null;
}
const normaliser = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Une même UE d'une année sur l'autre : même cycle, même numéro de semestre,
// et même code ou même intitulé.
function clesUE(semestre, code, intitule) {
  const base = `${semestre.cycle}|${semestre.numero}`;
  return [`${base}|c:${normaliser(code)}`, `${base}|i:${normaliser(intitule)}`];
}

// `cache` (facultatif) : mêmes règles et mêmes UE pour toute une classe.
async function calculerParcours(eleveId, cache = {}) {
  const { decisionsJury } = require('./deliberationService');
  const eleve = await Eleve.findByPk(eleveId, { include: [{ model: Classe, include: [Formation] }] });
  if (!eleve) return null;
  cache.ues = cache.ues || new Map();
  const regles = cache.regles || (cache.regles = await reglesEtablissement(eleve.etablissementId));
  const formation = eleve.Classe?.Formation || null;

  const toutes = await Note.findAll({ where: { eleveId }, include: [{ model: Matiere, attributes: ['id'], include: [{ model: UniteEnseignement, attributes: ['id', 'semestreId'] }] }] });
  const notes = new Map(toutes.map((n) => [`${n.matiereId}|${n.session}`, n]));
  const semestreIds = [...new Set(toutes.map((n) => n.Matiere?.UniteEnseignement?.semestreId).filter(Boolean))];
  const semestres = semestreIds.length ? await Semestre.findAll({ where: { id: semestreIds }, order: [['anneeScolaire', 'ASC'], ['numero', 'ASC']] }) : [];

  const cycle = formation?.cycle || cycleDeNiveau(eleve.Classe?.niveau) || semestres[semestres.length - 1]?.cycle || 'licence';
  const creditsRequis = formation?.creditsRequis || CREDITS_CYCLE[cycle];

  // Du plus ancien au plus récent : une UE acquise le reste ; une UE repassée
  // remplace la tentative échouée ; aucune UE n'est comptée deux fois.
  const suivi = new Map();
  const lignesSemestres = [];
  for (const s of semestres) {
    if (!cache.ues.has(s.id)) cache.ues.set(s.id, await UniteEnseignement.findAll({ where: { semestreId: s.id }, include: [Matiere] }));
    const calcul = await calculerBulletin(eleveId, s.id, { ues: cache.ues.get(s.id), regles, notes, decisionsJury: await decisionsJury([eleveId], s.id) });
    const ues = [];
    for (const u of calcul.detailParUE) {
      const cles = clesUE(s, u.code, u.ue);
      const ligne = {
        ueId: u.ueId, code: u.code, intitule: u.ue, credits: u.credits, moyenne: u.moyenne, session: u.session,
        etat: u.etat, libelle: libelleEtatUE(u), acquise: u.acquise,
        semestreId: s.id, semestre: s.libelle, anneeScolaire: s.anneeScolaire, cycle: s.cycle, cles,
      };
      const precedente = cles.map((c) => suivi.get(c)).find(Boolean);
      if (precedente?.acquise) {
        ligne.etat = 'deja_acquise';
        ligne.libelle = 'Déjà acquise';
        ligne.dejaComptee = true;
      } else {
        if (precedente) {
          precedente.etat = 'repassee';
          precedente.libelle = 'Repassée ensuite';
          for (const c of precedente.cles) suivi.delete(c);
        }
        for (const c of cles) suivi.set(c, ligne);
      }
      ues.push(ligne);
    }
    lignesSemestres.push({
      id: s.id, libelle: s.libelle, anneeScolaire: s.anneeScolaire, cycle: s.cycle, moyenne: calcul.moyenneGenerale,
      admis: calcul.admis, decisionJury: calcul.decisionJury, creditsValides: calcul.creditsValides, creditsTotal: calcul.creditsTotal, ues,
    });
  }

  // Crédits obtenus ailleurs (mobilité, transfert) : acquis, et ils soldent
  // une UE à repasser de même code ou de même intitulé.
  const { CreditExterne } = require('../models');
  const externes = await CreditExterne.findAll({ where: { eleveId }, order: [['createdAt', 'ASC']] });
  const transferts = [];
  for (const t of externes) {
    const cles = clesUE({ cycle: t.cycle, numero: t.numeroSemestre }, t.code || t.intitule, t.intitule);
    const ligne = {
      ueId: `ext-${t.id}`, code: t.code, intitule: t.intitule, credits: t.credits, moyenne: t.note, etat: 'transfere', libelle: 'Transférée',
      acquise: true, semestre: `${LIBELLES_CYCLE[t.cycle] || t.cycle}, Semestre ${t.numeroSemestre}`, anneeScolaire: t.anneeScolaire, cycle: t.cycle, cles,
      etablissementOrigine: t.etablissementOrigine,
    };
    const precedente = cles.map((c) => suivi.get(c)).find(Boolean);
    if (precedente?.acquise) continue;
    if (precedente) { precedente.etat = 'repassee'; precedente.libelle = 'Validée par transfert'; for (const c of precedente.cles) suivi.delete(c); }
    for (const c of cles) suivi.set(c, ligne);
    transferts.push({ id: t.id, code: t.code, intitule: t.intitule, credits: t.credits, note: t.note, etablissementOrigine: t.etablissementOrigine, pays: t.pays, semestre: ligne.semestre, anneeScolaire: t.anneeScolaire });
  }

  const finales = [...new Set(suivi.values())];
  const parCycle = (c) => finales.filter((l) => l.cycle === c);
  const creditsAcquis = parCycle(cycle).filter((l) => l.acquise).reduce((t, l) => t + l.credits, 0);
  const dettes = parCycle(cycle).filter((l) => !l.acquise);
  const autresCycles = Object.keys(LIBELLES_CYCLE).filter((c) => c !== cycle && parCycle(c).length)
    .map((c) => ({ cycle: c, libelle: LIBELLES_CYCLE[c], creditsAcquis: parCycle(c).filter((l) => l.acquise).reduce((t, l) => t + l.credits, 0) }));

  // Programme restant : seulement quand la classe a une formation, sinon on
  // ne sait pas quelles UE de l'école concernent cet étudiant.
  const aVenir = [];
  if (formation) {
    const programme = await UniteEnseignement.findAll({ where: { formationId: formation.id }, include: [Semestre], order: [['code', 'ASC']] });
    const vues = new Set();
    for (const ue of programme) {
      const cles = clesUE(ue.Semestre, ue.code, ue.intitule);
      if (cles.some((c) => suivi.has(c) || vues.has(c))) continue;
      cles.forEach((c) => vues.add(c));
      aVenir.push({ ueId: ue.id, code: ue.code, intitule: ue.intitule, credits: ue.credits, semestre: ue.Semestre.libelle, anneeScolaire: ue.Semestre.anneeScolaire });
    }
  }

  return {
    cycle, libelleCycle: LIBELLES_CYCLE[cycle], creditsRequis, creditsAcquis,
    creditsRestants: Math.max(0, creditsRequis - creditsAcquis),
    pourcentage: Math.min(100, Math.round((creditsAcquis / creditsRequis) * 100)),
    formation: formation ? { id: formation.id, domaine: formation.domaine, mention: formation.mention, parcours: formation.parcours } : null,
    classe: eleve.Classe ? { id: eleve.Classe.id, nom: eleve.Classe.nom, niveau: eleve.Classe.niveau } : null,
    semestres: lignesSemestres, dettes, aVenir, autresCycles, regles, transferts,
    historique: await ParcoursEleve.findAll({ where: { eleveId }, order: [['createdAt', 'ASC']], attributes: ['id', 'anneeScolaire', 'classeDepart', 'decision', 'classeArrivee', 'moyenneAnnuelle'] }),
  };
}

module.exports = {
  REGLES_PAR_DEFAUT,
  libelleEtatUE,
  calculerParcours,
  clesUE,
  calculerBulletinsClasse,
  reglesDe,
  reglesEtablissement,
  calculerNoteFinale,
  obtenirResultatMatiere,
  calculerBulletin,
};
