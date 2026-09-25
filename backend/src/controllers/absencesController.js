const { Absence, Eleve, Utilisateur, Notification } = require('../models');
const { envoyerEmail } = require('../services/emailService');
const { consignerAppel } = require('../services/compteRenduService');

// Coeur du diagramme d'activité 6 : enregistrer l'absence, la classer
// justifiée ou non, et notifier automatiquement l'étudiant si elle ne l'est
// pas à la saisie.
async function enregistrerAbsence({ eleveId, date, cours, type, justifie, motif, saisiParAcademieId, compteEphemereId, etablissementId }) {
  const eleve = await Eleve.findByPk(eleveId, {
    include: [{ model: Utilisateur, as: 'compteEtudiant' }, { model: Utilisateur, as: 'parent' }],
  });
  if (!eleve || (etablissementId && eleve.etablissementId !== etablissementId)) {
    throw Object.assign(new Error('élève introuvable'), { status: 404 });
  }
  const typeFinal = type === 'retard' ? 'retard' : 'absence';

  // Un même élève ne peut être marqué absent qu'une fois pour un cours donné
  // un jour donné — un second appel sur la même séance met à jour la ligne
  // existante plutôt que de la dupliquer.
  const [absence, creee] = await Absence.findOrCreate({
    where: { eleveId, date, cours: cours || null },
    defaults: {
      type: typeFinal,
      justifie: !!justifie,
      motif: justifie ? motif || null : null,
      saisiParAcademieId: saisiParAcademieId || null,
      compteEphemereId: compteEphemereId || null,
    },
  });
  if (!creee) {
    absence.type = typeFinal;
    absence.justifie = !!justifie;
    absence.motif = justifie ? motif || null : null;
    await absence.save();
  }

  if (creee && !absence.justifie) {
    const libelleType = typeFinal === 'retard' ? 'Retard' : 'Absence';
    for (const destinataire of [eleve.compteEtudiant, eleve.parent].filter(Boolean)) {
      await Notification.create({
        utilisateurId: destinataire.id,
        contenu: `${libelleType} non justifié${typeFinal === 'retard' ? '' : 'e'} de ${eleve.prenom} ${eleve.nom} le ${date}${cours ? ' en ' + cours : ''}.`,
      });
      await envoyerEmail(
        destinataire.email,
        `${libelleType} signalé${typeFinal === 'retard' ? '' : 'e'} pour ${eleve.prenom} ${eleve.nom}`,
        `${typeFinal === 'retard' ? 'Un retard' : 'Une absence'} non justifié${typeFinal === 'retard' ? '' : 'e'} a été enregistré${typeFinal === 'retard' ? '' : 'e'} le ${date}. Vous pouvez transmettre un justificatif depuis votre espace.`
      );
    }
  }

  return absence;
}

// Saisie par un Professeur via compte éphémère (tache = saisie_absences) —
// un seul geste pour toute la classe du lien plutôt qu'un appel par élève,
// puis le compte se révoque (tâche terminée). Seul point d'entrée pour
// l'appel désormais : l'Académie ne le fait plus elle-même (onglet
// "Absences" retiré), elle génère le lien via Comptes éphémères.
async function saisirAppelEphemere(req, res) {
  const compte = req.compteEphemere;
  if (compte.tache !== 'saisie_absences') {
    return res.status(403).json({ erreur: 'ce compte éphémère ne permet pas la saisie des absences' });
  }
  const { date, cours, absentEleveIds = [], retardEleveIds = [] } = req.body;
  if (!date || !Array.isArray(absentEleveIds) || !Array.isArray(retardEleveIds)) {
    return res.status(400).json({ erreur: 'date et liste des absents/retards requises' });
  }

  // Le lien éphémère ne porte que sur SA classe — un élève d'une autre
  // classe (ou d'une autre école) ne peut pas être marqué absent via ce lien.
  const elevesClasse = await Eleve.findAll({ where: { classeId: compte.classeId } });
  const idsEleveClasse = new Set(elevesClasse.map((e) => e.id));
  const marques = [
    ...absentEleveIds.map((eleveId) => ({ eleveId, type: 'absence' })),
    ...retardEleveIds.map((eleveId) => ({ eleveId, type: 'retard' })),
  ];
  for (const { eleveId } of marques) {
    if (!idsEleveClasse.has(eleveId)) {
      return res.status(400).json({ erreur: "un élève ne correspond pas à la portée du compte éphémère" });
    }
  }

  const absences = [];
  for (const { eleveId, type } of marques) {
    try {
      absences.push(await enregistrerAbsence({ eleveId, date, cours, type, justifie: false, compteEphemereId: compte.id }));
    } catch (err) {
      // Seul "élève introuvable" (déjà écarté plus haut normalement) ne doit
      // pas bloquer le reste de l'appel — une vraie erreur BD ne doit jamais
      // se taire derrière un message qui annonce quand même un succès total.
      if (err.status !== 404) throw err;
    }
  }

  compte.statut = 'revoque';
  compte.saisieEnvoyeeLe = new Date();
  await compte.save();
  // Feuille d'appel complète (présents compris) gardée pour l'Académie.
  await consignerAppel(compte, { eleves: elevesClasse, marques, date });

  const nbAbsences = absences.filter((a) => a.type === 'absence').length;
  const nbRetards = absences.filter((a) => a.type === 'retard').length;
  return res.status(201).json({
    message: `Appel enregistré. ${nbAbsences} absence(s), ${nbRetards} retard(s).`,
    absences,
    compte: { statut: compte.statut },
  });
}

// Étudiant : "Transmettre le justificatif à l'Académie" -> mise à jour du
// statut (absence justifiée).
async function justifierAbsence(req, res) {
  const { id } = req.params;
  const { motif } = req.body;

  const absence = await Absence.findByPk(id, { include: [Eleve] });
  if (!absence || absence.Eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'absence introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && absence.Eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }

  absence.justifie = true;
  absence.motif = motif || 'justificatif transmis';
  await absence.save();

  return res.json({ absence, message: 'absence justifiée' });
}

async function listerAbsencesEleve(req, res) {
  const { eleveId } = req.params;
  const eleve = await Eleve.findByPk(eleveId);
  if (!eleve || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève introuvable' });
  }
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  if (req.utilisateur.role === 'parent' && eleve.parentId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  const absences = await Absence.findAll({ where: { eleveId }, order: [['date', 'DESC']] });
  return res.json({ absences });
}

// "Mettre à jour les statistiques d'absentéisme (tableau de bord)".
async function statistiquesAbsences(req, res) {
  const portee = { include: [{ model: Eleve, where: { etablissementId: req.utilisateur.etablissementId }, attributes: [] }] };
  const total = await Absence.count(portee);
  const nonJustifiees = await Absence.count({ where: { justifie: false }, ...portee });
  return res.json({
    total,
    justifiees: total - nonJustifiees,
    nonJustifiees,
    tauxNonJustifie: total > 0 ? Math.round((nonJustifiees / total) * 1000) / 10 : 0,
  });
}

module.exports = {
  saisirAppelEphemere,
  justifierAbsence,
  listerAbsencesEleve,
  statistiquesAbsences,
};
