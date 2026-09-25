const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { erreurMotDePasseInvalide } = require('../utils/motDePasse');
const { erreurLogoInvalide } = require('../utils/logo');
const { motDePasseAleatoire } = require('../utils/tokenGenerator');
const { envoyerEmail, derniersEnvois } = require('../services/emailService');
const { journaliser, clesDeLEcole, invaliderCache } = require('../services/plateformeService');
const { MODULES_INTEGRES } = require('../config/fonctionnalites');
const {
  Etablissement, Utilisateur, Classe, Eleve, Semestre, Professeur, Personnel,
  UniteEnseignement, Matiere, EmploiDuTemps, CompteEphemere, CahierDeTextes,
  Absence, Note, Bulletin, PredictionIA, MessageAnnonce, Notification,
  FraisScolarite, Paiement, Recu, Salaire, FonctionnalitePersonnalisee, ActivationFonctionnalite,
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
      const nbFonctionnalites = (await clesDeLEcole(etab.id)).size;
      return { ...etab.toJSON(), nbComptes, nbComptesVerrouilles, nbFonctionnalites };
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
    nom, sigle, devise, ville, pays, boitePostale, telephone, email, logo,
    academieNom, academiePrenom, academieEmail, academieMotDePasse, fonctionnalites,
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
  const erreurLogo = erreurLogoInvalide(logo);
  if (erreurLogo) return res.status(400).json({ erreur: erreurLogo });

  const emailExistant = await Utilisateur.findOne({ where: { email: academieEmail } });
  if (emailExistant) {
    return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  }

  const etablissement = await Etablissement.create({
    nom, sigle: sigle || null, devise: devise || null, ville,
    pays: pays || 'République Gabonaise', boitePostale: boitePostale || null,
    telephone: telephone || null, email: email || null, logo: logo || null,
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

  // Fonctionnalités choisies à l'inscription de l'école, selon ses besoins.
  // Sans choix explicite (appel direct à l'API), elle reçoit les modules
  // intégrés, comme les écoles affiliées avant ce réglage.
  const clesConnues = new Set([
    ...MODULES_INTEGRES.map((m) => m.cle),
    ...(await FonctionnalitePersonnalisee.findAll({ attributes: ['cle'] })).map((p) => p.cle),
  ]);
  const clesChoisies = Array.isArray(fonctionnalites)
    ? [...new Set(fonctionnalites.map(String))].filter((c) => clesConnues.has(c))
    : MODULES_INTEGRES.map((m) => m.cle);
  if (clesChoisies.length) {
    await ActivationFonctionnalite.bulkCreate(clesChoisies.map((cle) => ({ etablissementId: etablissement.id, cle })), { ignoreDuplicates: true });
    invaliderCache();
  }

  await journaliser(req.utilisateur, 'etablissement', `Affiliation de l'établissement « ${etablissement.nom} » (${etablissement.ville}) avec ${clesChoisies.length} fonctionnalité${clesChoisies.length > 1 ? 's' : ''}`);
  return res.status(201).json({ etablissement, compteAcademie: compteAcademie.toPublicJSON() });
}

// Mise à jour des informations administratives d'une école affiliée
// (coordonnées, identité) — pas son contenu pédagogique.
async function modifierEtablissement(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const { nom, sigle, devise, ville, pays, boitePostale, telephone, email, logo } = req.body;
  if (!nom || !ville) {
    return res.status(400).json({ erreur: 'le nom et la ville sont obligatoires' });
  }
  const erreurLogo = erreurLogoInvalide(logo);
  if (erreurLogo) return res.status(400).json({ erreur: erreurLogo });
  // logo undefined (champ absent du payload) => inchangé ; '' ou null =>
  // retiré — même distinction que côté Académie (configurerEtablissement).
  await etablissement.update({
    nom, sigle, devise, ville, pays, boitePostale, telephone, email,
    ...(logo !== undefined && { logo: logo || null }),
  });
  await journaliser(req.utilisateur, 'etablissement', `Modification de la fiche de « ${etablissement.nom} »`);
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
  await ActivationFonctionnalite.destroy({ where: { etablissementId } });
  invaliderCache();
  await etablissement.destroy();

  await journaliser(req.utilisateur, 'etablissement', `Suppression de l'établissement « ${etablissement.nom} » et de toutes ses données`);
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
  await journaliser(req.utilisateur, 'etablissement', statut === 'suspendu'
    ? `Suspension de l'établissement « ${etablissement.nom} »`
    : `Réactivation de l'établissement « ${etablissement.nom} »`);
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
  await journaliser(req.utilisateur, 'compte', `Création du compte superadmin de ${prenom} ${nom}`);
  return res.status(201).json({ compte: compte.toPublicJSON() });
}

// Vue "pouls de la plateforme" : uniquement des totaux agrégés (jamais un
// détail par élève ou par personne) — reste dans la même frontière que
// listerEtablissements, juste additionné sur toutes les écoles à la fois.
async function obtenirStatistiques(req, res) {
  const [etablissements, totalEleves, totalProfesseurs, totalComptes, totalComptesVerrouilles] = await Promise.all([
    Etablissement.findAll({ attributes: ['id', 'ville', 'statut', 'createdAt'] }),
    Eleve.count(),
    Professeur.count(),
    Utilisateur.count({ where: { etablissementId: { [Op.not]: null } } }),
    Utilisateur.count({ where: { etablissementId: { [Op.not]: null }, statut: 'verrouille' } }),
  ]);

  const totalActives = etablissements.filter((e) => e.statut === 'actif').length;

  // Regroupement par ville : une répartition géographique lisible sans
  // avoir ni coordonnées en base ni bibliothèque de carte à ajouter pour
  // une poignée d'écoles.
  const parVille = new Map();
  etablissements.forEach((e) => {
    const cle = e.ville || 'Non renseignée';
    parVille.set(cle, (parVille.get(cle) || 0) + 1);
  });
  const repartitionParVille = [...parVille.entries()]
    .map(([ville, total]) => ({ ville, total }))
    .sort((a, b) => b.total - a.total);

  // Écoles affiliées par mois (6 derniers mois) : la tendance d'adoption de
  // la plateforme, pas seulement son état à l'instant T.
  const maintenant = new Date();
  const mois = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({ cle: `${d.getFullYear()}-${d.getMonth()}`, libelle: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), total: 0 });
  }
  etablissements.forEach((e) => {
    const d = new Date(e.createdAt);
    const cle = `${d.getFullYear()}-${d.getMonth()}`;
    const entree = mois.find((m) => m.cle === cle);
    if (entree) entree.total += 1;
  });

  return res.json({
    totalEcoles: etablissements.length,
    totalActives,
    totalSuspendues: etablissements.length - totalActives,
    totalEleves,
    totalProfesseurs,
    totalComptes,
    totalComptesVerrouilles,
    repartitionParVille,
    croissance: mois.map(({ libelle, total }) => ({ libelle, total })),
  });
}

