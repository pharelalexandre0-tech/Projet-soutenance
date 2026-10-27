const { Op } = require('sequelize');
const m = require('../models');
const { creerZip } = require('../utils/zip');
const { proprietaire } = require('./accesDocumentService');

// Réversibilité : archive complète des données d'une école, qu'elle peut
// télécharger à tout moment et emporter si elle quitte EduSphere. Formats
// ouverts, lisibles sans EduSphere :
//   - donnees/*.csv : une table par fichier (Excel, LibreOffice, tableur) ;
//   - donnees-completes.json : les mêmes données, pour une reprise
//     automatique dans un autre logiciel ;
//   - documents/ : tous les PDF de l'école (bulletins, reçus, fiches de paie,
//     emplois du temps) ;
//   - LISEZMOI.txt : le contenu et la façon de s'en servir.
// Jamais dans l'archive : mots de passe (même hachés), codes de connexion,
// jetons d'accès. Les données d'une autre école n'y entrent jamais.

const SECRETS = /^(motDePasse|jeton|codeDoubleFacteur|codeDoubleFacteurExpire|codeDoubleFacteurPour|tokenReinitialisation|tokenReinitialisationExpire)$/;

function nettoyer(lignes) {
  return lignes.map((l) => {
    const propre = {};
    for (const [cle, valeur] of Object.entries(l)) {
      if (SECRETS.test(cle) || Buffer.isBuffer(valeur)) continue;
      propre[cle] = valeur;
    }
    return propre;
  });
}

