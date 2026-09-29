const { Op } = require('sequelize');
const { EntreeExtension, Utilisateur, Notification } = require('../models');
const { extensionPour } = require('../services/plateformeService');
const { lireValeurs, repondre } = require('../services/extensionService');

// Utilisation des fonctionnalités personnalisées actives d'une école :
// l'assistant qui répond aux questions, les formulaires envoyés à
// l'Académie, les registres qu'elle tient. Chaque école ne voit que ses
// propres données.

const STATUTS_DEMANDE = ['nouvelle', 'en-cours', 'traitee'];
const LIBELLES_STATUTS = { nouvelle: 'reçue', 'en-cours': 'en cours de traitement', traitee: 'traitée' };

function auteur(req) {
  const u = req.utilisateur;
  const nom = `${u.prenom} ${u.nom}`.trim();
  if (req.sessionParent) return { auteurNom: `Parent de ${nom}`, auteurEspace: 'parent' };
  return { auteurNom: nom, auteurEspace: u.role };
}

function serialiser(entree) {
  return {
    id: entree.id,
    nature: entree.nature,
    auteurNom: entree.auteurNom,
    auteurEspace: entree.auteurEspace,
    donnees: entree.donnees,
    statut: entree.statut,
    reponseAcademie: entree.reponseAcademie,
    createdAt: entree.createdAt,
    updatedAt: entree.updatedAt,
  };
}

async function chargerExtension(req, res, types) {
  const extension = await extensionPour(req.utilisateur, req.params.cle);
  if (!extension || (types && !types.includes(extension.type))) {
    res.status(404).json({ erreur: "cette fonctionnalité n'est pas disponible dans votre espace" });
    return null;
  }
  return extension;
}

async function notifierAcademie(etablissementId, contenu) {
  const academie = await Utilisateur.findAll({ where: { role: 'academie', etablissementId }, attributes: ['id'] });
  if (academie.length) await Notification.bulkCreate(academie.map((u) => ({ utilisateurId: u.id, contenu: contenu.slice(0, 250) })));
}

// Ce que l'onglet affiche au chargement, selon le type et le rôle.
async function lireDonnees(req, res) {
  const extension = await chargerExtension(req, res);
  if (!extension) return null;
  const base = { cle: extension.cle, etablissementId: req.utilisateur.etablissementId };

  if (extension.type === 'assistant') {
    const mesQuestions = await EntreeExtension.findAll({
      where: { ...base, nature: 'question', auteurId: req.utilisateur.id, auteurEspace: auteur(req).auteurEspace },
      order: [['createdAt', 'DESC']],
      limit: 30,
    });
    const reponse = { historique: mesQuestions.reverse().map(serialiser) };
    if (extension.gestion) {
      const toutes = await EntreeExtension.findAll({ where: { ...base, nature: 'question' }, order: [['createdAt', 'DESC']], limit: 300 });
      reponse.questions = toutes.map(serialiser);
    }
    return res.json(reponse);
  }

  if (extension.type === 'formulaire') {
    const where = { ...base, nature: 'soumission' };
    if (!extension.gestion) Object.assign(where, { auteurId: req.utilisateur.id, auteurEspace: auteur(req).auteurEspace });
    const demandes = await EntreeExtension.findAll({ where, order: [['createdAt', 'DESC']], limit: 500 });
    return res.json({ demandes: demandes.map(serialiser) });
  }

  if (extension.type === 'registre') {
    const elements = await EntreeExtension.findAll({ where: { ...base, nature: 'element' }, order: [['createdAt', 'DESC']], limit: 1000 });
    return res.json({ elements: elements.map(serialiser) });
  }

  return res.json({});
}

async function poserQuestion(req, res) {
  const extension = await chargerExtension(req, res, ['assistant']);
  if (!extension) return null;
  const question = String(req.body.question || '').trim().slice(0, 300);
  if (question.length < 2) return res.status(400).json({ erreur: 'écrivez votre question' });

  const resultat = repondre(extension.configuration, question);
  const entree = await EntreeExtension.create({
    cle: extension.cle,
    etablissementId: req.utilisateur.etablissementId,
    nature: 'question',
    auteurId: req.utilisateur.id,
    ...auteur(req),
    donnees: { question, reponse: resultat.reponse, sujet: resultat.sujet || null, suggestions: resultat.suggestions },
    statut: resultat.trouvee ? 'repondue' : 'sans-reponse',
  });
  return res.status(201).json({ entree: serialiser(entree) });
}

