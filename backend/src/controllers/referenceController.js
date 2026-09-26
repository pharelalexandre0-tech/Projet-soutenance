const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  Classe,
  Professeur,
  Eleve,
  Semestre,
  UniteEnseignement,
  Matiere,
  EmploiDuTemps,
  PublicationEmploiDuTemps,
  Utilisateur,
  CahierDeTextes,
  MessageAnnonce,
  Notification,
  Absence,
  IncidentComportement,
  Note,
  Bulletin,
  PredictionIA,
  FraisScolarite,
  Paiement,
  Recu,
  CompteEphemere,
  CompteRenduSaisie,
} = require('../models');
const { envoyerALaFamille, erreurEmailParent } = require('../services/familleService');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { genererEmploiDuTempsPDF } = require('../services/pdfService');
const { erreurLogoInvalide } = require('../utils/logo');
const { motDePasseAleatoire } = require('../utils/tokenGenerator');
const { attribuerMatricule } = require('../services/matriculeService');
const { calculerBulletin } = require('../services/moyenneService');
const { etatPublication, publier, versionPubliee } = require('../services/emploiDuTempsService');
const { rattacherProfesseursALaPaie } = require('../services/paieService');

// Restreint un compte étudiant (et donc le parent qui l'ouvre) à SA propre
// classe sur les listes partagées (messages, emploi du temps, cahier de
// textes) ; `null` = pas de restriction (Académie/Finance voient tout
// l'établissement). Centralisé ici plutôt que réécrit à chaque contrôleur :
// c'est exactement ce genre de vérification copiée-collée qui, oubliée une
// seule fois, devient une fuite de données entre familles.
async function classeIdsAutorises(utilisateur) {
  if (utilisateur.role === 'etudiant') {
    const eleves = await Eleve.findAll({ where: { compteEtudiantId: utilisateur.id } });
    return eleves.map((e) => e.classeId);
  }
  return null;
}

// Toutes les FK vers Eleve sont en ON DELETE SET NULL côté base (jamais
// CASCADE ni RESTRICT) — un simple `eleve.destroy()` ne supprimait donc PAS
// ses notes/absences/bulletins/frais, il les orphelinait juste (eleveId mis
// à NULL, lignes invisibles mais jamais nettoyées). Utilisé par la
// suppression d'un élève seul ET par celle d'une classe entière.
async function supprimerDonneesEleves(eleveIds) {
  if (eleveIds.length === 0) return;
  const frais = await FraisScolarite.findAll({ where: { eleveId: { [Op.in]: eleveIds } }, attributes: ['id'] });
  const fraisIds = frais.map((f) => f.id);
  const paiements = fraisIds.length
    ? await Paiement.findAll({ where: { fraisId: { [Op.in]: fraisIds } }, attributes: ['id'] })
    : [];
  const paiementIds = paiements.map((p) => p.id);

  if (paiementIds.length) await Recu.destroy({ where: { paiementId: { [Op.in]: paiementIds } } });
  if (fraisIds.length) await Paiement.destroy({ where: { fraisId: { [Op.in]: fraisIds } } });
  if (fraisIds.length) await FraisScolarite.destroy({ where: { id: { [Op.in]: fraisIds } } });
  await Bulletin.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
  await PredictionIA.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
  await Note.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
  await Absence.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
  await IncidentComportement.destroy({ where: { eleveId: { [Op.in]: eleveIds } } });
}

// Identité de l'établissement (nom, ville…) DE L'UTILISATEUR CONNECTÉ,
// utilisée sur les documents officiels (bulletin, reçu). Paramétrable en
// base par l'Académie — jamais codée en dur, pour que la plateforme
// s'adapte à n'importe quelle école, et jamais partagée entre écoles.
async function obtenirEtablissement(req, res) {
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'aucun établissement rattaché à ce compte' });
  return res.json({ etablissement });
}