function valeurCsv(v) {
  if (v === null || v === undefined) return '';
  let texte = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[";\n\r]/.test(texte)) texte = `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

// CSV « à la française » : séparateur point-virgule, UTF-8 avec BOM, pour
// qu'Excel l'ouvre directement avec les accents.
function versCsv(lignes) {
  if (!lignes.length) return '﻿';
  const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const corps = lignes.map((l) => colonnes.map((c) => valeurCsv(l[c])).join(';'));
  return `﻿${colonnes.join(';')}\r\n${corps.join('\r\n')}\r\n`;
}

const ids = (lignes) => lignes.map((l) => l.id);
const parmi = (champ, liste) => ({ [champ]: { [Op.in]: liste.length ? liste : [-1] } });

async function lire(modele, where) {
  return modele.unscoped().findAll({ where, raw: true, order: [['id', 'ASC']] });
}

// Toutes les lignes de l'école, table par table (nom du fichier => lignes).
async function collecterDonnees(etablissementId) {
  const d = {};
  d.etablissement = await lire(m.Etablissement, { id: etablissementId });
  d.utilisateurs = await lire(m.Utilisateur, { etablissementId });
  d.classes = await lire(m.Classe, { etablissementId });
  d.semestres = await lire(m.Semestre, { etablissementId });
  d.professeurs = await lire(m.Professeur, { etablissementId });
  d.affectations_enseignement = await lire(m.AffectationEnseignement, { etablissementId });
  d.personnel = await lire(m.Personnel, { etablissementId });
  d.eleves = await lire(m.Eleve, { etablissementId });
  d.unites_enseignement = await lire(m.UniteEnseignement, parmi('semestreId', ids(d.semestres)));
  d.matieres = await lire(m.Matiere, parmi('uniteEnseignementId', ids(d.unites_enseignement)));
  const eleveIds = ids(d.eleves);
  const classeIds = ids(d.classes);
  d.notes = await lire(m.Note, parmi('eleveId', eleveIds));
  d.absences = await lire(m.Absence, parmi('eleveId', eleveIds));
  d.incidents_comportement = await lire(m.IncidentComportement, parmi('eleveId', eleveIds));
  d.bulletins = await lire(m.Bulletin, parmi('eleveId', eleveIds));
  d.predictions_ia = await lire(m.PredictionIA, parmi('eleveId', eleveIds));
  d.frais_scolarite = await lire(m.FraisScolarite, parmi('eleveId', eleveIds));
  d.paiements = await lire(m.Paiement, parmi('fraisId', ids(d.frais_scolarite)));
  d.recus = await lire(m.Recu, parmi('paiementId', ids(d.paiements)));
  d.salaires = await lire(m.Salaire, parmi('personnelId', ids(d.personnel)));
  d.emplois_du_temps = await lire(m.EmploiDuTemps, parmi('classeId', classeIds));
  d.publications_emploi_du_temps = await lire(m.PublicationEmploiDuTemps, parmi('classeId', classeIds));
  d.cahiers_de_textes = await lire(m.CahierDeTextes, parmi('classeId', classeIds));
  d.messages_annonces = await lire(m.MessageAnnonce, {
    [Op.or]: [parmi('classeId', classeIds), parmi('auteurId', ids(d.utilisateurs))],
  });
  d.notifications = await lire(m.Notification, parmi('utilisateurId', ids(d.utilisateurs)));
  d.comptes_ephemeres = await lire(m.CompteEphemere, parmi('classeId', classeIds));
  d.comptes_rendus_saisie = await lire(m.CompteRenduSaisie, { etablissementId });
  d.services_etablissement = await lire(m.EntreeExtension, { etablissementId });
  d.fonctionnalites_activees = await lire(m.ActivationFonctionnalite, { etablissementId });
  // Le logo part en image à part, pas en texte base64 dans le tableau.
  d.etablissement = d.etablissement.map(({ logo, ...reste }) => reste);
  for (const cle of Object.keys(d)) d[cle] = nettoyer(d[cle]);
  return d;
}

const DOSSIERS_DOCUMENTS = { bulletin: 'bulletins', recu: 'recus', fiche_paie: 'fiches-de-paie', emploi_du_temps: 'emplois-du-temps' };

// PDF de l'école conservés dans PostgreSQL (retrouvés par leur propriétaire).
async function documentsDe(etablissementId) {
  const tous = await m.DocumentPDF.findAll({ attributes: ['id', 'nomFichier'], raw: true });
  const retenus = [];
  for (const doc of tous) {
    const p = await proprietaire(doc.nomFichier);
    if (p && p.etablissementId === etablissementId) retenus.push({ ...doc, type: p.type });
  }
  return retenus;
}

function logoDe(etablissement) {
  const logo = etablissement?.logo;
  const trouve = typeof logo === 'string' && logo.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  return trouve ? { extension: trouve[1].replace('jpeg', 'jpg'), contenu: Buffer.from(trouve[2], 'base64') } : null;
}

function lisezmoi(etablissement, donnees, nbDocuments, date) {
  const lignes = Object.entries(donnees).map(([table, rangs]) => `  - donnees/${table}.csv : ${rangs.length} ligne${rangs.length > 1 ? 's' : ''}`);
  return [
    `ARCHIVE DES DONNÉES : ${etablissement.nom}${etablissement.sigle ? ` (${etablissement.sigle})` : ''}`,
    `Créée le ${date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })} depuis EduSphere.`,
    '',
    "Cette archive contient toutes les données de l'établissement enregistrées sur EduSphere.",
    "Elle se lit sans EduSphere et permet de les reprendre dans un autre logiciel.",
    '',
    'CONTENU',
    '- donnees/ : un fichier CSV par table (séparateur point-virgule, UTF-8).',
    '  Ouverture : double-clic dans Excel ou LibreOffice Calc.',
    ...lignes,
    '- donnees-completes.json : les mêmes données en un seul fichier JSON,',
    '  pour une reprise automatique par un autre logiciel.',
    `- documents/ : ${nbDocuments} document${nbDocuments > 1 ? 's' : ''} PDF (bulletins, reçus, fiches de paie, emplois du temps).`,
    '- logo : le logo de l\'établissement, s\'il a été renseigné.',
    '',
    'LIENS ENTRE LES TABLES',
    '- Chaque ligne a un identifiant (colonne id).',
    '- eleves.classeId renvoie à classes.id ; notes.eleveId à eleves.id ; notes.matiereId à matieres.id ;',
    '  matieres.uniteEnseignementId à unites_enseignement.id ; unites_enseignement.semestreId à semestres.id ;',
    '  paiements.fraisId à frais_scolarite.id ; recus.paiementId à paiements.id ; salaires.personnelId à personnel.id.',
    '- Note finale d\'une matière = (moyenneCC + moyenneExamen) / 2.',
    `- Règles de l'établissement : validation à ${etablissement.seuilValidation}/20, note éliminatoire sous ${etablissement.noteEliminatoire}/20.`,
    '',
    'CONFIDENTIALITÉ',
    "- Aucun mot de passe, code de connexion ni lien d'accès n'est inclus.",
    '  Les comptes devront être recréés dans le nouveau logiciel.',
    "- L'archive contient des données personnelles (élèves, familles, personnel) :",
    '  conservez-la dans un endroit sûr et ne la transmettez qu\'aux personnes autorisées.',
    '',
  ].join('\r\n');
}

// Archive ZIP complète de l'école : { contenu (Buffer), nomFichier, resume }.
async function construireArchive(etablissementId) {
  const etablissementComplet = await m.Etablissement.findByPk(etablissementId);
  if (!etablissementComplet) throw new Error('établissement introuvable');
  const date = new Date();
  const donnees = await collecterDonnees(etablissementId);
  const documents = await documentsDe(etablissementId);

  const fichiers = [];
  for (const [table, lignes] of Object.entries(donnees)) fichiers.push({ nom: `donnees/${table}.csv`, contenu: versCsv(lignes) });
  fichiers.push({
    nom: 'donnees-completes.json',
    contenu: JSON.stringify({ format: 'edusphere-export-ecole', version: 1, creeLe: date.toISOString(), etablissementId, tables: donnees }, null, 2),
  });
  for (const doc of documents) {
    const ligne = await m.DocumentPDF.findByPk(doc.id, { attributes: ['contenu'] });
    if (ligne?.contenu) fichiers.push({ nom: `documents/${DOSSIERS_DOCUMENTS[doc.type] || 'autres'}/${doc.nomFichier}`, contenu: ligne.contenu });
  }
  const logo = logoDe(etablissementComplet);
  if (logo) fichiers.push({ nom: `logo.${logo.extension}`, contenu: logo.contenu });
  fichiers.unshift({ nom: 'LISEZMOI.txt', contenu: `﻿${lisezmoi(etablissementComplet, donnees, documents.length, date)}` });

  const sigle = (etablissementComplet.sigle || etablissementComplet.nom).normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return {
    contenu: creerZip(fichiers),
    nomFichier: `EduSphere-donnees-${sigle}-${date.toISOString().slice(0, 10)}.zip`,
    resume: { tables: Object.keys(donnees).length, lignes: Object.values(donnees).reduce((s, l) => s + l.length, 0), documents: documents.length },
  };
}

module.exports = { construireArchive, documentsDe };
