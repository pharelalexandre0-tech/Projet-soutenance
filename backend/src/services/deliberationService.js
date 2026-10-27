// Délibérations du jury : verrouillage des notes après clôture, décision
// du jury retenue par les bulletins, procès-verbaux et relevés.
const LIBELLES_DECISION = { admis: 'Admis(e)', admis_jury: 'Admis(e) par décision du jury', rattrapage: 'Rattrapage' };

// Semestre d'une matière (par son UE).
async function semestreDeMatiere(matiereId) {
  const { Matiere, UniteEnseignement } = require('../models');
  const matiere = await Matiere.findByPk(matiereId, { attributes: ['id'], include: [{ model: UniteEnseignement, attributes: ['semestreId'] }] });
  return matiere?.UniteEnseignement?.semestreId || null;
}

// Refuse toute écriture de note d'un étudiant dont la classe a déjà
// délibéré (délibération close) pour le semestre de la matière.
async function verifierNotesModifiables(eleveId, matiereId) {
  const { Eleve, Deliberation } = require('../models');
  const eleve = await Eleve.findByPk(eleveId, { attributes: ['classeId'] });
  const semestreId = await semestreDeMatiere(matiereId);
  if (!eleve?.classeId || !semestreId) return;
  const close = await Deliberation.findOne({ where: { classeId: eleve.classeId, semestreId, statut: 'close' }, attributes: ['id', 'closeLe'] });
  if (close) {
    const err = new Error('notes verrouillées : le jury de cette classe a déjà délibéré pour ce semestre (rouvrez la délibération pour corriger)');
    err.status = 423;
    throw err;
  }
}

// Décisions de jury retenues (délibérations closes) pour un semestre :
// Map eleveId -> { decision, motif }.
async function decisionsJury(eleveIds, semestreId) {
  const { Deliberation, DecisionJury } = require('../models');
  if (!eleveIds.length) return new Map();
  const decisions = await DecisionJury.findAll({
    where: { eleveId: eleveIds },
    include: [{ model: Deliberation, where: { semestreId, statut: 'close' }, attributes: ['id', 'closeLe'] }],
  });
  return new Map(decisions.map((d) => [d.eleveId, { decision: d.decision, motif: d.motif, closeLe: d.Deliberation.closeLe }]));
}

module.exports = { verifierNotesModifiables, decisionsJury, LIBELLES_DECISION, semestreDeMatiere };
