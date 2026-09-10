const bcrypt = require('bcryptjs');
const { Etablissement, Utilisateur, Classe, Eleve } = require('../models');

// Vue d'ensemble : le superadmin gère la PLATEFORME (écoles affiliées,
// comptes, statuts), jamais le contenu pédagogique d'une école (nombre
// d'élèves, de classes, de professeurs — ça, c'est le travail de l'Académie
// de chaque établissement, pas du superadmin).
async function listerEtablissements(req, res) {
  const etablissements = await Etablissement.findAll({ order: [['nom', 'ASC']] });

  const avecCompteurs = await Promise.all(
    etablissements.map(async (etab) => {
      const nbComptes = await Utilisateur.count({ where: { etablissementId: etab.id } });
      const nbComptesVerrouilles = await Utilisateur.count({ where: { etablissementId: etab.id, statut: 'verrouille' } });
      return { ...etab.toJSON(), nbComptes, nbComptesVerrouilles };
    })
  );

  return res.json({ etablissements: avecCompteurs });
}

async function obtenirEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const comptes = await Utilisateur.findAll({
    where: { etablissementId: etablissement.id },
    order: [['role', 'ASC'], ['nom', 'ASC']],
  });

  // Suppressible uniquement si l'école n'a jamais démarré (aucune classe ni
  // élève) — sans exposer ces effectifs au superadmin, qui n'a pas à voir
  // le contenu pédagogique d'une école, juste s'il peut la retirer.
  const [nbClasses, nbEleves] = await Promise.all([
    Classe.count({ where: { etablissementId: etablissement.id } }),
    Eleve.count({ where: { etablissementId: etablissement.id } }),
  ]);
  const peutEtreSupprime = nbClasses === 0 && nbEleves === 0;

  return res.json({ etablissement, comptes, peutEtreSupprime });
}

// "Insertion d'une école dans le système" : le superadmin crée la fiche
// établissement ET son premier compte Académie en une seule action — sans
// ce compte, personne ne pourrait entrer dans la nouvelle école ensuite.
async function creerEtablissement(req, res) {
  const {
    nom, sigle, devise, ville, pays, boitePostale, telephone, email,
    academieNom, academiePrenom, academieEmail, academieMotDePasse,
  } = req.body;

  if (!nom || !ville) {
    return res.status(400).json({ erreur: "le nom et la ville de l'établissement sont obligatoires" });
  }
  if (!academieNom || !academiePrenom || !academieEmail || !academieMotDePasse) {
    return res.status(400).json({ erreur: "les informations du premier compte Académie sont obligatoires" });
  }

  const emailExistant = await Utilisateur.findOne({ where: { email: academieEmail } });
  if (emailExistant) {
    return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  }

  const etablissement = await Etablissement.create({
    nom, sigle: sigle || null, devise: devise || null, ville,
    pays: pays || 'République Gabonaise', boitePostale: boitePostale || null,
    telephone: telephone || null, email: email || null,
  });

  const motDePasseHache = await bcrypt.hash(academieMotDePasse, 10);
  const compteAcademie = await Utilisateur.create({
    nom: academieNom,
    prenom: academiePrenom,
    email: academieEmail,
    motDePasse: motDePasseHache,
    role: 'academie',
    etablissementId: etablissement.id,
  });

  return res.status(201).json({ etablissement, compteAcademie: compteAcademie.toPublicJSON() });
}

// Mise à jour des informations administratives d'une école affiliée
// (coordonnées, identité) — pas son contenu pédagogique.
async function modifierEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const { nom, sigle, devise, ville, pays, boitePostale, telephone, email } = req.body;
  if (!nom || !ville) {
    return res.status(400).json({ erreur: 'le nom et la ville sont obligatoires' });
  }
  await etablissement.update({ nom, sigle, devise, ville, pays, boitePostale, telephone, email });
  return res.json({ etablissement });
}

// Supprimer une école du système — réservé aux écoles insérées par erreur
// ou jamais démarrées (aucune classe/élève encore créée). Une école déjà
// active doit être suspendue, pas supprimée, pour ne jamais perdre de
// données réelles.
async function supprimerEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const [nbClasses, nbEleves] = await Promise.all([
    Classe.count({ where: { etablissementId: etablissement.id } }),
    Eleve.count({ where: { etablissementId: etablissement.id } }),
  ]);
  if (nbClasses > 0 || nbEleves > 0) {
    return res.status(400).json({ erreur: 'cette école a déjà des classes ou des élèves enregistrés — suspendez-la plutôt que de la supprimer' });
  }

  await Utilisateur.destroy({ where: { etablissementId: etablissement.id } });
  await etablissement.destroy();
  return res.json({ message: 'établissement supprimé' });
}