// "Paramètres" (Académie) : renseigner/mettre à jour la fiche de son propre
// établissement — jamais celui d'une autre école.
async function configurerEtablissement(req, res) {
  const { nom, sigle, devise, ville, pays, boitePostale, telephone, email, logo } = req.body;
  if (!nom || !ville) {
    return res.status(400).json({ erreur: 'le nom et la ville sont obligatoires' });
  }
  const erreurLogo = erreurLogoInvalide(logo);
  if (erreurLogo) return res.status(400).json({ erreur: erreurLogo });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  if (!etablissement) return res.status(404).json({ erreur: 'aucun établissement rattaché à ce compte' });
  // logo undefined (champ absent du payload) => inchangé ; logo explicitement
  // '' ou null => retiré. Distinction utile car le formulaire ne renvoie pas
  // toujours le logo (image déjà en place, pas retouchée à cet enregistrement).
  await etablissement.update({
    nom, sigle, devise, ville, pays, boitePostale, telephone, email,
    ...(logo !== undefined && { logo: logo || null }),
  });
  return res.json({ etablissement });
}

const LIBELLES_TYPE_MESSAGE = { message: 'Message', annonce: 'Annonce', convocation: 'Convocation' };

// Gestion de la structure pédagogique (Espace Académie, diagramme 1) :
// classes, professeurs, élèves, semestres, UE, emplois du temps. CRUD
// volontairement minimal (create + list) pour rester focalisé sur les
// flux détaillés dans les diagrammes de séquence/activité.
//
// Multi-établissement : chaque création est rattachée à l'établissement du
// compte connecté, jamais choisie librement, et chaque liste ne renvoie que
// les données de cet établissement — deux écoles ne se voient jamais.

async function creerClasse(req, res) {
  const classe = await Classe.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  return res.status(201).json({ classe });
}
async function listerClasses(req, res) {
  const classes = await Classe.findAll({ where: { etablissementId: req.utilisateur.etablissementId }, include: [Eleve] });
  return res.json({ classes });
}
async function modifierClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const { nom, niveau } = req.body;
  await classe.update({ nom, niveau });
  return res.json({ classe });
}
// Une classe avec des élèves ne se supprime pas directement — il faut
// d'abord les déplacer ou les retirer, pour ne jamais perdre un dossier
// élève par effet de bord d'une suppression de classe.
// Supprimer une classe supprime tout ce qui n'existe que pour elle : ses
// élèves (et leur compte étudiant, que leur parent ouvrait aussi), leurs
// notes/absences/bulletins/frais,
// son emploi du temps, son cahier de textes, ses annonces et ses comptes
// éphémères professeur. Pas de confirmation supplémentaire côté serveur :
// c'est l'écran de confirmation (frontend) qui protège du clic accidentel,
// même principe que la suppression d'un établissement par le superadmin.
async function supprimerClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id, { include: [Eleve] });
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const classeId = classe.id;
  const eleves = classe.Eleves || [];
  const eleveIds = eleves.map((e) => e.id);
  const compteEtudiantIds = eleves.map((e) => e.compteEtudiantId).filter(Boolean);

  await supprimerDonneesEleves(eleveIds);
  await EmploiDuTemps.destroy({ where: { classeId } });
  await PublicationEmploiDuTemps.destroy({ where: { classeId } });
  await CahierDeTextes.destroy({ where: { classeId } });
  await MessageAnnonce.destroy({ where: { classeId } });
  await CompteRenduSaisie.destroy({ where: { classeId } });
  await CompteEphemere.destroy({ where: { classeId } });
  await Eleve.destroy({ where: { classeId } });
  if (compteEtudiantIds.length) await Utilisateur.destroy({ where: { id: { [Op.in]: compteEtudiantIds } } });
  await classe.destroy();
  return res.status(204).send();
}
async function statistiquesClasse(req, res) {
  const classe = await Classe.findByPk(req.params.id, { include: [Eleve] });
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const eleveIds = classe.Eleves.map((e) => e.id);
  const absences = eleveIds.length > 0 ? await Absence.findAll({ where: { eleveId: eleveIds } }) : [];
  const justifiees = absences.filter((a) => a.justifie).length;
  const nonJustifiees = absences.length - justifiees;
  return res.json({
    effectif: classe.Eleves.length,
    statut: classe.Eleves.length > 0 ? 'active' : 'vide',
    absences: { total: absences.length, justifiees, nonJustifiees },
  });
}

