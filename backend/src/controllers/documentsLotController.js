const { Classe, Semestre, Eleve, Note, Matiere, UniteEnseignement, EnvoiGroupe } = require('../models');
const { obtenirEtablissementDe } = require('../services/etablissementService');
const { calculerBulletin, calculerParcours } = require('../services/moyenneService');
const { genererBulletinPDF } = require('../services/pdfService');
const { attestationPDF, relevePDF } = require('../services/documentsOfficielsService');
const { envoyerALaFamille, adressesFamille } = require('../services/familleService');
const { journaliserAudit } = require('../services/auditService');
const { creerZip } = require('../utils/zip');

// Documents en lot : l'Académie coche plusieurs étudiants (ou toute la
// classe) et télécharge leurs documents en une archive ZIP, ou les envoie
// par e-mail à chaque étudiant et à son parent, en arrière-plan.

const DOCUMENTS = {
  bulletin: { libelle: 'Bulletin', semestre: true },
  releve: { libelle: 'Relevé de notes', semestre: false },
  attestation_scolarite: { libelle: 'Certificat de scolarité', semestre: false },
  attestation_inscription: { libelle: "Attestation d'inscription", semestre: false },
  attestation_reussite: { libelle: 'Attestation de réussite', semestre: true },
};
const MAX_ZIP = 150;
const MAX_ENVOI = 500;

const propre = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
const erreur = (message, status = 400) => Object.assign(new Error(message), { status });

async function semestresNotes(eleve) {
  const notes = await Note.findAll({ where: { eleveId: eleve.id }, attributes: ['matiereId'], include: [{ model: Matiere, attributes: ['id'], include: [{ model: UniteEnseignement, attributes: ['semestreId'] }] }] });
  const ids = [...new Set(notes.map((n) => n.Matiere?.UniteEnseignement?.semestreId).filter(Boolean))];
  return Semestre.findAll({ where: { id: ids }, order: [['anneeScolaire', 'ASC'], ['numero', 'ASC']] });
}

async function anneeCourante(etablissementId) {
  const dernier = await Semestre.findOne({ where: { etablissementId }, order: [['anneeScolaire', 'DESC'], ['numero', 'DESC']] });
  return dernier?.anneeScolaire || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
}

// Vérifie la demande et charge les étudiants (tous de l'école du compte).
async function preparer(req, max) {
  const { document, semestreId, eleveIds } = req.body || {};
  const def = DOCUMENTS[document];
  if (!def) throw erreur('document inconnu');
  const ids = [...new Set((Array.isArray(eleveIds) ? eleveIds : []).map(Number).filter(Number.isInteger))];
  if (!ids.length) throw erreur('sélectionnez au moins un étudiant');
  if (ids.length > max) throw erreur(`${max} étudiants au plus par opération`);
  const etablissementId = req.utilisateur.etablissementId;
  let semestre = null;
  if (def.semestre) {
    semestre = await Semestre.findOne({ where: { id: semestreId, etablissementId } });
    if (!semestre) throw erreur('choisissez le semestre');
  }
  const eleves = await Eleve.findAll({ where: { id: ids, etablissementId }, include: [Classe, { association: 'compteEtudiant', attributes: ['id', 'email'] }], order: [['nom', 'ASC'], ['prenom', 'ASC']] });
  if (eleves.length !== ids.length) throw erreur('un des étudiants sélectionnés est introuvable', 404);
  const etablissement = await obtenirEtablissementDe(etablissementId);
  return { document, def, semestre, eleves, etablissement, annee: semestre?.anneeScolaire || await anneeCourante(etablissementId) };
}