// Dépannage : si le premier compte Académie d'une école est bloqué dehors
// (mot de passe perdu ET e-mail inaccessible), le superadmin peut lui
// générer un nouvel accès — jamais consulter ni modifier autre chose sur
// son compte, seulement lui redonner l'entrée. Le plus ancien compte
// Académie de l'école (pas "un compte au hasard") pour rester prévisible.
async function reinitialiserMotDePasseAcademie(req, res) {
  const etablissement = await Etablissement.findByPk(req.params.id);
  if (!etablissement) return res.status(404).json({ erreur: 'établissement introuvable' });

  const compteAcademie = await Utilisateur.findOne({
    where: { etablissementId: etablissement.id, role: 'academie' },
    order: [['createdAt', 'ASC']],
  });
  if (!compteAcademie) {
    return res.status(404).json({ erreur: 'aucun compte Académie pour cette école' });
  }

  const nouveauMotDePasse = motDePasseAleatoire();
  compteAcademie.motDePasse = await bcrypt.hash(nouveauMotDePasse, 10);
  // Redonne l'accès pour de bon : un compte individuellement verrouillé
  // resterait bloqué même avec un nouveau mot de passe sinon.
  compteAcademie.statut = 'actif';
  await compteAcademie.save();

  await journaliser(req.utilisateur, 'compte', `Réinitialisation de l'accès Académie de « ${etablissement.nom} »`);
  return res.json({ email: compteAcademie.email, motDePasse: nouveauMotDePasse });
}

