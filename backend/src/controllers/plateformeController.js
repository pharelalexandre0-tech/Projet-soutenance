const { MiseAJour, Etablissement } = require('../models');
const { fonctionnalitesPour, extensionsPour, annonceEnCours, maintenanceEnCours } = require('../services/plateformeService');

// Sans session : l'écran de connexion et l'écran d'attente doivent pouvoir
// dire "maintenance en cours" à quelqu'un qui n'a justement plus accès.
// Rien d'autre que l'état de maintenance ne sort d'ici.
async function statutPublic(req, res) {
  const maintenance = await maintenanceEnCours();
  return res.json({
    maintenance: maintenance
      ? { actif: true, message: maintenance.message || null, finPrevue: maintenance.finPrevue || null }
      : { actif: false },
  });
}

// Tout ce que l'espace d'un utilisateur doit savoir de la plateforme au
// chargement (et à chaque rafraîchissement périodique) : quels modules son
// école a ouverts, l'annonce en cours, et les notes de version qui le
// concernent, avec celles qu'il n'a pas encore vues.
async function etatPourUtilisateur(req, res) {
  const utilisateur = req.utilisateur;
  const [fonctionnalites, extensions, annonce, publiees] = await Promise.all([
    fonctionnalitesPour(utilisateur.etablissementId),
    extensionsPour(utilisateur.etablissementId, utilisateur.role),
    annonceEnCours(),
    MiseAJour.findAll({ where: { statut: 'publiee' }, order: [['publieeLe', 'DESC']], limit: 40 }),
  ]);

  const reference = new Date(utilisateur.nouveautesVuesLe || utilisateur.createdAt);
  const pourMoi = publiees
    .filter((m) => !Array.isArray(m.espaces) || m.espaces.length === 0 || m.espaces.includes(utilisateur.role))
    .slice(0, 15)
    .map((m) => ({
      id: m.id,
      version: m.version,
      titre: m.titre,
      contenu: m.contenu,
      type: m.type,
      publieeLe: m.publieeLe,
      nonLue: new Date(m.publieeLe) > reference,
    }));

  return res.json({
    fonctionnalites,
    extensions,
    annonce: annonce ? { message: annonce.message, niveau: annonce.niveau, publieeLe: annonce.publieeLe } : null,
    nouveautes: pourMoi,
    nonLues: pourMoi.filter((m) => m.nonLue).length,
  });
}

async function marquerNouveautesVues(req, res) {
  req.utilisateur.nouveautesVuesLe = new Date();
  await req.utilisateur.save();
  return res.json({ nonLues: 0 });
}

// Logo d'un établissement servi comme une vraie image : les e-mails ne
// peuvent pas afficher un data URI, il leur faut une adresse publique.
// Seul le logo sort d'ici (déjà visible sur les documents de l'école).
async function logoEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id, { attributes: ['logo'] });
  const correspondance = etablissement?.logo?.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!correspondance) return res.status(404).end();
  res.set('Content-Type', correspondance[1] === 'image/jpg' ? 'image/jpeg' : correspondance[1]);
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.send(Buffer.from(correspondance[2], 'base64'));
}

module.exports = { statutPublic, etatPourUtilisateur, marquerNouveautesVues, logoEtablissement };