// Un document pour un étudiant ; lève une erreur lisible si impossible.
async function documentEleve({ document, semestre, etablissement, annee }, eleve, emisParId) {
  const matricule = eleve.matricule || eleve.id;
  if (document === 'bulletin') {
    const calcul = await calculerBulletin(eleve.id, semestre.id);
    if (!calcul.detailParUE.length) throw erreur('aucune note pour ce semestre');
    const { contenu } = await genererBulletinPDF({ eleve, semestre, ...calcul, etablissement, emisParId });
    return { contenu, nom: `bulletin-${propre(semestre.libelle)}-${matricule}.pdf`, sujet: `Bulletin de ${eleve.prenom} ${eleve.nom} : ${semestre.libelle}`, texte: `Le bulletin du ${semestre.libelle} est disponible en pièce jointe.` };
  }
  if (document === 'releve') {
    const semestres = [];
    for (const s of await semestresNotes(eleve)) semestres.push({ semestre: s, calcul: await calculerBulletin(eleve.id, s.id) });
    const cumul = await calculerParcours(eleve.id);
    const contenu = await relevePDF({ etablissement, eleve, classe: eleve.Classe, semestres, cumul, emisParId });
    return { contenu, nom: `releve-de-notes-${matricule}.pdf`, sujet: `Relevé de notes de ${eleve.prenom} ${eleve.nom}`, texte: 'Le relevé de notes officiel est disponible en pièce jointe.' };
  }
  if (!eleve.Classe) throw erreur("l'étudiant n'est inscrit dans aucune classe");
  const type = document.replace('attestation_', '');
  let resultat = null;
  if (type === 'reussite') {
    resultat = await calculerBulletin(eleve.id, semestre.id);
    if (!resultat.detailParUE.length || !resultat.admis) throw erreur('semestre non validé');
  }
  const contenu = await attestationPDF({ etablissement, eleve, classe: eleve.Classe, type, semestre, resultat, anneeScolaire: annee, emisParId });
  const libelle = DOCUMENTS[document].libelle;
  return { contenu, nom: `${propre(libelle).toLowerCase()}-${matricule}.pdf`, sujet: `${libelle} de ${eleve.prenom} ${eleve.nom}`, texte: `Votre document « ${libelle} » est disponible en pièce jointe. Il est vérifiable en ligne grâce à son code.` };
}

// Archive ZIP des documents sélectionnés ; les étudiants pour lesquels le
// document n'existe pas sont listés dans un fichier « a-lire.txt ».
async function telecharger(req, res) {
  const lot = await preparer(req, MAX_ZIP);
  const fichiers = [];
  const ignores = [];
  for (const eleve of lot.eleves) {
    try {
      const d = await documentEleve(lot, eleve, req.utilisateur.id);
      fichiers.push({ nom: d.nom, contenu: d.contenu });
    } catch (e) {
      if (!e.status) throw e;
      ignores.push(`${eleve.nom} ${eleve.prenom} : ${e.message}`);
    }
  }
  if (!fichiers.length) return res.status(400).json({ erreur: `aucun document à produire (${ignores[0] || 'aucune donnée'})` });
  if (ignores.length) fichiers.push({ nom: 'a-lire.txt', contenu: `Documents non produits :\r\n${ignores.join('\r\n')}\r\n` });
  await journaliserAudit(req, { action: 'documents_lot', cible: lot.def.libelle, details: { nombre: fichiers.length - (ignores.length ? 1 : 0), ignores: ignores.length } });
  const zip = creerZip(fichiers);
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${propre(lot.def.libelle).toLowerCase()}-${new Date().toISOString().slice(0, 10)}.zip"`, 'Content-Length': zip.length, 'Access-Control-Expose-Headers': 'Content-Disposition' });
  return res.send(zip);
}

// Envoi par e-mail : la réponse part tout de suite, l'envoi continue en
// arrière-plan et l'écran suit l'avancement (GET /documents/lots/:id).
async function envoyer(req, res) {
  const lot = await preparer(req, MAX_ENVOI);
  const envoi = await EnvoiGroupe.create({
    etablissementId: req.utilisateur.etablissementId, document: lot.document, creeParId: req.utilisateur.id,
    libelle: `${lot.def.libelle}${lot.semestre ? ` (${lot.semestre.libelle})` : ''}`, total: lot.eleves.length,
  });
  await journaliserAudit(req, { action: 'documents_envoi_groupe', cible: envoi.libelle, details: { nombre: lot.eleves.length } });
  setImmediate(() => traiter(envoi.id, lot, req.utilisateur.id).catch((e) => console.error('envoi groupé', e)));
  return res.status(202).json({ envoi });
}