async function creerProfesseur(req, res) {
  const professeur = await Professeur.create({ ...req.body, etablissementId: req.utilisateur.etablissementId });
  // Il apparaît aussitôt dans la paie du personnel (Espace Finance).
  await rattacherProfesseursALaPaie(req.utilisateur.etablissementId);
  return res.status(201).json({ professeur });
}
async function listerProfesseurs(req, res) {
  const professeurs = await Professeur.findAll({ where: { etablissementId: req.utilisateur.etablissementId } });
  return res.json({ professeurs });
}
async function supprimerProfesseur(req, res) {
  const professeur = await Professeur.findByPk(req.params.id);
  if (!professeur || professeur.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'professeur introuvable' });
  }
  await professeur.destroy();
  return res.status(204).send();
}

// Inscrire un étudiant crée dans le même geste son propre compte — sans ça,
// il n'aurait aucun moyen d'accéder à son dossier. Le parent n'a pas de
// compte : son adresse (optionnelle) est rattachée à l'élève, et il ouvre
// le compte de l'enfant avec elle et le même mot de passe, le matricule.
async function creerEleve(req, res) {
  const { nom, prenom, dateNaissance, classeId, email } = req.body;
  const emailParent = String(req.body.emailParent || '').trim() || null;

  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  if (!email) {
    return res.status(400).json({ erreur: "l'e-mail du compte étudiant est obligatoire" });
  }
  const emailExistant = await Utilisateur.findOne({ where: { email } });
  if (emailExistant) {
    return res.status(400).json({ erreur: 'cette adresse e-mail est déjà utilisée par un autre compte' });
  }
  const erreurParent = erreurEmailParent(emailParent, email);
  if (erreurParent) return res.status(400).json({ erreur: erreurParent });

  // Mot de passe provisoire, aussitôt remplacé par le matricule (qui n'est
  // connu qu'une fois l'élève enregistré) : le mot de passe d'un étudiant
  // est toujours son matricule.
  const compteEtudiant = await Utilisateur.create({
    nom,
    prenom,
    email,
    motDePasse: await bcrypt.hash(motDePasseAleatoire(), 10),
    role: 'etudiant',
    etablissementId: req.utilisateur.etablissementId,
  });
  const eleve = await Eleve.create({
    nom, prenom, dateNaissance, classeId,
    compteEtudiantId: compteEtudiant.id,
    emailParent,
    etablissementId: req.utilisateur.etablissementId,
  });
  await attribuerMatricule(eleve);
  return res.status(201).json({ eleve, compteEtudiant: compteEtudiant.toPublicJSON() });
}

// Rattache (ou corrige) l'adresse e-mail du parent d'un élève déjà inscrit,
// par exemple après un import Excel sans colonne parent.
async function definirEmailParent(req, res) {
  const eleve = await Eleve.findByPk(req.params.id, { include: [{ model: Utilisateur, as: 'compteEtudiant', attributes: ['email'] }] });
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  const emailParent = String(req.body.emailParent || '').trim();
  if (!emailParent) return res.status(400).json({ erreur: "l'e-mail du parent est obligatoire" });
  const erreur = erreurEmailParent(emailParent, eleve.compteEtudiant?.email);
  if (erreur) return res.status(400).json({ erreur });
  eleve.emailParent = emailParent;
  await eleve.save();
  return res.json({ eleve });
}

// Retire l'adresse du parent : il ne peut plus ouvrir le compte de l'élève
// ni recevoir les e-mails qui le concernent.
async function retirerEmailParent(req, res) {
  const eleve = await Eleve.findByPk(req.params.id);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  eleve.emailParent = null;
  await eleve.save();
  return res.status(204).send();
}

