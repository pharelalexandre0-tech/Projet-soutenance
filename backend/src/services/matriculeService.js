const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Eleve, Etablissement, Utilisateur } = require('../models');

// Mots ignorés quand l'établissement n'a pas de sigle et qu'on en déduit un
// de ses initiales ("Collège supérieur de Paris" -> CSP).
const MOTS_IGNORES = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'ET', 'D', 'L', 'EN', 'A', 'AU', 'AUX', 'THE', 'OF']);

function sansAccents(texte) {
  return String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

function prefixe(etablissement) {
  const sigle = sansAccents(etablissement?.sigle).replace(/[^A-Z0-9]/g, '');
  if (sigle) return sigle.slice(0, 8);
  const initiales = sansAccents(etablissement?.nom)
    .split(/[^A-Z0-9]+/)
    .filter((mot) => mot && !MOTS_IGNORES.has(mot))
    .map((mot) => mot[0])
    .join('');
  return (initiales || 'ETU').slice(0, 6);
}

// Prochain matricule libre pour cette école : SIGLE-ANNÉE-NNNN, numéroté à
// la suite du plus grand déjà attribué pour ce sigle et cette année.
async function prochainMatricule(etablissementId, annee = new Date().getFullYear()) {
  const etablissement = await Etablissement.findByPk(etablissementId, { attributes: ['nom', 'sigle'] });
  const base = `${prefixe(etablissement)}-${annee}-`;
  const existants = await Eleve.findAll({ where: { matricule: { [Op.like]: `${base}%` } }, attributes: ['matricule'] });
  const plusGrand = existants.reduce((max, e) => Math.max(max, parseInt(e.matricule.slice(base.length), 10) || 0), 0);
  return `${base}${String(plusGrand + 1).padStart(4, '0')}`;
}

// Attribue un matricule à un élève (nouveau ou existant) et en fait le mot
// de passe de son compte étudiant. Réessaie si deux inscriptions
// simultanées ont tiré le même numéro (contrainte d'unicité).
async function attribuerMatricule(eleve, annee) {
  for (let essai = 0; essai < 5; essai += 1) {
    const matricule = await prochainMatricule(eleve.etablissementId, annee);
    try {
      eleve.matricule = matricule;
      await eleve.save();
      if (eleve.compteEtudiantId) {
        await Utilisateur.update(
          { motDePasse: await bcrypt.hash(matricule, 10) },
          { where: { id: eleve.compteEtudiantId, role: 'etudiant' } }
        );
      }
      return matricule;
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error("impossible d'attribuer un matricule unique, réessaie");
}

// Élèves inscrits avant l'arrivée des matricules : chacun reçoit le sien
// (année de son inscription), qui devient son mot de passe. Sans effet une
// fois tous les élèves pourvus.
async function attribuerMatriculesManquants() {
  const sansMatricule = await Eleve.findAll({ where: { matricule: null }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  for (const eleve of sansMatricule) {
    await attribuerMatricule(eleve, new Date(eleve.createdAt).getFullYear());
  }
  if (sansMatricule.length) console.log(`Matricules : ${sansMatricule.length} élève(s) existant(s) pourvu(s) d'un matricule.`);
}

module.exports = { prefixe, prochainMatricule, attribuerMatricule, attribuerMatriculesManquants };
