const { fn, col } = require('sequelize');
const {
  CompteEphemere, Professeur, Classe, Matiere, UniteEnseignement, Semestre, Eleve, Etablissement, Note, Absence,
} = require('../models');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { lienAccesTemporaire } = require('../utils/liens');
const { enregistrerMoyenne } = require('./notesController');
const { envoyerEmail } = require('../services/emailService');
const { emailAccesTemporaire } = require('../services/modelesEmail');

function formaterExpiration(date) {
  return new Date(date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' });
}

// Envoi (ou renvoi) du lien au professeur, avec le modèle d'e-mail de
// service. Renvoie le résultat de l'envoi pour l'afficher à l'Académie.
async function envoyerLienProfesseur(compte, { professeur, classe, matiere }) {
  const etablissement = await Etablissement.findByPk(classe.etablissementId, { attributes: ['nom'] });
  const message = emailAccesTemporaire({
    prenom: professeur.prenom,
    tache: compte.tache,
    classe: classe.nom,
    matiere: matiere?.intitule,
    evaluation: compte.evaluationLibelle,
    categorie: compte.categorie,
    lien: lienAccesTemporaire(compte.jeton),
    expiration: formaterExpiration(compte.dateExpiration),
    etablissement: etablissement?.nom,
  });
  const resultat = await envoyerEmail(professeur.email, message.sujet, message.texte, [], { html: message.html });
  return { envoye: !resultat.simule, service: resultat.service, destinataire: professeur.email };
}

// Diagramme 4 : Academie -> creer un compte ephemere (portee, duree de
// validite) -> genererCompteEphemere -> enregistrer -> envoyer le lien
// (ici : on le renvoie dans la reponse et on le "logge", faute de service
// SMTP reel en environnement de demo).
async function creerCompteEphemere(req, res) {
  const { professeurId, classeId, matiereId, categorie, evaluationLibelle, dureeMinutes, tache } = req.body;
  // La matière n'a de sens que pour la saisie de notes — un relevé
  // d'absences porte sur la classe entière, pas une matière précise.
  const tacheFinale = tache === 'saisie_absences' ? 'saisie_absences' : 'saisie_notes';

  if (!professeurId || !classeId || (tacheFinale === 'saisie_notes' && !matiereId)) {
    return res.status(400).json({
      erreur: `portée incomplète (professeur, classe${tacheFinale === 'saisie_notes' ? ', matière' : ''} requis)`,
    });
  }

  const [professeur, classe, matiere] = await Promise.all([
    Professeur.findByPk(professeurId),
    Classe.findByPk(classeId),
    matiereId ? Matiere.findByPk(matiereId, { include: [{ model: UniteEnseignement, include: [Semestre] }] }) : null,
  ]);
  const etabId = req.utilisateur.etablissementId;
  if (
    !professeur || professeur.etablissementId !== etabId ||
    !classe || classe.etablissementId !== etabId ||
    (tacheFinale === 'saisie_notes' && (!matiere || matiere.UniteEnseignement?.Semestre?.etablissementId !== etabId))
  ) {
    return res.status(404).json({ erreur: 'professeur, classe ou matière introuvable' });
  }

  const duree = Number(dureeMinutes) > 0 ? Number(dureeMinutes) : 60; // 1h par defaut
  const dateExpiration = new Date(Date.now() + duree * 60 * 1000);

  const compte = await CompteEphemere.create({
    jeton: genererJetonEphemere(),
    tache: tacheFinale,
    categorie: categorie === 'examen' ? 'examen' : 'cc',
    evaluationLibelle: evaluationLibelle || null,
    dateExpiration,
    statut: 'actif',
    professeurId,
    classeId,
    matiereId: matiereId || null,
    creeParAcademieId: req.utilisateur.id,
  });

  const lien = lienAccesTemporaire(compte.jeton);
  const email = await envoyerLienProfesseur(compte, { professeur, classe, matiere });

  return res.status(201).json({
    compte: {
      id: compte.id,
      statut: compte.statut,
      dateExpiration: compte.dateExpiration,
      tache: compte.tache,
      portee: {
        classe: classe.nom,
        ue: matiere?.UniteEnseignement?.intitule,
        matiere: matiere?.intitule,
        categorie: compte.categorie,
        evaluation: compte.evaluationLibelle,
      },
    },
    lien,
    email,
  });
}

// Statut réel d'un accès : "actif" dont l'heure est passée = expiré (mis à
// jour en base au passage, comme le fait déjà le middleware du lien).
async function statutEffectif(compte) {
  if (compte.statut === 'actif' && new Date(compte.dateExpiration) <= new Date()) {
    compte.statut = 'expire';
    await compte.save();
  }
  return compte.statut;
}

async function compteDeLEcole(id, etablissementId) {
  const compte = await CompteEphemere.findByPk(id, {
    include: [
      { model: Classe, attributes: ['id', 'nom', 'niveau', 'etablissementId'] },
      { model: Professeur, attributes: ['id', 'nom', 'prenom', 'email'] },
      { model: Matiere, attributes: ['id', 'code', 'intitule'] },
    ],
  });
  return compte && compte.Classe?.etablissementId === etablissementId ? compte : null;
}

function presenter(compte, saisies = {}) {
  return {
    id: compte.id,
    tache: compte.tache,
    categorie: compte.categorie,
    evaluation: compte.evaluationLibelle,
    statut: compte.statut,
    dateCreation: compte.dateCreation || compte.createdAt,
    dateExpiration: compte.dateExpiration,
    lien: lienAccesTemporaire(compte.jeton),
    professeur: compte.Professeur ? { id: compte.Professeur.id, nom: compte.Professeur.nom, prenom: compte.Professeur.prenom, email: compte.Professeur.email } : null,
    classe: compte.Classe ? { id: compte.Classe.id, nom: compte.Classe.nom, niveau: compte.Classe.niveau } : null,
    matiere: compte.Matiere ? { id: compte.Matiere.id, code: compte.Matiere.code, intitule: compte.Matiere.intitule } : null,
    saisies: (saisies.notes || 0) + (saisies.absences || 0),
    saisieEnvoyeeLe: compte.saisieEnvoyeeLe,
  };
}

// Tous les accès temporaires délivrés par l'école, du plus récent au plus
// ancien, avec leur statut réel et le nombre de saisies déjà reçues.
async function listerComptesEphemeres(req, res) {
  const comptes = await CompteEphemere.findAll({
    include: [
      { model: Classe, attributes: ['id', 'nom', 'niveau', 'etablissementId'], where: { etablissementId: req.utilisateur.etablissementId } },
      { model: Professeur, attributes: ['id', 'nom', 'prenom', 'email'] },
      { model: Matiere, attributes: ['id', 'code', 'intitule'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 300,
  });
  for (const compte of comptes) await statutEffectif(compte);

  const ids = comptes.map((c) => c.id);
  const saisies = {};
  if (ids.length) {
    const [notes, absences] = await Promise.all([
      Note.findAll({ attributes: ['compteEphemereId', [fn('COUNT', col('id')), 'n']], where: { compteEphemereId: ids }, group: ['compteEphemereId'], raw: true }),
      Absence.findAll({ attributes: ['compteEphemereId', [fn('COUNT', col('id')), 'n']], where: { compteEphemereId: ids }, group: ['compteEphemereId'], raw: true }),
    ]);
    notes.forEach((l) => { saisies[l.compteEphemereId] = { ...(saisies[l.compteEphemereId] || {}), notes: Number(l.n) }; });
    absences.forEach((l) => { saisies[l.compteEphemereId] = { ...(saisies[l.compteEphemereId] || {}), absences: Number(l.n) }; });
  }
  return res.json({ comptes: comptes.map((c) => presenter(c, saisies[c.id])) });
}

// Fermer un accès avant son heure (lien envoyé par erreur, mauvaise classe...).
async function revoquerCompteEphemere(req, res) {
  const compte = await compteDeLEcole(req.params.id, req.utilisateur.etablissementId);
  if (!compte) return res.status(404).json({ erreur: 'accès introuvable' });
  compte.statut = 'revoque';
  await compte.save();
  return res.json({ compte: presenter(compte) });
}

// Renvoyer l'e-mail d'un accès encore ouvert (professeur qui ne le trouve pas).
async function renvoyerCompteEphemere(req, res) {
  const compte = await compteDeLEcole(req.params.id, req.utilisateur.etablissementId);
  if (!compte) return res.status(404).json({ erreur: 'accès introuvable' });
  if ((await statutEffectif(compte)) !== 'actif') {
    return res.status(400).json({ erreur: 'cet accès est fermé, crée un nouvel accès pour ce professeur' });
  }
  if (!compte.Professeur) return res.status(410).json({ erreur: "le professeur de cet accès n'existe plus" });
  const email = await envoyerLienProfesseur(compte, { professeur: compte.Professeur, classe: compte.Classe, matiere: compte.Matiere });
  return res.json({ email });
}

// verifierJeton(jeton) : ouvre la session temporaire si le jeton est valide
// (le middleware verifierCompteEphemere a deja fait le controle).
async function verifierJeton(req, res) {
  const compte = req.compteEphemere;
  const [classe, matiere, professeur, eleves] = await Promise.all([
    Classe.findByPk(compte.classeId),
    compte.matiereId ? Matiere.findByPk(compte.matiereId, { include: [UniteEnseignement] }) : null,
    Professeur.findByPk(compte.professeurId),
    Eleve.findAll({ where: { classeId: compte.classeId }, order: [['nom', 'ASC']] }),
  ]);
  // Le jeton peut rester valide (durée non écoulée) alors que le professeur
  // ou la classe visée a été supprimé entre-temps — sans ce contrôle,
  // `professeur.nom`/`classe.nom` plantait en 500 au lieu d'un message clair.
  if (!professeur || !classe) {
    return res.status(410).json({ erreur: 'ce lien ne correspond plus à un professeur ou une classe existant(e)' });
  }
  const etablissement = await Etablissement.findByPk(classe.etablissementId, { attributes: ['nom', 'sigle', 'logo'] });

  return res.json({
    session: 'temporaire',
    tache: compte.tache,
    etablissement: etablissement ? { nom: etablissement.nom, sigle: etablissement.sigle, logo: etablissement.logo } : null,
    professeur: { nom: professeur.nom, prenom: professeur.prenom },
    portee: {
      classe: classe.nom,
      ue: matiere?.UniteEnseignement?.intitule,
      matiere: matiere?.intitule,
      categorie: compte.categorie,
      evaluation: compte.evaluationLibelle,
    },
    dateExpiration: compte.dateExpiration,
    eleves: eleves.map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule })),
  });
}

// enregistrerNotes(liste des moyennes, jeton) -> sauvegarder -> confirmation
// -> signaler tache terminee -> revoquer le compte.
async function enregistrerNotesEphemere(req, res) {
  const compte = req.compteEphemere;
  const { notes } = req.body; // [{ eleveId, valeur }] — valeur = moyenne CC ou Examen selon compte.categorie

  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ erreur: 'aucune note fournie' });
  }

  const eleves = await Eleve.findAll({ where: { classeId: compte.classeId } });
  const idsEleveClasse = new Set(eleves.map((e) => e.id));
  for (const n of notes) {
    if (!idsEleveClasse.has(n.eleveId)) {
      return res.status(400).json({ erreur: "un élève ne correspond pas à la portée du compte éphémère" });
    }
  }

  const resultats = [];
  for (const n of notes) {
    if (n.valeur === '' || n.valeur === undefined || n.valeur === null) continue;
    resultats.push(
      await enregistrerMoyenne({
        eleveId: n.eleveId,
        matiereId: compte.matiereId,
        categorie: compte.categorie,
        valeur: Number(n.valeur),
        compteEphemereId: compte.id,
        etablissementId: eleves.find((e) => e.id === n.eleveId)?.etablissementId,
      })
    );
  }

  // signaler tâche terminée -> révoquer le compte éphémère (fin de tâche).
  compte.statut = 'revoque';
  compte.saisieEnvoyeeLe = new Date();
  await compte.save();

  return res.status(201).json({
    message: 'notes enregistrées',
    resultats,
    compte: { statut: compte.statut },
  });
}

module.exports = {
  creerCompteEphemere, listerComptesEphemeres, revoquerCompteEphemere, renvoyerCompteEphemere, verifierJeton, enregistrerNotesEphemere,
};