// Remet le mot de passe d'un compte étudiant à son matricule. Jamais un
// compte Académie/Finance/Superadmin, même dans son propre établissement :
// cette route ne doit pas devenir un moyen détourné de prendre la main sur
// un collègue ou un autre admin.
async function reinitialiserMotDePasseCompte(req, res) {
  const compte = await Utilisateur.findByPk(req.params.id);
  if (!compte || compte.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'compte introuvable' });
  }
  if (compte.role !== 'etudiant') {
    return res.status(403).json({ erreur: 'seuls les comptes étudiant peuvent être réinitialisés ici' });
  }
  const eleve = await Eleve.findOne({ where: { compteEtudiantId: compte.id } });
  const matricule = eleve?.matricule || (eleve ? await attribuerMatricule(eleve) : null);
  if (!matricule) return res.status(404).json({ erreur: 'dossier étudiant introuvable pour ce compte' });
  compte.motDePasse = await bcrypt.hash(matricule, 10);
  await compte.save();
  return res.json({ email: compte.email, motDePasse: matricule, matricule });
}

async function listerEleves(req, res) {
  const where = { etablissementId: req.utilisateur.etablissementId };
  if (req.query.classeId) where.classeId = req.query.classeId;
  if (req.utilisateur.role === 'etudiant') where.compteEtudiantId = req.utilisateur.id;
  const eleves = await Eleve.findAll({
    where,
    include: [
      Classe,
      { model: Utilisateur, as: 'compteEtudiant', attributes: ['id', 'email'] },
    ],
  });
  return res.json({ eleves });
}
// Supprime la fiche élève ET son compte étudiant (login) — un élève retiré
// ne doit pas laisser un compte orphelin qui peut encore se connecter.
async function supprimerEleve(req, res) {
  const eleve = await Eleve.findByPk(req.params.id);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  const compteEtudiantId = eleve.compteEtudiantId;
  await supprimerDonneesEleves([eleve.id]);
  await eleve.destroy();
  if (compteEtudiantId) await Utilisateur.destroy({ where: { id: compteEtudiantId } });
  return res.status(204).send();
}

const CYCLE_LABEL = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
async function creerSemestre(req, res) {
  const { cycle, numero, anneeScolaire } = req.body;
  if (!CYCLE_LABEL[cycle]) {
    return res.status(400).json({ erreur: 'cycle invalide (licence, master ou doctorat)' });
  }
  const numeroInt = Number(numero);
  if (!Number.isInteger(numeroInt) || numeroInt < 1 || numeroInt > 8) {
    return res.status(400).json({ erreur: 'numéro de semestre invalide (1 à 8)' });
  }
  // Libellé toujours dérivé de cycle+numero, jamais saisi à la main — deux
  // cycles peuvent chacun avoir leur "Semestre 1" sans se confondre.
  const semestre = await Semestre.create({
    cycle, numero: numeroInt, anneeScolaire,
    libelle: `${CYCLE_LABEL[cycle]}, Semestre ${numeroInt}`,
    etablissementId: req.utilisateur.etablissementId,
  });
  return res.status(201).json({ semestre });
}
async function listerSemestres(req, res) {
  const semestres = await Semestre.findAll({ where: { etablissementId: req.utilisateur.etablissementId } });
  return res.json({ semestres });
}

async function creerUE(req, res) {
  const { semestreId } = req.body;
  const semestre = await Semestre.findByPk(semestreId);
  if (!semestre || semestre.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'semestre introuvable' });
  }
  const ue = await UniteEnseignement.create(req.body);
  return res.status(201).json({ ue });
}
async function listerUE(req, res) {
  const where = {};
  if (req.query.semestreId) where.semestreId = req.query.semestreId;
  const ues = await UniteEnseignement.findAll({
    where,
    include: [{ model: Semestre, where: { etablissementId: req.utilisateur.etablissementId } }, Matiere],
  });
  return res.json({ ues });
}

// Une matière (ex. Python, PHP, Java) appartient à une UE (ex. "Programmation").
async function creerMatiere(req, res) {
  const { uniteEnseignementId } = req.body;
  const ue = await UniteEnseignement.findByPk(uniteEnseignementId, { include: [Semestre] });
  if (!ue || ue.Semestre?.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: "unité d'enseignement introuvable" });
  }
  const matiere = await Matiere.create(req.body);
  return res.status(201).json({ matiere });
}

