const { Absence, Eleve, Classe, Utilisateur, Notification } = require('../models');
const { envoyerEmail } = require('../services/emailService');

// Coeur du diagramme d'activité 6 : enregistrer l'absence, la classer
// justifiée ou non, et notifier automatiquement l'étudiant si elle ne l'est
// pas à la saisie.
async function enregistrerAbsence({ eleveId, date, cours, justifie, motif, saisiParAcademieId, compteEphemereId, etablissementId }) {
  const eleve = await Eleve.findByPk(eleveId, { include: [{ model: Utilisateur, as: 'compteEtudiant' }] });
  if (!eleve || (etablissementId && eleve.etablissementId !== etablissementId)) {
    throw Object.assign(new Error('élève introuvable'), { status: 404 });
  }

  // Un même élève ne peut être marqué absent qu'une fois pour un cours donné
  // un jour donné — un second appel sur la même séance met à jour la ligne
  // existante plutôt que de la dupliquer.
  const [absence, creee] = await Absence.findOrCreate({
    where: { eleveId, date, cours: cours || null },
    defaults: {
      justifie: !!justifie,
      motif: justifie ? motif || null : null,
      saisiParAcademieId: saisiParAcademieId || null,
      compteEphemereId: compteEphemereId || null,
    },
  });
  if (!creee) {
    absence.justifie = !!justifie;
    absence.motif = justifie ? motif || null : null;
    await absence.save();
  }

  if (creee && !absence.justifie && eleve.compteEtudiant) {
    await Notification.create({
      utilisateurId: eleve.compteEtudiant.id,
      contenu: `Absence non justifiée de ${eleve.prenom} ${eleve.nom} le ${date}${cours ? ' en ' + cours : ''}.`,
    });
    await envoyerEmail(
      eleve.compteEtudiant.email,
      `Absence signalée pour ${eleve.prenom} ${eleve.nom}`,
      `Une absence non justifiée a été enregistrée le ${date}. Vous pouvez transmettre un justificatif depuis votre espace.`
    );
  }

  return absence;
}

// Saisie par l'Académie (cas nominal du diagramme 1).
async function saisirAbsenceAcademie(req, res) {
  try {
    const absence = await enregistrerAbsence({ ...req.body, saisiParAcademieId: req.utilisateur.id, etablissementId: req.utilisateur.etablissementId });
    return res.status(201).json({ absence });
  } catch (err) {
    return res.status(err.status || 500).json({ erreur: err.message });
  }
}

// Saisie par un Professeur via compte éphémère (tache = saisie_absences).
async function saisirAbsenceEphemere(req, res) {
  const compte = req.compteEphemere;
  if (compte.tache !== 'saisie_absences') {
    return res.status(403).json({ erreur: 'ce compte éphémère ne permet pas la saisie des absences' });
  }
  // Le lien éphémère ne porte que sur SA classe — un élève d'une autre
  // classe (ou d'une autre école) ne peut pas être marqué absent via ce lien.
  const eleveVise = await Eleve.findByPk(req.body.eleveId);
  if (!eleveVise || eleveVise.classeId !== compte.classeId) {
    return res.status(400).json({ erreur: "cet élève ne correspond pas à la portée du compte éphémère" });
  }
  try {
    const absence = await enregistrerAbsence({ ...req.body, compteEphemereId: compte.id });
    return res.status(201).json({ absence });
  } catch (err) {
    return res.status(err.status || 500).json({ erreur: err.message });
  }
}

// "Faire l'appel" : liste numérotée d'une classe pour une date/un cours
// donné, où l'Académie coche simplement les élèves absents (les autres sont
// considérés présents — rien à saisir pour eux).
async function saisirAppelClasse(req, res) {
  const { classeId, date, cours, absentEleveIds } = req.body;
  if (!classeId || !date || !Array.isArray(absentEleveIds)) {
    return res.status(400).json({ erreur: 'classe, date et liste des absents requises' });
  }
  const classe = await Classe.findByPk(classeId);
  if (!classe || classe.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'classe introuvable' });
  }

  const absences = [];
  for (const eleveId of absentEleveIds) {
    try {
      const absence = await enregistrerAbsence({
        eleveId,
        date,
        cours,
        justifie: false,
        saisiParAcademieId: req.utilisateur.id,
        etablissementId: req.utilisateur.etablissementId,
      });
      absences.push(absence);
    } catch (err) {
      // un élève introuvable dans la liste ne doit pas bloquer le reste de l'appel
    }
  }

  return res.status(201).json({
    message: `Appel enregistré — ${absences.length} absence(s) sur ${absentEleveIds.length} coché(es).`,
    absences,
  });
}

// "Brief" par élève : total d'absences, non justifiées, taux d'absentéisme
// — pour repérer d'un coup d'œil les enfants à surveiller.
async function briefAbsenteisme(req, res) {
  const { classeId } = req.query;
  const whereEleve = { etablissementId: req.utilisateur.etablissementId };
  if (classeId) whereEleve.classeId = classeId;
  const eleves = await Eleve.findAll({ where: whereEleve, include: [Classe], order: [['nom', 'ASC']] });

  const brief = await Promise.all(
    eleves.map(async (eleve) => {
      const total = await Absence.count({ where: { eleveId: eleve.id } });
      const nonJustifiees = await Absence.count({ where: { eleveId: eleve.id, justifie: false } });
      return {
        eleveId: eleve.id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe: eleve.Classe?.nom,
        total,
        justifiees: total - nonJustifiees,
        nonJustifiees,
        tauxAbsenteisme: total > 0 ? Math.round((nonJustifiees / total) * 1000) / 10 : 0,
      };
    })
  );

  return res.json({ brief });
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

async function supprimerAbsence(req, res) {
  const absence = await Absence.findByPk(req.params.id, { include: [Eleve] });
  if (!absence || absence.Eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'absence introuvable' });
  }
  await absence.destroy();
  return res.status(204).send();
}

module.exports = {
  saisirAbsenceAcademie,
  saisirAbsenceEphemere,
  saisirAppelClasse,
  briefAbsenteisme,
  justifierAbsence,
  listerAbsencesEleve,
  statistiquesAbsences,
  supprimerAbsence,
};
