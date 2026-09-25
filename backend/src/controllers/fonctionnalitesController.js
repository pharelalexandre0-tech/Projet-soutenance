const crypto = require('crypto');
const { Etablissement, FonctionnalitePersonnalisee, ActivationFonctionnalite } = require('../models');
const { MODULES_INTEGRES, ESPACES_PERSONNALISABLES, ICONES_PERSONNALISABLES } = require('../config/fonctionnalites');
const { catalogue, invaliderCache, journaliser } = require('../services/plateformeService');

// Fonctionnalités des écoles, pilotées par le superadmin : le catalogue
// (modules intégrés + fonctionnalités personnalisées qu'il crée lui-même),
// et leur ajout école par école, selon les besoins de chacune.

function erreur400(res, message) {
  return res.status(400).json({ erreur: message });
}

async function trouverDansCatalogue(cle) {
  const module = MODULES_INTEGRES.find((m) => m.cle === cle);
  if (module) return { cle: module.cle, nom: module.nom, integree: true };
  const perso = await FonctionnalitePersonnalisee.findOne({ where: { cle } });
  return perso ? { cle: perso.cle, nom: perso.nom, integree: false, perso } : null;
}

async function listerCatalogue(req, res) {
  const [liste, ecoles] = await Promise.all([
    catalogue(),
    Etablissement.findAll({ attributes: ['id', 'nom', 'ville', 'statut'], order: [['nom', 'ASC']] }),
  ]);
  const ids = new Set(ecoles.map((e) => e.id));
  return res.json({
    fonctionnalites: liste.map((f) => ({ ...f, ecoles: f.ecoles.filter((id) => ids.has(id)) })),
    ecoles,
    icones: ICONES_PERSONNALISABLES,
  });
}

function lireFonctionnalite(body) {
  if (!['page', 'lien'].includes(body.type)) return { erreur: 'type de fonctionnalité invalide' };
  const nom = String(body.nom || '').trim();
  if (nom.length < 2 || nom.length > 80) return { erreur: 'le nom doit faire entre 2 et 80 caractères' };
  const description = String(body.description || '').trim();
  if (!description || description.length > 300) return { erreur: 'la description est obligatoire (300 caractères au plus)' };
  const icone = ICONES_PERSONNALISABLES.includes(body.icone) ? body.icone : 'FileText';
  const espaces = Array.isArray(body.espaces) ? [...new Set(body.espaces.filter((e) => ESPACES_PERSONNALISABLES.includes(e)))] : [];
  if (espaces.length === 0) return { erreur: 'choisis au moins un espace où la fonctionnalité apparaîtra' };

  const donnees = { type: body.type, nom, description, icone, espaces, contenu: null, url: null, libelleBouton: null };
  if (body.type === 'page') {
    const contenu = String(body.contenu || '').trim();
    if (!contenu || contenu.length > 8000) return { erreur: 'le contenu de la page est obligatoire (8000 caractères au plus)' };
    donnees.contenu = contenu;
  } else {
    const url = String(body.url || '').trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url) || url.length > 500) return { erreur: "l'adresse du service doit commencer par https:// (ou http://)" };
    donnees.url = url;
    donnees.libelleBouton = String(body.libelleBouton || '').trim().slice(0, 60) || 'Ouvrir le service';
  }
  return { donnees };
}

async function idsEcolesValides(liste) {
  const demandees = Array.isArray(liste) ? liste.map(Number).filter(Number.isInteger) : [];
  if (demandees.length === 0) return [];
  const ecoles = await Etablissement.findAll({ where: { id: demandees }, attributes: ['id', 'nom'] });
  return ecoles;
}

async function creerFonctionnalite(req, res) {
  const { erreur, donnees } = lireFonctionnalite(req.body);
  if (erreur) return erreur400(res, erreur);

  const fonctionnalite = await FonctionnalitePersonnalisee.create({
    ...donnees,
    cle: `perso-${crypto.randomBytes(4).toString('hex')}`,
    auteurId: req.utilisateur.id,
  });
  // Écoles choisies dès la création (facultatif) : sinon la fonctionnalité
  // attend dans le catalogue qu'on l'ajoute à une école.
  const ecoles = await idsEcolesValides(req.body.ecoles);
  if (ecoles.length) {
    await ActivationFonctionnalite.bulkCreate(
      ecoles.map((e) => ({ etablissementId: e.id, cle: fonctionnalite.cle })),
      { ignoreDuplicates: true }
    );
  }
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', ecoles.length
    ? `Création de « ${fonctionnalite.nom} », ajoutée à ${ecoles.map((e) => e.nom).join(', ')}`
    : `Création de « ${fonctionnalite.nom} » (pas encore ajoutée à une école)`);
  return res.status(201).json({ fonctionnalite });
}