async function envoyerDemande(req, res) {
  const extension = await chargerExtension(req, res, ['formulaire']);
  if (!extension) return null;
  if (!extension.utilisation) return res.status(403).json({ erreur: "l'Académie reçoit les demandes, elle ne les envoie pas" });
  const { erreur, valeurs } = lireValeurs(extension.configuration.champs, req.body.valeurs);
  if (erreur) return res.status(400).json({ erreur });

  const qui = auteur(req);
  const entree = await EntreeExtension.create({
    cle: extension.cle,
    etablissementId: req.utilisateur.etablissementId,
    nature: 'soumission',
    auteurId: req.utilisateur.id,
    ...qui,
    donnees: valeurs,
    statut: 'nouvelle',
  });
  await notifierAcademie(req.utilisateur.etablissementId, `Nouvelle demande « ${extension.nom} » de ${qui.auteurNom}.`);
  return res.status(201).json({ entree: serialiser(entree), message: extension.configuration.messageConfirmation });
}

async function traiterDemande(req, res) {
  const extension = await chargerExtension(req, res, ['formulaire']);
  if (!extension) return null;
  if (!extension.gestion) return res.status(403).json({ erreur: "seule l'Académie traite les demandes" });
  const demande = await EntreeExtension.findOne({
    where: { id: req.params.id, cle: extension.cle, etablissementId: req.utilisateur.etablissementId, nature: 'soumission' },
  });
  if (!demande) return res.status(404).json({ erreur: 'demande introuvable' });
  if (!STATUTS_DEMANDE.includes(req.body.statut)) return res.status(400).json({ erreur: 'statut invalide' });

  const reponse = req.body.reponseAcademie === undefined ? demande.reponseAcademie : String(req.body.reponseAcademie || '').trim().slice(0, 1000) || null;
  const changement = demande.statut !== req.body.statut;
  await demande.update({ statut: req.body.statut, reponseAcademie: reponse });
  if (changement && demande.auteurId) {
    await Notification.create({
      utilisateurId: demande.auteurId,
      contenu: `Votre demande « ${extension.nom} » est ${LIBELLES_STATUTS[demande.statut]}.`.slice(0, 250),
    });
  }
  return res.json({ entree: serialiser(demande) });
}

async function enregistrerElement(req, res) {
  const extension = await chargerExtension(req, res, ['registre']);
  if (!extension) return null;
  if (!extension.gestion) return res.status(403).json({ erreur: "seule l'Académie tient ce registre" });
  const colonnes = extension.configuration.colonnes.map((c) => ({ ...c, obligatoire: false }));
  const { erreur, valeurs } = lireValeurs(colonnes, req.body.valeurs, { toutFacultatif: true });
  if (erreur) return res.status(400).json({ erreur });

  if (req.params.id) {
    const element = await EntreeExtension.findOne({
      where: { id: req.params.id, cle: extension.cle, etablissementId: req.utilisateur.etablissementId, nature: 'element' },
    });
    if (!element) return res.status(404).json({ erreur: 'ligne introuvable' });
    await element.update({ donnees: valeurs });
    return res.json({ entree: serialiser(element) });
  }
  const element = await EntreeExtension.create({
    cle: extension.cle,
    etablissementId: req.utilisateur.etablissementId,
    nature: 'element',
    auteurId: req.utilisateur.id,
    ...auteur(req),
    donnees: valeurs,
    statut: 'publie',
  });
  return res.status(201).json({ entree: serialiser(element) });
}

async function supprimerElement(req, res) {
  const extension = await chargerExtension(req, res, ['registre']);
  if (!extension) return null;
  if (!extension.gestion) return res.status(403).json({ erreur: "seule l'Académie tient ce registre" });
  const nb = await EntreeExtension.destroy({
    where: { id: req.params.id, cle: extension.cle, etablissementId: req.utilisateur.etablissementId, nature: 'element' },
  });
  if (!nb) return res.status(404).json({ erreur: 'ligne introuvable' });
  return res.json({ message: 'ligne supprimée' });
}

// L'Académie peut effacer les questions déjà prises en compte.
async function effacerQuestions(req, res) {
  const extension = await chargerExtension(req, res, ['assistant']);
  if (!extension) return null;
  if (!extension.gestion) return res.status(403).json({ erreur: "seule l'Académie gère les questions posées" });
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  const where = { cle: extension.cle, etablissementId: req.utilisateur.etablissementId, nature: 'question' };
  if (ids.length) where.id = { [Op.in]: ids };
  const nb = await EntreeExtension.destroy({ where });
  return res.json({ supprimees: nb });
}

module.exports = {
  lireDonnees,
  poserQuestion,
  envoyerDemande,
  traiterDemande,
  enregistrerElement,
  supprimerElement,
  effacerQuestions,
};
