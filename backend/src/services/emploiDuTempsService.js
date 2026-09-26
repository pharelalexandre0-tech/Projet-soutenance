const {
  EmploiDuTemps, PublicationEmploiDuTemps, Classe, Eleve, Utilisateur, Semestre, Notification, Etablissement,
} = require('../models');
const { envoyerEmail } = require('./emailService');
const { emailEmploiDuTemps } = require('./modelesEmail');

const ORDRE_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Copie figée d'une grille : seulement ce que voit un étudiant, triée pour
// qu'on puisse comparer brouillon et version publiée.
function instantane(creneaux) {
  return creneaux
    .map((c) => ({
      id: c.id, jour: c.jour, heureDebut: c.heureDebut, heureFin: c.heureFin, matiere: c.matiere || null, salle: c.salle || null,
    }))
    .sort((a, b) => (ORDRE_JOURS.indexOf(a.jour) - ORDRE_JOURS.indexOf(b.jour)) || a.heureDebut.localeCompare(b.heureDebut));
}

function signature(creneaux) {
  return JSON.stringify(instantane(creneaux).map(({ id, ...reste }) => reste));
}

async function brouillon(classeId) {
  return EmploiDuTemps.findAll({ where: { classeId } });
}

// État de publication d'une classe, pour l'Académie.
async function etatPublication(classeId) {
  const [creneaux, publication] = await Promise.all([
    brouillon(classeId),
    PublicationEmploiDuTemps.findOne({ where: { classeId }, include: [{ model: Utilisateur, as: 'publiePar', attributes: ['prenom', 'nom'] }] }),
  ]);
  return {
    nbCoursBrouillon: creneaux.length,
    publication: publication ? {
      publieLe: publication.publieLe,
      version: publication.version,
      nbCours: publication.creneaux.length,
      nbDestinataires: publication.nbDestinataires,
      publiePar: publication.publiePar ? `${publication.publiePar.prenom} ${publication.publiePar.nom}` : null,
    } : null,
    aJour: !!publication && signature(creneaux) === signature(publication.creneaux),
  };
}

// Une entrée par adresse à prévenir : l'étudiant (notification sur son
// compte et e-mail) et son parent (e-mail seul : il voit la notification en
// ouvrant le compte de l'enfant). Dédoublonné (jumeaux, même parent).
async function destinatairesDe(classeId) {
  const eleves = await Eleve.findAll({ where: { classeId }, include: [{ model: Utilisateur, as: 'compteEtudiant' }] });
  const destinataires = new Map();
  eleves.forEach((e) => {
    if (e.compteEtudiant) {
      destinataires.set(e.compteEtudiant.email.toLowerCase(), { email: e.compteEtudiant.email, prenom: e.compteEtudiant.prenom, compteId: e.compteEtudiant.id });
    }
    if (e.emailParent && !destinataires.has(e.emailParent.toLowerCase())) {
      destinataires.set(e.emailParent.toLowerCase(), { email: e.emailParent, prenom: null, compteId: null });
    }
  });
  return [...destinataires.values()];
}

async function prevenir(destinataires, { classe, miseAJour, nbCours, semestre, etablissement }) {
  for (const destinataire of destinataires) {
    try {
      if (destinataire.compteId) {
        await Notification.create({
          utilisateurId: destinataire.compteId,
          contenu: `Emploi du temps ${miseAJour ? 'mis à jour' : 'publié'} pour la classe ${classe}.`,
        });
      }
      const message = emailEmploiDuTemps({ prenom: destinataire.prenom, classe, miseAJour, nbCours, semestre, etablissement });
      await envoyerEmail(destinataire.email, message.sujet, message.texte, [], { html: message.html });
    } catch (err) {
      console.error('[Emploi du temps] Envoi impossible :', err.message);
    }
  }
}

// Publie la grille actuelle : copie figée pour les étudiants et parents,
// puis notification et e-mail à chacun (envoyés en arrière-plan pour ne
// pas faire attendre l'Académie sur une classe nombreuse).
async function publier({ classe, semestreId, utilisateur }) {
  const creneaux = await brouillon(classe.id);
  const existante = await PublicationEmploiDuTemps.findOne({ where: { classeId: classe.id } });
  // Une grille vide ne se publie que pour retirer une version déjà en ligne.
  if (creneaux.length === 0 && !existante) {
    throw Object.assign(new Error("ajoute au moins un cours avant de publier l'emploi du temps"), { status: 400 });
  }
  const semestre = semestreId ? await Semestre.findByPk(semestreId) : null;
  const destinataires = await destinatairesDe(classe.id);
  const donnees = {
    classeId: classe.id,
    semestreId: semestre && semestre.etablissementId === classe.etablissementId ? semestre.id : null,
    creneaux: instantane(creneaux),
    publieLe: new Date(),
    publieParId: utilisateur.id,
    nbDestinataires: destinataires.length,
  };
  const publication = existante
    ? await existante.update({ ...donnees, version: existante.version + 1 })
    : await PublicationEmploiDuTemps.create(donnees);

  const etablissement = await Etablissement.findByPk(classe.etablissementId);
  prevenir(destinataires, {
    classe: `${classe.nom} (${classe.niveau})`,
    miseAJour: !!existante,
    nbCours: creneaux.length,
    semestre: semestre ? `${semestre.libelle} ${semestre.anneeScolaire}` : null,
    etablissement,
  });
  return { publication, nbDestinataires: destinataires.length, miseAJour: !!existante };
}

// Grille visible par un étudiant ou un parent : la version publiée.
async function versionPubliee(classeIds) {
  const publications = await PublicationEmploiDuTemps.findAll({ where: { classeId: classeIds } });
  return publications;
}

// Au démarrage : une classe qui avait déjà une grille avant l'arrivée de la
// publication la garde visible pour ses étudiants (publiée telle quelle,
// sans prévenir personne), au lieu de la faire disparaître d'un coup.
async function initialiserPublicationsEmplois() {
  const classes = await Classe.findAll({ attributes: ['id'] });
  let n = 0;
  for (const classe of classes) {
    const dejaPubliee = await PublicationEmploiDuTemps.count({ where: { classeId: classe.id } });
    if (dejaPubliee) continue;
    const creneaux = await brouillon(classe.id);
    if (!creneaux.length) continue;
    await PublicationEmploiDuTemps.create({ classeId: classe.id, creneaux: instantane(creneaux), publieLe: new Date(), nbDestinataires: 0 });
    n += 1;
  }
  if (n) console.log(`Emplois du temps : ${n} grille(s) existante(s) publiée(s) telles quelles.`);
}

module.exports = { etatPublication, publier, versionPubliee, initialiserPublicationsEmplois };