async function creerEmploiDuTemps(req, res) {
  const { classeId } = req.body;
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const emploi = await EmploiDuTemps.create(req.body);
  return res.status(201).json({ emploi });
}
async function listerEmploisDuTemps(req, res) {
  const where = {};
  if (req.query.classeId) where.classeId = req.query.classeId;
  // Étudiant/parent restreints à LEUR(S) classe(s), quel que soit le
  // classeId demandé, et seulement à la version PUBLIÉE par l'Académie
  // (jamais le brouillon qu'elle est en train de composer).
  const classesAutorisees = await classeIdsAutorises(req.utilisateur);
  if (classesAutorisees) {
    const demandee = req.query.classeId ? Number(req.query.classeId) : null;
    const classeIds = demandee && classesAutorisees.includes(demandee) ? [demandee] : classesAutorisees;
    const publications = await versionPubliee(classeIds);
    return res.json({
      emplois: publications.flatMap((p) => p.creneaux.map((c) => ({ ...c, classeId: p.classeId }))),
      publication: publications[0] ? { publieLe: publications[0].publieLe, version: publications[0].version } : null,
    });
  }
  const emplois = await EmploiDuTemps.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['jour', 'ASC'], ['heureDebut', 'ASC']],
  });
  return res.json({ emplois });
}
// État de publication de la grille d'une classe (Académie).
async function etatPublicationEmploi(req, res) {
  const classe = await Classe.findByPk(req.query.classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  return res.json(await etatPublication(classe.id));
}

// Publier : les étudiants et parents de la classe voient cette version et
// sont prévenus (notification et e-mail).
async function publierEmploiDuTemps(req, res) {
  const classe = await Classe.findByPk(req.body.classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  try {
    const { nbDestinataires, miseAJour } = await publier({ classe, semestreId: req.body.semestreId, utilisateur: req.utilisateur });
    return res.status(201).json({ ...(await etatPublication(classe.id)), nbDestinataires, miseAJour });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erreur: err.message });
    throw err;
  }
}

async function supprimerEmploiDuTemps(req, res) {
  const emploi = await EmploiDuTemps.findByPk(req.params.id, { include: [Classe] });
  if (!emploi || emploi.Classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'créneau introuvable' });
  }
  await emploi.destroy();
  return res.status(204).send();
}

// Grille hebdomadaire brandée (logo, identité) prête à être téléchargée puis
// partagée telle quelle (WhatsApp, e-mail) — même principe que le bulletin
// ou le reçu, généré à la demande plutôt que persisté : rien à invalider
// quand un créneau change, la prochaine génération reflète juste l'état actuel.
async function genererEmploiDuTempsPDFRoute(req, res) {
  const { classeId, semestreId } = req.query;
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const semestre = await Semestre.findByPk(semestreId);
  if (!semestre || semestre.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'semestre introuvable' });
  }
  const creneaux = await EmploiDuTemps.findAll({ where: { classeId }, order: [['jour', 'ASC'], ['heureDebut', 'ASC']] });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);
  const { cheminRelatif } = await genererEmploiDuTempsPDF({ classe, semestre, creneaux, etablissement });
  return res.json({ url: cheminRelatif });
}

async function listerCahierDeTextes(req, res) {
  const { classeId } = req.query;
  const where = classeId ? { classeId } : {};
  const classesAutorisees = await classeIdsAutorises(req.utilisateur);
  if (classesAutorisees) where.classeId = classesAutorisees;
  const cahier = await CahierDeTextes.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['date', 'DESC']],
  });
  return res.json({ cahier });
}
async function ajouterCahierDeTextes(req, res) {
  const classe = await Classe.findByPk(req.body.classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }
  const entree = await CahierDeTextes.create({ ...req.body, academieId: req.utilisateur.id });
  return res.status(201).json({ entree });
}