async function modifierFonctionnalite(req, res) {
  const fonctionnalite = await FonctionnalitePersonnalisee.findOne({ where: { cle: req.params.cle } });
  if (!fonctionnalite) return res.status(404).json({ erreur: 'seules les fonctionnalités personnalisées sont modifiables' });
  const { erreur, donnees } = lireFonctionnalite(req.body);
  if (erreur) return erreur400(res, erreur);
  await fonctionnalite.update(donnees);
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', `Modification de « ${fonctionnalite.nom} »`);
  return res.json({ fonctionnalite });
}

async function supprimerFonctionnalite(req, res) {
  const fonctionnalite = await FonctionnalitePersonnalisee.findOne({ where: { cle: req.params.cle } });
  if (!fonctionnalite) return res.status(404).json({ erreur: 'seules les fonctionnalités personnalisées peuvent être supprimées' });
  const nbEcoles = await ActivationFonctionnalite.destroy({ where: { cle: fonctionnalite.cle } });
  await fonctionnalite.destroy();
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', `Suppression de « ${fonctionnalite.nom} »${nbEcoles ? ` (retirée de ${nbEcoles} école${nbEcoles > 1 ? 's' : ''})` : ''}`);
  return res.json({ message: 'fonctionnalité supprimée' });
}

// Réglage depuis la fiche d'une fonctionnalité : la liste complète des
// écoles qui doivent l'avoir (ajouts et retraits en une fois).
async function definirEcoles(req, res) {
  const entree = await trouverDansCatalogue(req.params.cle);
  if (!entree) return res.status(404).json({ erreur: 'fonctionnalité inconnue' });
  const ecoles = await idsEcolesValides(req.body.ecoles);
  const voulues = new Set(ecoles.map((e) => e.id));

  const actuelles = await ActivationFonctionnalite.findAll({ where: { cle: entree.cle } });
  const aRetirer = actuelles.filter((a) => !voulues.has(a.etablissementId)).map((a) => a.id);
  const dejaLa = new Set(actuelles.map((a) => a.etablissementId));
  const aAjouter = [...voulues].filter((id) => !dejaLa.has(id));

  if (aRetirer.length) await ActivationFonctionnalite.destroy({ where: { id: aRetirer } });
  if (aAjouter.length) {
    await ActivationFonctionnalite.bulkCreate(aAjouter.map((id) => ({ etablissementId: id, cle: entree.cle })), { ignoreDuplicates: true });
  }
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', ecoles.length
    ? `« ${entree.nom} » attribuée à ${ecoles.length} école${ecoles.length > 1 ? 's' : ''} : ${ecoles.map((e) => e.nom).join(', ')}`
    : `« ${entree.nom} » retirée de toutes les écoles`);
  return listerCatalogue(req, res);
}

// Depuis la fiche d'une école : ajouter une ou plusieurs fonctionnalités
// du catalogue, selon ce dont cette école a besoin.
async function ajouterAEcole(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id, { attributes: ['id', 'nom'] });
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  const cles = Array.isArray(req.body.cles) ? [...new Set(req.body.cles.map(String))] : [];
  if (cles.length === 0) return erreur400(res, 'choisis au moins une fonctionnalité à ajouter');

  const entrees = (await Promise.all(cles.map(trouverDansCatalogue))).filter(Boolean);
  if (entrees.length === 0) return erreur400(res, 'fonctionnalité inconnue');
  await ActivationFonctionnalite.bulkCreate(
    entrees.map((e) => ({ etablissementId: etablissement.id, cle: e.cle })),
    { ignoreDuplicates: true }
  );
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', `Ajout à « ${etablissement.nom} » : ${entrees.map((e) => e.nom).join(', ')}`);
  return listerCatalogue(req, res);
}

async function retirerDeEcole(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id, { attributes: ['id', 'nom'] });
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  const entree = await trouverDansCatalogue(req.params.cle);
  if (!entree) return res.status(404).json({ erreur: 'fonctionnalité inconnue' });
  await ActivationFonctionnalite.destroy({ where: { etablissementId: etablissement.id, cle: entree.cle } });
  invaliderCache();
  await journaliser(req.utilisateur, 'fonctionnalite', `Retrait de « ${entree.nom} » pour « ${etablissement.nom} »`);
  return listerCatalogue(req, res);
}

module.exports = {
  listerCatalogue,
  creerFonctionnalite,
  modifierFonctionnalite,
  supprimerFonctionnalite,
  definirEcoles,
  ajouterAEcole,
  retirerDeEcole,
};
