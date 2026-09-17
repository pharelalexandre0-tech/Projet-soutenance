const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');
const {
  Etablissement, Utilisateur, Classe, Eleve, Semestre, Professeur, Personnel,
  UniteEnseignement, Matiere, EmploiDuTemps, CompteEphemere, CahierDeTextes,
  Absence, Note, Bulletin, PredictionIA, MessageAnnonce, Notification,
  FraisScolarite, Paiement, Recu, Salaire,
} = require('../models');

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

// Volontairement dépourvu de la liste des comptes de l'école : le superadmin
// pilote l'existence et le statut des établissements, jamais l'identité des
// personnes qui y travaillent — ça reste le regard de l'Académie sur sa
// propre école, pas celui du superadmin sur toute la plateforme.
async function obtenirEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  return res.json({ etablissement });
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
  const erreurMotDePasse = erreurMotDePasseInvalide(academieMotDePasse);
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
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

// Supprimer une école du système, à la discrétion du superadmin — y compris
// une école déjà en activité, avec toutes ses données. Aucune confirmation
// de sécurité côté serveur au-delà de l'existence de l'école : c'est
// l'écran de confirmation (frontend) qui protège du clic accidentel.
// Tout ce qui appartient à l'établissement est nettoyé, des feuilles
// (notes, absences, paiements…) vers les racines (classes, élèves,
// comptes), pour ne jamais laisser de lignes orphelines en base.
async function supprimerEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });
  const etablissementId = etablissement.id;

  const [classes, semestres, eleves, professeurs, personnel, utilisateurs] = await Promise.all([
    Classe.findAll({ where: { etablissementId }, attributes: ['id'] }),
    Semestre.findAll({ where: { etablissementId }, attributes: ['id'] }),
    Eleve.findAll({ where: { etablissementId }, attributes: ['id'] }),
    Professeur.findAll({ where: { etablissementId }, attributes: ['id'] }),
    Personnel.findAll({ where: { etablissementId }, attributes: ['id'] }),
    Utilisateur.findAll({ where: { etablissementId }, attributes: ['id'] }),
  ]);
  const classeIds = classes.map((c) => c.id);
  const semestreIds = semestres.map((s) => s.id);
  const eleveIds = eleves.map((e) => e.id);
  const professeurIds = professeurs.map((p) => p.id);
  const personnelIds = personnel.map((p) => p.id);
  const utilisateurIds = utilisateurs.map((u) => u.id);

  const uniteEnseignements = semestreIds.length
    ? await UniteEnseignement.findAll({ where: { semestreId: { [Op.in]: semestreIds } }, attributes: ['id'] })
    : [];
  const uniteEnseignementIds = uniteEnseignements.map((u) => u.id);

  const fraisScolarite = (eleveIds.length || semestreIds.length)
    ? await FraisScolarite.findAll({
        where: { [Op.or]: [{ eleveId: { [Op.in]: eleveIds } }, { semestreId: { [Op.in]: semestreIds } }] },
        attributes: ['id'],
      })
    : [];
  const fraisIds = fraisScolarite.map((f) => f.id);

  const paiements = fraisIds.length
    ? await Paiement.findAll({ where: { fraisId: { [Op.in]: fraisIds } }, attributes: ['id'] })
    : [];
  const paiementIds = paiements.map((p) => p.id);

  // Des feuilles vers les racines.
  if (paiementIds.length) await Recu.destroy({ where: { paiementId: { [Op.in]: paiementIds } } });
  if (fraisIds.length) await Paiement.destroy({ where: { fraisId: { [Op.in]: fraisIds } } });
  if (fraisIds.length) await FraisScolarite.destroy({ where: { id: { [Op.in]: fraisIds } } });
  if (personnelIds.length) await Salaire.destroy({ where: { personnelId: { [Op.in]: personnelIds } } });
  if (eleveIds.length) {
    await Bulletin.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
    await PredictionIA.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
    await Note.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
    await Absence.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
  }
  if (classeIds.length) {
    await CahierDeTextes.destroy({ where: { classeId: { [Op.in]: classeIds } } });
    await MessageAnnonce.destroy({ where: { classeId: { [Op.in]: classeIds } } });
    await EmploiDuTemps.destroy({ where: { classeId: { [Op.in]: classeIds } } });
  }
  if (professeurIds.length || classeIds.length) {
    await CompteEphemere.destroy({
      where: { [Op.or]: [{ professeurId: { [Op.in]: professeurIds } }, { classeId: { [Op.in]: classeIds } }] },
    });
  }
  if (uniteEnseignementIds.length) await Matiere.destroy({ where: { uniteEnseignementId: { [Op.in]: uniteEnseignementIds } } });
  if (semestreIds.length) await UniteEnseignement.destroy({ where: { semestreId: { [Op.in]: semestreIds } } });
  if (utilisateurIds.length) await Notification.destroy({ where: { utilisateurId: { [Op.in]: utilisateurIds } } });

  await Eleve.destroy({ where: { etablissementId } });
  await Classe.destroy({ where: { etablissementId } });
  await Semestre.destroy({ where: { etablissementId } });
  await Professeur.destroy({ where: { etablissementId } });
  await Personnel.destroy({ where: { etablissementId } });
  await Utilisateur.destroy({ where: { etablissementId } });
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
  const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
  if (erreurMotDePasse) {
    return res.status(400).json({ erreur: erreurMotDePasse });
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
    const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
    if (erreurMotDePasse) {
      return res.status(400).json({ erreur: erreurMotDePasse });
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
  listerSuperadmins,
  creerSuperadmin,
  mettreAJourMonProfil,
};