// "Envoyer un message/une annonce/une convocation" (diagramme communication
// École-Étudiants) : chaque étudiant de la classe visée est notifié sur son
// compte, et l'e-mail part à lui et à son parent.
async function envoyerMessage(req, res) {
  const { titre, contenu, type, classeId } = req.body;
  if (!classeId) {
    return res.status(400).json({ erreur: 'classeId requis' });
  }
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }

  const message = await MessageAnnonce.create({ titre, contenu, type, classeId, auteurId: req.utilisateur.id });

  const eleves = await Eleve.findAll({ where: { classeId }, include: [{ model: Utilisateur, as: 'compteEtudiant' }] });
  let etudiantsNotifies = 0;
  for (const eleve of eleves) {
    if (eleve.compteEtudiant) {
      await Notification.create({
        utilisateurId: eleve.compteEtudiant.id,
        contenu: `${LIBELLES_TYPE_MESSAGE[message.type] || 'Message'} : ${titre}`,
      });
      etudiantsNotifies += 1;
    }
    await envoyerALaFamille(eleve, titre, contenu);
  }

  return res.status(201).json({ message, etudiantsNotifies });
}

async function listerMessages(req, res) {
  const where = {};
  if (req.query.classeId) where.classeId = req.query.classeId;
  const classesAutorisees = await classeIdsAutorises(req.utilisateur);
  if (classesAutorisees) where.classeId = classesAutorisees;

  const messages = await MessageAnnonce.findAll({
    where,
    include: [{ model: Classe, where: { etablissementId: req.utilisateur.etablissementId } }],
    order: [['dateEnvoi', 'DESC']],
  });
  return res.json({ messages });
}

// Tableau de bord École : moyenne générale et taux de réussite par UE,
// à côté des effectifs et de l'absentéisme déjà calculés ailleurs.
// Réutilise calculerBulletin (mêmes règles LMD que le bulletin individuel :
// éliminatoire, rattrapage non compté comme validé en session normale...)
// plutôt que de réimplémenter la logique de validation d'une UE.
async function statistiquesAcademiques(req, res) {
  const etabId = req.utilisateur.etablissementId;
  const [semestres, eleves] = await Promise.all([
    Semestre.findAll({ where: { etablissementId: etabId } }),
    Eleve.findAll({ where: { etablissementId: etabId } }),
  ]);

  const parUE = new Map();
  let sommeMoyennes = 0;
  let nbMoyennes = 0;

  for (const semestre of semestres) {
    for (const eleve of eleves) {
      const { moyenneGenerale, detailParUE } = await calculerBulletin(eleve.id, semestre.id);
      if (detailParUE.length === 0) continue;
      sommeMoyennes += moyenneGenerale;
      nbMoyennes += 1;
      for (const ue of detailParUE) {
        if (!parUE.has(ue.code)) parUE.set(ue.code, { code: ue.code, intitule: ue.ue, valides: 0, total: 0 });
        const entree = parUE.get(ue.code);
        entree.total += 1;
        if (ue.valide) entree.valides += 1;
      }
    }
  }

  const reussiteParUE = [...parUE.values()]
    .map((u) => ({ code: u.code, intitule: u.intitule, tauxReussite: Math.round((u.valides / u.total) * 100) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return res.json({
    moyenneGenerale: nbMoyennes > 0 ? Math.round((sommeMoyennes / nbMoyennes) * 100) / 100 : null,
    reussiteParUE,
  });
}

module.exports = {
  creerClasse,
  listerClasses,
  modifierClasse,
  supprimerClasse,
  statistiquesClasse,
  creerProfesseur,
  listerProfesseurs,
  supprimerProfesseur,
  creerEleve,
  listerEleves,
  supprimerEleve,
  definirEmailParent,
  retirerEmailParent,
  reinitialiserMotDePasseCompte,
  creerSemestre,
  listerSemestres,
  creerUE,
  listerUE,
  creerMatiere,
  creerEmploiDuTemps,
  listerEmploisDuTemps,
  supprimerEmploiDuTemps,
  etatPublicationEmploi,
  publierEmploiDuTemps,
  genererEmploiDuTempsPDFRoute,
  listerCahierDeTextes,
  ajouterCahierDeTextes,
  envoyerMessage,
  statistiquesAcademiques,
  listerMessages,
  obtenirEtablissement,
  configurerEtablissement,
};