async function traiter(envoiId, lot, emisParId) {
  const details = [];
  let envoyes = 0;
  let echecs = 0;
  for (const [i, eleve] of lot.eleves.entries()) {
    const nom = `${String(eleve.nom).toUpperCase()} ${eleve.prenom}`;
    try {
      if (!adressesFamille(eleve).length) throw erreur('aucune adresse e-mail (étudiant ou parent)');
      const d = await documentEleve(lot, eleve, emisParId);
      const destinataires = await envoyerALaFamille(eleve, d.sujet, d.texte, [{ contenu: d.contenu, nomFichier: d.nom }]);
      details.push({ eleveId: eleve.id, nom, statut: 'envoye', message: destinataires.join(', ') });
      envoyes += 1;
    } catch (e) {
      details.push({ eleveId: eleve.id, nom, statut: e.status ? 'ignore' : 'echec', message: e.status ? e.message : "l'e-mail n'a pas pu partir" });
      echecs += 1;
    }
    // Avancement enregistré régulièrement pour l'écran de suivi.
    if (i % 3 === 2 || i === lot.eleves.length - 1) {
      await EnvoiGroupe.update({ traites: i + 1, envoyes, echecs, details }, { where: { id: envoiId } });
    }
  }
  await EnvoiGroupe.update({ statut: 'termine', traites: lot.eleves.length, envoyes, echecs, details }, { where: { id: envoiId } });
}

async function suivre(req, res) {
  const envoi = await EnvoiGroupe.findOne({ where: { id: req.params.id, etablissementId: req.utilisateur.etablissementId } });
  if (!envoi) return res.status(404).json({ erreur: 'envoi introuvable' });
  return res.json({ envoi });
}

async function historique(req, res) {
  const envois = await EnvoiGroupe.findAll({
    where: { etablissementId: req.utilisateur.etablissementId }, order: [['createdAt', 'DESC']], limit: 15,
    attributes: ['id', 'libelle', 'total', 'traites', 'envoyes', 'echecs', 'statut', 'createdAt'],
  });
  return res.json({ envois });
}

// Procès-verbaux des résultats de plusieurs classes pour un semestre, en ZIP.
async function procesVerbaux(req, res) {
  const { semestreId, classeIds, format: fmt } = req.body || {};
  const etablissementId = req.utilisateur.etablissementId;
  const semestre = await Semestre.findOne({ where: { id: semestreId, etablissementId } });
  if (!semestre) return res.status(400).json({ erreur: 'choisissez le semestre' });
  const ids = [...new Set((Array.isArray(classeIds) ? classeIds : []).map(Number).filter(Number.isInteger))];
  if (!ids.length) return res.status(400).json({ erreur: 'sélectionnez au moins une classe' });
  const classes = await Classe.findAll({ where: { id: ids, etablissementId }, order: [['niveau', 'ASC'], ['nom', 'ASC']] });
  if (classes.length !== ids.length) return res.status(404).json({ erreur: 'une des classes est introuvable' });
  const { pvResultats } = require('./documentsController');
  const format = fmt === 'xlsx' ? 'xlsx' : 'pdf';
  const fichiers = [];
  for (const classe of classes) {
    const contenu = await pvResultats({ etablissementId, classe, semestre, format, emisParId: req.utilisateur.id });
    fichiers.push({ nom: `resultats-${propre(classe.nom)}-${propre(semestre.libelle)}.${format}`, contenu });
  }
  await journaliserAudit(req, { action: 'documents_lot', cible: 'Procès-verbaux des résultats', details: { classes: classes.length, semestre: semestre.libelle } });
  const zip = creerZip(fichiers);
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="proces-verbaux-${propre(semestre.libelle)}.zip"`, 'Content-Length': zip.length, 'Access-Control-Expose-Headers': 'Content-Disposition' });
  return res.send(zip);
}

module.exports = { telecharger, envoyer, suivre, historique, procesVerbaux, DOCUMENTS };
