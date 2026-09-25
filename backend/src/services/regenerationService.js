const { Op } = require('sequelize');
const {
  Recu, Paiement, FraisScolarite, Eleve, Classe, Salaire, Personnel,
} = require('../models');
const { genererRecuPDF, genererFichePaiePDF } = require('./pdfService');
const { obtenirEtablissementDe } = require('./etablissementService');

// Un reçu ou une fiche de paie dont le PDF n'est plus disponible (généré
// avant le passage des documents dans PostgreSQL, sur un disque effacé
// depuis) est reconstruit à partir des données de la base, telles qu'elles
// étaient au moment du paiement.
async function regenererRecu(numero) {
  const recu = await Recu.findOne({
    where: { numero },
    include: [{ model: Paiement, include: [{ model: FraisScolarite, include: [{ model: Eleve, include: [Classe] }] }] }],
  });
  const paiement = recu?.Paiement;
  const frais = paiement?.FraisScolarite;
  if (!frais?.Eleve) return null;
  // Situation du frais juste après CE paiement (pas celle d'aujourd'hui).
  const cumul = await Paiement.sum('montant', { where: { fraisId: frais.id, statut: 'valide', id: { [Op.lte]: paiement.id } } });
  const regle = cumul || paiement.montant;
  const fraisAlors = {
    libelle: frais.libelle,
    montant: frais.montant,
    montantRegle: regle,
    statut: regle >= frais.montant ? 'solde' : 'partiel',
  };
  const { contenu } = await genererRecuPDF({
    recuNumero: numero,
    eleve: frais.Eleve,
    frais: fraisAlors,
    paiement,
    etablissement: await obtenirEtablissementDe(frais.Eleve.etablissementId),
  });
  return contenu;
}

async function regenererFichePaie(salaireId) {
  const salaire = await Salaire.findByPk(salaireId, { include: [Personnel] });
  if (!salaire?.Personnel) return null;
  const { contenu } = await genererFichePaiePDF({
    personne: salaire.Personnel,
    salaire,
    etablissement: await obtenirEtablissementDe(salaire.Personnel.etablissementId),
  });
  return contenu;
}

async function regenererDocument(nomFichier) {
  const recu = nomFichier.match(/^recu_(REC-\d{4}-\d+)\.pdf$/);
  if (recu) return regenererRecu(recu[1]);
  const fiche = nomFichier.match(/^fiche_paie_(\d+)\.pdf$/);
  if (fiche) return regenererFichePaie(Number(fiche[1]));
  return null;
}

module.exports = { regenererDocument };
