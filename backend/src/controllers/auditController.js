const { Op } = require('sequelize');
const { JournalAudit, Etablissement } = require('../models');
const { verifierChaine } = require('../services/auditService');

// Consultation du journal d'audit chaîné : le superadmin voit toute la
// plateforme et peut contrôler l'intégrité de la chaîne ; l'Académie ne
// voit que les entrées de son école.
const TAILLE_PAGE = 100;

async function lister(req, res) {
  const where = {};
  if (req.utilisateur.role === 'superadmin') {
    if (req.query.etablissementId === 'plateforme') where.etablissementId = null;
    else if (req.query.etablissementId) where.etablissementId = Number(req.query.etablissementId);
  } else {
    where.etablissementId = req.utilisateur.etablissementId;
  }
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.avant) where.id = { [Op.lt]: Number(req.query.avant) };
  if (req.query.q) {
    const motif = `%${String(req.query.q).trim().slice(0, 60)}%`;
    where[Op.or] = [{ auteur: { [Op.iLike]: motif } }, { cible: { [Op.iLike]: motif } }, { ip: { [Op.iLike]: motif } }];
  }
  const entrees = await JournalAudit.findAll({
    where,
    attributes: ['id', 'horodatage', 'etablissementId', 'role', 'auteur', 'action', 'cible', 'ip', 'empreinte'],
    order: [['id', 'DESC']],
    limit: TAILLE_PAGE,
  });
  let ecoles = {};
  if (req.utilisateur.role === 'superadmin') {
    const ids = [...new Set(entrees.map((e) => e.etablissementId).filter(Boolean))];
    ecoles = Object.fromEntries((await Etablissement.findAll({ where: { id: ids }, attributes: ['id', 'nom'] })).map((e) => [e.id, e.nom]));
  }
  return res.json({
    entrees: entrees.map((e) => ({ ...e.toJSON(), id: Number(e.id), ecole: e.etablissementId ? ecoles[e.etablissementId] || null : null })),
    suite: entrees.length === TAILLE_PAGE ? Number(entrees[entrees.length - 1].id) : null,
  });
}

async function integrite(req, res) {
  const resultat = await verifierChaine();
  return res.json({ ...resultat, verifieLe: new Date() });
}

module.exports = { lister, integrite };
