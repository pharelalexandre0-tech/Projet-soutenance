const { FraisScolarite, Eleve, Utilisateur, Notification } = require('../models');
const { envoyerEmail } = require('./emailService');

// Logique du diagramme d'activité 9, factorisée pour être appelée aussi
// bien depuis l'API (Finance qui déclenche une vérification manuelle) que
// depuis un script exécuté quotidiennement (cf. src/scripts/checkImpayes.js).
// `etablissementId` : optionnel — omis, la vérification porte sur toutes les
// écoles (script planifié quotidien) ; fourni, elle se limite à une seule
// école (déclenchement manuel par la Finance de cette école).
async function verifierImpayesService(etablissementId) {
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const whereEleve = etablissementId ? { etablissementId } : {};
  const fraisEnRetard = await FraisScolarite.findAll({
    where: { statut: ['du', 'partiel'] },
    include: [{ model: Eleve, where: whereEleve, include: [{ model: Utilisateur, as: 'parent' }] }],
  });

  const marques = [];
  for (const frais of fraisEnRetard) {
    if (frais.dateEcheance < aujourdHui) {
      frais.statut = 'impaye';
      await frais.save();
      marques.push(frais.id);

      if (frais.Eleve.parent) {
        await Notification.create({
          utilisateurId: frais.Eleve.parent.id,
          contenu: `Le frais "${frais.libelle}" est en retard de paiement (échéance dépassée).`,
        });
        await envoyerEmail(
          frais.Eleve.parent.email,
          `Frais de scolarité impayé — ${frais.libelle}`,
          `L'échéance du ${frais.dateEcheance} est dépassée sans paiement complet.`
        );
      }
    }
  }

  return { verifiesLe: aujourdHui, nombreMarquesImpayes: marques.length, fraisIds: marques };
}

module.exports = { verifierImpayesService };