// Verrouiller/suspendre une école entière : coupe l'accès à TOUS ses
// comptes immédiatement, sans supprimer ses données.
async function changerStatutEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const { statut } = req.body;
  if (!['actif', 'suspendu'].includes(statut)) {
    return res.status(400).json({ erreur: 'statut invalide' });
  }
  etablissement.statut = statut;
  await etablissement.save();
  return res.json({ etablissement });
}

// Verrouiller/déverrouiller UN compte précis (pas toute l'école) — ex. un
// professeur qui quitte l'établissement, un compte compromis.
async function changerStatutCompte(req, res) {
  const compte = await Utilisateur.findByPk(req.params.id);
  if (!compte) return res.status(404).json({ erreur: 'compte introuvable' });
  if (compte.role === 'superadmin') {
    return res.status(403).json({ erreur: 'un compte superadmin ne peut pas être verrouillé depuis cet écran' });
  }

  const { statut } = req.body;
  if (!['actif', 'verrouille'].includes(statut)) {
    return res.status(400).json({ erreur: 'statut invalide' });
  }
  compte.statut = statut;
  await compte.save();
  return res.json({ compte: compte.toPublicJSON() });
}

// Réinitialiser le mot de passe d'un compte — utile quand un responsable
// d'établissement est bloqué et n'a personne d'autre à qui le demander.
async function reinitialiserMotDePasseCompte(req, res) {
  const compte = await Utilisateur.findByPk(req.params.id);
  if (!compte) return res.status(404).json({ erreur: 'compte introuvable' });
  if (compte.role === 'superadmin') {
    return res.status(403).json({ erreur: 'un compte superadmin ne peut pas être réinitialisé depuis cet écran' });
  }

  const { nouveauMotDePasse } = req.body;
  if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
    return res.status(400).json({ erreur: 'le nouveau mot de passe doit contenir au moins 6 caractères' });
  }
  compte.motDePasse = await bcrypt.hash(nouveauMotDePasse, 10);
  await compte.save();
  return res.json({ message: 'mot de passe réinitialisé' });
}

// Liste des seuls comptes superadmin (jamais des comptes d'écoles — ceux-là
// se gèrent depuis la fiche de leur établissement, pour ne jamais exposer
// les données personnelles de toutes les écoles dans un même écran).
async function listerSuperadmins(req, res) {
  const comptes = await Utilisateur.findAll({
    where: { role: 'superadmin' },
    order: [['nom', 'ASC']],
  });
  return res.json({ comptes: comptes.map((c) => c.toPublicJSON()) });
}

// Un superadmin peut affilier un autre superadmin — pour ne pas dépendre
// d'un seul compte capable de gérer la plateforme.
async function creerSuperadmin(req, res) {
  const { nom, prenom, email, motDePasse } = req.body;
  if (!nom || !prenom || !email || !motDePasse) {
    return res.status(400).json({ erreur: 'champs manquants' });
  }
  const emailExistant = await Utilisateur.findOne({ where: { email } });
  if (emailExistant) {
    return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  }
  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
  const compte = await Utilisateur.create({ nom, prenom, email, motDePasse: motDePasseHache, role: 'superadmin' });
  return res.status(201).json({ compte: compte.toPublicJSON() });
}

// Le superadmin gère son propre compte comme n'importe quel autre — nom,
// prénom, et mot de passe s'il le souhaite.
async function mettreAJourMonProfil(req, res) {
  const { nom, prenom, motDePasse } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ erreur: 'nom et prénom sont obligatoires' });
  }
  req.utilisateur.nom = nom;
  req.utilisateur.prenom = prenom;
  if (motDePasse) {
    if (motDePasse.length < 6) {
      return res.status(400).json({ erreur: 'le mot de passe doit contenir au moins 6 caractères' });
    }
    req.utilisateur.motDePasse = await bcrypt.hash(motDePasse, 10);
  }
  await req.utilisateur.save();
  return res.json({ profil: req.utilisateur.toPublicJSON() });
}

module.exports = {
  listerEtablissements,
  obtenirEtablissement,
  creerEtablissement,
  modifierEtablissement,
  supprimerEtablissement,
  changerStatutEtablissement,
  changerStatutCompte,
  reinitialiserMotDePasseCompte,
  listerSuperadmins,
  creerSuperadmin,
  mettreAJourMonProfil,
};
