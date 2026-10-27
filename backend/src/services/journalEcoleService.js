const { Op } = require('sequelize');

// « Journal du jour » de l'accueil Académie : ce qui s'est passé dans
// l'école ces derniers jours, regroupé en lignes lisibles (24 notes
// enregistrées en Algorithmique, 3 élèves inscrits en L1...), du plus récent
// au plus ancien. Chaque ligne indique la page où agir.
const JOURS = 7;

const fcfa = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
const jour = (d) => new Date(d).toISOString().slice(0, 10);
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

const LIBELLES_DOCUMENTS = {
  bulletin: ['bulletin émis', 'bulletins émis'],
  recu: ['reçu émis', 'reçus émis'],
  fiche_paie: ['fiche de paie émise', 'fiches de paie émises'],
  emploi_du_temps: ['emploi du temps émis', 'emplois du temps émis'],
  liste_presence: ['liste de présence émise', 'listes de présence émises'],
  recapitulatif_presences: ['récapitulatif des présences émis', 'récapitulatifs des présences émis'],
  proces_verbal: ['procès-verbal émis', 'procès-verbaux émis'],
  attestation: ['attestation émise', 'attestations émises'],
  releve: ['relevé de notes émis', 'relevés de notes émis'],
  pv_deliberation: ['procès-verbal de délibération émis', 'procès-verbaux de délibération émis'],
};

// Regroupe des lignes par clé et garde l'heure la plus récente du groupe.
function grouper(lignes, cle, horodatage) {
  const groupes = new Map();
  for (const l of lignes) {
    const k = cle(l);
    const g = groupes.get(k) || { lignes: [], heure: null };
    g.lignes.push(l);
    const h = new Date(horodatage(l));
    if (!g.heure || h > g.heure) g.heure = h;
    groupes.set(k, g);
  }
  return [...groupes.values()];
}