// Vue technique : quel service d'envoi d'e-mail est actif, sans jamais
// exposer les clés elles-mêmes — de quoi diagnostiquer "pourquoi cet e-mail
// n'est jamais arrivé" sans aller fouiller les variables d'environnement du
// serveur à la main. Même ordre de priorité que emailService.envoyerEmail.
async function obtenirConfigEmail(req, res) {
  const sendgrid = Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);
  const resend = Boolean(process.env.RESEND_API_KEY);
  const smtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const actif = sendgrid ? 'sendgrid' : resend ? 'resend' : smtp ? 'smtp' : null;
  return res.json({ sendgrid, resend, smtp, actif, derniersEnvois: await derniersEnvois() });
}

// Envoie un e-mail de test à l'adresse du superadmin lui-même — jamais à un
// tiers, pour ne jamais transformer cet outil de diagnostic en moyen de
// spammer une adresse arbitraire.
async function envoyerEmailTest(req, res) {
  const resultat = await envoyerEmail(
    req.utilisateur.email,
    'E-mail de test EduSphere',
    `Ceci est un e-mail de test envoyé depuis l'espace Superadmin le ${new Date().toLocaleString('fr-FR')}.\n\nSi tu reçois ce message, l'envoi d'e-mail fonctionne correctement.`
  );
  await journaliser(req.utilisateur, 'systeme', resultat.simule
    ? "Test d'envoi d'e-mail (simulé, aucun service configuré)"
    : "Test d'envoi d'e-mail vers sa propre adresse");
  return res.json({
    envoye: resultat.envoye, simule: Boolean(resultat.simule), destinataire: req.utilisateur.email,
    service: resultat.service, erreurs: resultat.erreurs,
  });
}

// Le superadmin gère son propre compte comme n'importe quel autre — nom,
// prénom, et mot de passe s'il le souhaite.
async function mettreAJourMonProfil(req, res) {
  const { nom, prenom, motDePasse, motDePasseActuel } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ erreur: 'nom et prénom sont obligatoires' });
  }
  if (motDePasse) {
    const erreurMotDePasse = erreurMotDePasseInvalide(motDePasse);
    if (erreurMotDePasse) {
      return res.status(400).json({ erreur: erreurMotDePasse });
    }
    // Une session laissée ouverte ne doit pas suffire à changer le mot de
    // passe du compte le plus puissant de la plateforme.
    const avecMotDePasse = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
    if (!motDePasseActuel || !(await bcrypt.compare(motDePasseActuel, avecMotDePasse.motDePasse))) {
      return res.status(400).json({ erreur: 'mot de passe actuel incorrect' });
    }
    req.utilisateur.motDePasse = await bcrypt.hash(motDePasse, 10);
  }
  req.utilisateur.nom = nom;
  req.utilisateur.prenom = prenom;
  await req.utilisateur.save();
  if (motDePasse) await journaliser(req.utilisateur, 'compte', 'Changement de son propre mot de passe');
  return res.json({ profil: req.utilisateur.toPublicJSON() });
}

module.exports = {
  listerEtablissements,
  obtenirEtablissement,
  creerEtablissement,
  modifierEtablissement,
  supprimerEtablissement,
  changerStatutEtablissement,
  obtenirStatistiques,
  reinitialiserMotDePasseAcademie,
  obtenirConfigEmail,
  envoyerEmailTest,
  listerSuperadmins,
  creerSuperadmin,
  mettreAJourMonProfil,
};
