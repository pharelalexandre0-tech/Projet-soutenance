const path = require('path');
const { Bulletin, Eleve, Classe, Semestre, Utilisateur } = require('../models');
const { calculerBulletin } = require('../services/moyenneService');
const { genererBulletinPDF, DOSSIER_STOCKAGE } = require('../services/pdfService');
const { envoyerEmail } = require('../services/emailService');
const { obtenirEtablissementDe } = require('../services/etablissementService');

// Diagramme 5 : getBulletin -> rechercherBulletin -> alt [déjà généré] /
// [non généré] -> calculer -> genererPDF -> enregistrer -> envoyerParEmail.
async function obtenirBulletin(req, res) {
  const { eleveId, semestreId } = req.params;

  const [eleve, semestre] = await Promise.all([
    Eleve.findByPk(eleveId, { include: [Classe, { model: Utilisateur, as: 'compteEtudiant' }, { model: Utilisateur, as: 'parent' }] }),
    Semestre.findByPk(semestreId),
  ]);
  if (!eleve || !semestre || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'élève ou semestre introuvable' });
  }

  // Un Étudiant ne peut consulter que son propre bulletin, un Parent que
  // celui d'un de ses enfants.
  if (req.utilisateur.role === 'etudiant' && eleve.compteEtudiantId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }
  if (req.utilisateur.role === 'parent' && eleve.parentId !== req.utilisateur.id) {
    return res.status(403).json({ erreur: 'accès refusé pour ce rôle' });
  }

  let bulletin = await Bulletin.findOne({ where: { eleveId, semestreId } });
  const etablissement = await obtenirEtablissementDe(req.utilisateur.etablissementId);

  // Le détail par UE/matière est toujours recalculé à la volée (léger et
  // toujours à jour), même quand le bulletin (résumé + PDF) est déjà en
  // cache — sinon l'étudiant qui reconsulte ne verrait plus le détail.
  const { moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE } = await calculerBulletin(
    Number(eleveId),
    Number(semestreId)
  );

  if (bulletin) {
    // Le résumé (moyenne générale / crédits) et le PDF sont toujours
    // regénérés à partir du détail courant — l'étudiant doit toujours
    // télécharger le même document que celui affiché à l'écran. Seul le
    // premier envoi déclenche l'e-mail de notification.
    bulletin.moyenneGenerale = moyenneGenerale;
    bulletin.creditsValides = creditsValides;
    const { cheminRelatif: cheminMisAJour } = await genererBulletinPDF({
      eleve, semestre, moyenneGenerale, creditsValides, creditsTotal, admis, sessionGlobale, detailParUE, etablissement,
    });
    bulletin.fichierPDF = cheminMisAJour;
    await bulletin.save();
    return res.json({ bulletin, origine: 'existant', creditsTotal, admis, sessionGlobale, detailParUE, etablissement });
  }

  const { cheminAbsolu, cheminRelatif } = await genererBulletinPDF({
    eleve,
    semestre,
    moyenneGenerale,
    creditsValides,
    creditsTotal,
    admis,
    sessionGlobale,
    detailParUE,
    etablissement,
  });

  bulletin = await Bulletin.create({
    eleveId,
    semestreId,
    moyenneGenerale,
    creditsValides,
    statut: 'envoye',
    fichierPDF: cheminRelatif,
  });

  for (const destinataire of [eleve.compteEtudiant, eleve.parent].filter(Boolean)) {
    await envoyerEmail(
      destinataire.email,
      `Bulletin de ${eleve.prenom} ${eleve.nom} disponible`,
      `Le bulletin du semestre ${semestre.libelle} est disponible en pièce jointe.`,
      [{ cheminAbsolu, nomFichier: `bulletin_${semestre.libelle.replace(/\s+/g, '_')}.pdf` }]
    );
  }

  return res.status(201).json({ bulletin, origine: 'généré', creditsTotal, admis, sessionGlobale, detailParUE, etablissement });
}

// L'Académie peut renvoyer explicitement le bulletin déjà généré à
// l'étudiant par e-mail (ex. il dit ne pas l'avoir reçu, ou après
// correction de notes) — indépendant de l'envoi automatique du premier
// "obtenirBulletin".
async function envoyerBulletinParEmail(req, res) {
  const { eleveId, semestreId } = req.params;

  const [eleve, semestre, bulletin] = await Promise.all([
    Eleve.findByPk(eleveId, { include: [{ model: Utilisateur, as: 'compteEtudiant' }, { model: Utilisateur, as: 'parent' }] }),
    Semestre.findByPk(semestreId),
    Bulletin.findOne({ where: { eleveId, semestreId } }),
  ]);
  if (!eleve || !semestre || !bulletin || eleve.etablissementId !== req.utilisateur.etablissementId) {
    return res.status(404).json({ erreur: 'bulletin introuvable, consulte-le au moins une fois avant de l\'envoyer' });
  }
  const destinataires = [eleve.compteEtudiant, eleve.parent].filter(Boolean);
  if (destinataires.length === 0) {
    return res.status(400).json({ erreur: 'aucun compte étudiant ou parent associé à cet élève' });
  }

  for (const destinataire of destinataires) {
    await envoyerEmail(
      destinataire.email,
      `Bulletin de ${eleve.prenom} ${eleve.nom} : ${semestre.libelle}`,
      `Le bulletin du semestre ${semestre.libelle} est disponible en pièce jointe.`,
      [{ cheminAbsolu: path.join(DOSSIER_STOCKAGE, path.basename(bulletin.fichierPDF)), nomFichier: `bulletin_${semestre.libelle.replace(/\s+/g, '_')}.pdf` }]
    );
  }

  return res.json({ message: 'bulletin envoyé par e-mail', destinataires: destinataires.map((d) => d.email) });
}

module.exports = { obtenirBulletin, envoyerBulletinParEmail };