async function journalDeLEcole(etablissementId) {
  const m = require('../models');
  const depuis = new Date(Date.now() - JOURS * 24 * 3600 * 1000);
  const classes = await m.Classe.findAll({ where: { etablissementId }, attributes: ['id', 'nom'], raw: true });
  const nomClasse = new Map(classes.map((c) => [c.id, c.nom]));
  const eleves = await m.Eleve.findAll({ where: { etablissementId }, attributes: ['id', 'nom', 'prenom', 'classeId', 'createdAt'], raw: true });
  const eleveParId = new Map(eleves.map((e) => [e.id, e]));
  const idsEleves = eleves.map((e) => e.id);
  const evenements = [];

  // Inscriptions
  for (const g of grouper(eleves.filter((e) => new Date(e.createdAt) >= depuis), (e) => `${jour(e.createdAt)}|${e.classeId}`, (e) => e.createdAt)) {
    evenements.push({
      heure: g.heure, type: 'inscription', ton: 'bleu', page: 'eleves',
      titre: `${pluriel(g.lignes.length, 'élève inscrit', 'élèves inscrits')}`,
      detail: nomClasse.get(g.lignes[0].classeId) || 'Sans classe',
    });
  }

  if (idsEleves.length) {
    // Notes enregistrées (par matière et par classe)
    const notes = await m.Note.findAll({
      where: { eleveId: idsEleves, updatedAt: { [Op.gte]: depuis } },
      attributes: ['eleveId', 'matiereId', 'updatedAt', 'compteEphemereId'],
      include: [{ model: m.Matiere, attributes: ['intitule'] }],
    });
    for (const g of grouper(notes, (n) => `${jour(n.updatedAt)}|${eleveParId.get(n.eleveId)?.classeId}`, (n) => n.updatedAt)) {
      const premiere = g.lignes[0];
      const matieres = [...new Set(g.lignes.map((x) => x.Matiere?.intitule || 'matière supprimée'))];
      const parProfesseur = g.lignes.some((x) => x.compteEphemereId);
      evenements.push({
        heure: g.heure, type: 'notes', ton: 'vert', page: 'notes',
        titre: `${pluriel(g.lignes.length, 'note enregistrée', 'notes enregistrées')} · ${nomClasse.get(eleveParId.get(premiere.eleveId)?.classeId) || ''}`,
        detail: `${matieres.length > 3 ? `${matieres.length} matières : ${matieres.slice(0, 3).join(', ')}…` : matieres.join(', ')}${parProfesseur ? ' · saisies par un professeur' : ''}`,
      });
    }

    // Absences et retards (par jour et par classe)
    const absences = await m.Absence.findAll({ where: { eleveId: idsEleves, createdAt: { [Op.gte]: depuis } }, attributes: ['eleveId', 'type', 'justifie', 'createdAt'], raw: true });
    for (const g of grouper(absences, (a) => `${jour(a.createdAt)}|${eleveParId.get(a.eleveId)?.classeId}`, (a) => a.createdAt)) {
      const retards = g.lignes.filter((a) => a.type === 'retard').length;
      const abs = g.lignes.length - retards;
      evenements.push({
        heure: g.heure, type: 'absences', ton: abs >= 5 ? 'rouge' : 'or', page: 'appels',
        titre: [abs && pluriel(abs, 'absence'), retards && pluriel(retards, 'retard')].filter(Boolean).join(' et ') + ' signalés',
        detail: nomClasse.get(eleveParId.get(g.lignes[0].eleveId)?.classeId) || '',
      });
    }

    // Incidents de comportement
    const incidents = await m.IncidentComportement.findAll({ where: { eleveId: idsEleves, createdAt: { [Op.gte]: depuis } }, attributes: ['eleveId', 'gravite', 'createdAt'], raw: true });
    for (const i of incidents) {
      const e = eleveParId.get(i.eleveId);
      evenements.push({
        heure: new Date(i.createdAt), type: 'incident', ton: i.gravite === 'grave' ? 'rouge' : 'or', page: 'prediction',
        titre: `Incident ${i.gravite ? `(${i.gravite}) ` : ''}signalé`, detail: e ? `${e.prenom} ${e.nom}` : '',
      });
    }

    // Paiements reçus (par jour)
    const paiements = await m.Paiement.findAll({
      where: { createdAt: { [Op.gte]: depuis } },
      attributes: ['montant', 'createdAt'],
      include: [{ model: m.FraisScolarite, attributes: [], where: { eleveId: idsEleves }, required: true }],
      raw: true,
    });
    for (const g of grouper(paiements, (p) => jour(p.createdAt), (p) => p.createdAt)) {
      evenements.push({
        heure: g.heure, type: 'paiements', ton: 'vert', page: null,
        titre: `${pluriel(g.lignes.length, 'paiement reçu', 'paiements reçus')}`,
        detail: fcfa(g.lignes.reduce((s, p) => s + Number(p.montant || 0), 0)),
      });
    }
  }

  // Saisies envoyées par les professeurs (accès temporaires)
  const comptesRendus = await m.CompteRenduSaisie.findAll({ where: { etablissementId, createdAt: { [Op.gte]: depuis } }, attributes: ['tache', 'professeurNom', 'classeNom', 'matiereNom', 'createdAt'], raw: true });
  for (const c of comptesRendus) {
    evenements.push({
      heure: new Date(c.createdAt), type: 'professeur', ton: 'bleu', page: 'comptes',
      titre: `${c.professeurNom || 'Un professeur'} a envoyé ${c.tache === 'appel' ? "l'appel" : 'les notes'}`,
      detail: [c.matiereNom, c.classeNom].filter(Boolean).join(', '),
    });
  }

  // Documents officiels émis (par jour et par type)
  const certifications = await m.CertificationDocument.findAll({ where: { etablissementId, emisLe: { [Op.gte]: depuis } }, attributes: ['typeDocument', 'emisLe'], raw: true });
  for (const g of grouper(certifications, (c) => `${jour(c.emisLe)}|${c.typeDocument}`, (c) => c.emisLe)) {
    const [un, plusieurs] = LIBELLES_DOCUMENTS[g.lignes[0].typeDocument] || ['document émis', 'documents émis'];
    evenements.push({
      heure: g.heure, type: 'documents', ton: 'bleu', page: 'documents',
      titre: `${g.lignes.length} ${g.lignes.length > 1 ? plusieurs : un}`, detail: 'Certifiés, vérifiables par QR code',
    });
  }

  // Messages publiés
  const messages = await m.MessageAnnonce.findAll({
    where: { createdAt: { [Op.gte]: depuis } }, attributes: ['titre', 'classeId', 'createdAt'],
    include: [{ model: m.Classe, attributes: [], where: { etablissementId }, required: true }], raw: true,
  }).catch(() => []);
  for (const msg of messages) {
    evenements.push({
      heure: new Date(msg.createdAt), type: 'message', ton: 'bleu', page: 'communication',
      titre: `Message publié : ${msg.titre}`, detail: nomClasse.get(msg.classeId) || '',
    });
  }

  evenements.sort((a, b) => b.heure - a.heure);
  return evenements.slice(0, 60);
}

module.exports = { journalDeLEcole };
