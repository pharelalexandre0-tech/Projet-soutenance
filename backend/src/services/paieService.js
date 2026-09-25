const { Professeur, Personnel } = require('../models');

function posteEnseignant(professeur) {
  return professeur.matiere ? `Enseignant (${professeur.matiere})` : 'Enseignant';
}

// La paie reprend les professeurs enregistrés par l'Académie : chacun a sa
// fiche Personnel (liée par professeurId), créée à la première occasion.
// Nom, prénom et e-mail suivent la fiche du professeur ; le poste, le
// salaire de base et la date d'embauche restent gérés par la Finance.
async function rattacherProfesseursALaPaie(etablissementId) {
  const where = etablissementId ? { etablissementId } : {};
  const professeurs = await Professeur.findAll({ where });
  let crees = 0;
  for (const professeur of professeurs) {
    const fiche = await Personnel.findOne({ where: { professeurId: professeur.id } });
    if (!fiche) {
      await Personnel.create({
        nom: professeur.nom,
        prenom: professeur.prenom,
        email: professeur.email,
        poste: posteEnseignant(professeur),
        professeurId: professeur.id,
        etablissementId: professeur.etablissementId,
      });
      crees += 1;
    } else if (fiche.nom !== professeur.nom || fiche.prenom !== professeur.prenom || fiche.email !== professeur.email) {
      await fiche.update({ nom: professeur.nom, prenom: professeur.prenom, email: professeur.email });
    }
  }
  if (!etablissementId && crees) console.log(`Paie : ${crees} professeur(s) ajouté(s) au personnel.`);
  return crees;
}

module.exports = { rattacherProfesseursALaPaie, posteEnseignant };
