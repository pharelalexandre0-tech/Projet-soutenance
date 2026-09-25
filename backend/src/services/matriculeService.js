const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Eleve, Etablissement, Utilisateur } = require('../models');

// Mots ignorés quand l'établissement n'a pas de sigle et qu'on en déduit un
// de ses initiales ("Collège supérieur de Paris" -> CSP).
const MOTS_IGNORES = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'ET', 'D', 'L', 'EN', 'A', 'AU', 'AUX', 'THE', 'OF']);
// Code de 2 caractères au milieu du matricule (ex. 2N, 7K) : un chiffre et
// une lettre tirés au hasard. Le matricule servant de mot de passe, cette
// partie le rend beaucoup moins facile à deviner qu'une simple suite
// SIGLE-0001, SIGLE-0002... Sans I ni O, trop proches de 1 et 0.
const CHIFFRES = '23456789';
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ANCIEN_FORMAT = /^([A-Z0-9]+)-(\d{4})-(\d{4,})$/;

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

function codeAleatoire() {
  return CHIFFRES[Math.floor(Math.random() * CHIFFRES.length)] + LETTRES[Math.floor(Math.random() * LETTRES.length)];
}

function numero(matricule) {
  return parseInt(String(matricule).split('-').pop(), 10) || 0;
}

// Prochain matricule libre pour cette école : SIGLE-XY-NNNN, numéroté à la
// suite du plus grand numéro déjà attribué pour ce sigle.
async function prochainMatricule(etablissementId) {
  const etablissement = await Etablissement.findByPk(etablissementId, { attributes: ['nom', 'sigle'] });
  const base = prefixe(etablissement);
  const existants = await Eleve.findAll({ where: { matricule: { [Op.like]: `${base}-%` } }, attributes: ['matricule'] });
  const plusGrand = existants.reduce((max, e) => Math.max(max, numero(e.matricule)), 0);
  return `${base}-${codeAleatoire()}-${String(plusGrand + 1).padStart(4, '0')}`;
}

async function enregistrer(eleve, matricule) {
  eleve.matricule = matricule;
  await eleve.save();
  if (eleve.compteEtudiantId) {
    await Utilisateur.update(
      { motDePasse: await bcrypt.hash(matricule, 10) },
      { where: { id: eleve.compteEtudiantId, role: 'etudiant' } }
    );
  }
  return matricule;
}

// Attribue un matricule à un élève (nouveau ou existant) et en fait le mot
// de passe de son compte étudiant. Réessaie si deux inscriptions
// simultanées ont tiré le même numéro (contrainte d'unicité).
async function attribuerMatricule(eleve) {
  for (let essai = 0; essai < 5; essai += 1) {
    try {
      return await enregistrer(eleve, await prochainMatricule(eleve.etablissementId));
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error("impossible d'attribuer un matricule unique, réessaie");
}

// Au démarrage : les matricules de l'ancien format (SIGLE-ANNÉE-NNNN)
// passent au format SIGLE-XY-NNNN en gardant leur numéro, puis les élèves
// qui n'en ont pas encore en reçoivent un. Le mot de passe suit à chaque fois.
async function attribuerMatriculesManquants() {
  const anciens = (await Eleve.findAll({ where: { matricule: { [Op.not]: null } } }))
    .filter((e) => ANCIEN_FORMAT.test(e.matricule));
  for (const eleve of anciens) {
    const [, base, , num] = eleve.matricule.match(ANCIEN_FORMAT);
    await enregistrer(eleve, `${base}-${codeAleatoire()}-${num}`);
  }

  const sansMatricule = await Eleve.findAll({ where: { matricule: null }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  for (const eleve of sansMatricule) await attribuerMatricule(eleve);

  if (anciens.length || sansMatricule.length) {
    console.log(`Matricules : ${anciens.length} converti(s) au nouveau format, ${sansMatricule.length} attribué(s).`);
  }
}

module.exports = { prefixe, prochainMatricule, attribuerMatricule, attribuerMatriculesManquants };
