const { Eleve, Classe, Recu, Paiement, FraisScolarite, Salaire, Personnel } = require('../models');

// Qui peut ouvrir quel PDF (bulletin, reçu, fiche de paie, emploi du temps).
// Les noms de fichiers sont prévisibles (bulletin_12_4.pdf, recu_REC-2026-00009.pdf) :
// connaître l'adresse ne doit jamais suffire. On retrouve l'élève ou l'école du
// document à partir de son nom, puis on vérifie que la personne connectée y a droit :
// - Académie et Finance : les documents de leur école (fiches de paie : Finance seulement) ;
// - étudiant (ou son parent) : ses propres bulletins, ses reçus, l'emploi du temps de sa classe ;
// - superadmin : aucun (il ne voit jamais le contenu d'une école).

async function proprietaire(nomFichier) {
  let m = nomFichier.match(/^bulletin_(\d+)_(\d+)(?:_\d+)?\.pdf$/);
  if (m) {
    const eleve = await Eleve.findByPk(Number(m[1]), { attributes: ['id', 'etablissementId'] });
    return eleve && { type: 'bulletin', eleveId: eleve.id, etablissementId: eleve.etablissementId };
  }
  m = nomFichier.match(/^recu_(.+)\.pdf$/);
  if (m) {
    const recu = await Recu.findOne({
      where: { numero: m[1] },
      include: [{ model: Paiement, include: [{ model: FraisScolarite, include: [{ model: Eleve, attributes: ['id', 'etablissementId'] }] }] }],
    });
    const eleve = recu?.Paiement?.FraisScolarite?.Eleve;
    return eleve && { type: 'recu', eleveId: eleve.id, etablissementId: eleve.etablissementId };
  }
  m = nomFichier.match(/^fiche_paie_(\d+)\.pdf$/);
  if (m) {
    const salaire = await Salaire.findByPk(Number(m[1]), { include: [{ model: Personnel, attributes: ['etablissementId'] }] });
    return salaire?.Personnel && { type: 'fiche_paie', etablissementId: salaire.Personnel.etablissementId };
  }
  m = nomFichier.match(/^emploi_du_temps_(\d+)_(\d+)(?:_\d+)?\.pdf$/);
  if (m) {
    const classe = await Classe.findByPk(Number(m[1]), { attributes: ['id', 'etablissementId'] });
    return classe && { type: 'emploi_du_temps', classeId: classe.id, etablissementId: classe.etablissementId };
  }
  return null;
}

async function documentAutorise(utilisateur, nomFichier) {
  if (!utilisateur?.etablissementId) return false;
  const doc = await proprietaire(nomFichier);
  if (!doc || doc.etablissementId !== utilisateur.etablissementId) return false;

  if (utilisateur.role === 'academie') return doc.type !== 'fiche_paie';
  if (utilisateur.role === 'finance') return true;
  if (utilisateur.role === 'etudiant') {
    const eleve = await Eleve.findOne({ where: { compteEtudiantId: utilisateur.id }, attributes: ['id', 'classeId'] });
    if (!eleve) return false;
    if (doc.type === 'bulletin' || doc.type === 'recu') return doc.eleveId === eleve.id;
    if (doc.type === 'emploi_du_temps') return doc.classeId === eleve.classeId;
  }
  return false;
}

module.exports = { documentAutorise };
