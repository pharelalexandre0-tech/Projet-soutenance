const { FraisScolarite, Paiement, Recu, Eleve, Classe, Utilisateur, Notification } = require('../models');
const { genererRecuPDF } = require('./pdfService');
const { envoyerALaFamille } = require('./familleService');
const { obtenirEtablissementDe } = require('./etablissementService');

// Encaissement d'un paiement : le même circuit pour la Finance au guichet et
// pour un paiement mobile money confirmé (reçu certifié, e-mail à la famille,
// notification dans l'espace de l'étudiant).
async function chargerFrais(fraisId) {
  return FraisScolarite.findByPk(fraisId, { include: [{ model: Eleve, include: [Classe, { model: Utilisateur, as: 'compteEtudiant' }] }] });
}

async function encaisser({ frais, montant, modePaiement, enregistreParId = null, emisParId = null, mention = '', modeTest = false }) {
  const paiement = await Paiement.create({ fraisId: frais.id, montant, modePaiement, statut: 'valide', enregistreParFinanceId: enregistreParId });
  frais.montantRegle += montant;
  frais.statut = frais.montantRegle >= frais.montant ? 'solde' : 'partiel';
  await frais.save();

  const recuNumero = `REC-${new Date().getFullYear()}-${String(paiement.id).padStart(5, '0')}`;
  const { contenu, cheminRelatif } = await genererRecuPDF({
    recuNumero, eleve: frais.Eleve, frais, paiement,
    etablissement: await obtenirEtablissementDe(frais.Eleve.etablissementId),
    emisParId: emisParId ?? enregistreParId, modeTest,
  });
  const recu = await Recu.create({ numero: recuNumero, paiementId: paiement.id, fichierPDF: cheminRelatif });

  const adresses = await envoyerALaFamille(
    frais.Eleve,
    `Reçu de paiement : ${frais.libelle}`,
    `Votre paiement de ${montant} FCFA${mention} a été enregistré. Vous trouverez le reçu ${recuNumero} en pièce jointe.`,
    [{ contenu, nomFichier: `${recuNumero}.pdf` }]
  );
  if (frais.Eleve.compteEtudiant) {
    await Notification.create({
      utilisateurId: frais.Eleve.compteEtudiant.id,
      contenu: `Paiement de ${montant} FCFA reçu pour "${frais.libelle}". Statut du frais : ${frais.statut}.`,
    });
  }
  return { paiement, recu, frais, recuEnvoyeA: adresses.length ? adresses.join(', ') : null };
}

module.exports = { chargerFrais, encaisser };
