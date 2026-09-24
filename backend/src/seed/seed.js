require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize,
  Utilisateur,
  Professeur,
  Classe,
  Semestre,
  UniteEnseignement,
  Matiere,
  Eleve,
  Note,
  FraisScolarite,
  Personnel,
  Salaire,
  Etablissement,
} = require('../models');

const MOT_DE_PASSE_DEMO = 'password123';

async function seed() {
  await sequelize.sync({ force: true });

  const motDePasseHache = await bcrypt.hash(MOT_DE_PASSE_DEMO, 10);

  // Le superadmin n'appartient à aucune école — il gère la liste des
  // établissements eux-mêmes (création, suspension...).
  const superadmin = await Utilisateur.create({
    nom: 'Ndong',
    prenom: 'Admin',
    email: 'superadmin@edusphere.ga',
    motDePasse: motDePasseHache,
    role: 'superadmin',
  });

  // "Insertion de l'école dans le système" : EduSphere ne code en dur
  // aucune identité d'établissement — ce seed simule l'onboarding initial
  // (normalement fait par le superadmin), modifiable ensuite via
  // Académie > Paramètres. Deux écoles pour démontrer l'isolation des
  // données entre établissements.
  const etablissement = await Etablissement.create({
    nom: 'Institut Universitaire des Palmiers',
    sigle: 'IUP',
    devise: 'Savoir · Excellence · Avenir',
    ville: 'Libreville',
    pays: 'République Gabonaise',
    boitePostale: 'BP 4021, Libreville',
    telephone: '+241 01 23 45 67',
    email: 'contact@iup-libreville.ga',
  });

  const etablissement2 = await Etablissement.create({
    nom: 'Lycée Excellence de Port-Gentil',
    sigle: 'LEPG',
    devise: 'Discipline · Travail · Réussite',
    ville: 'Port-Gentil',
    pays: 'République Gabonaise',
    boitePostale: 'BP 812, Port-Gentil',
    telephone: '+241 01 98 76 54',
    email: 'contact@lepg.ga',
  });
  // École neuve, tout juste insérée : un seul compte Académie, aucune
  // donnée encore — exactement l'état après la création par le superadmin.
  await Utilisateur.create({
    nom: 'Ivala', prenom: 'Marielle', email: 'academie@lepg.ga',
    motDePasse: motDePasseHache, role: 'academie', service: 'Scolarité',
    etablissementId: etablissement2.id,
  });

  const academie = await Utilisateur.create({
    nom: 'Ondo',
    prenom: 'Sylvie',
    email: 'academie@ecole.ga',
    motDePasse: motDePasseHache,
    role: 'academie',
    service: 'Scolarité',
    etablissementId: etablissement.id,
  });

  const finance = await Utilisateur.create({
    nom: 'Nguema',
    prenom: 'Paul',
    email: 'finance@ecole.ga',
    motDePasse: motDePasseHache,
    role: 'finance',
    fonction: 'Comptable',
    etablissementId: etablissement.id,
  });

  // Plateforme universitaire : chaque étudiant a son propre compte, pas un
  // parent séparé — créé ici puis lié à sa fiche Eleve ci-dessous.
  // Le compte 1 utilise l'adresse Gmail réelle SANS alias "+" : le mode
  // sandbox de Resend (aucun domaine vérifié) refuse tout destinataire qui
  // ne correspond pas EXACTEMENT au compte Resend vérifié, alias compris.
  const compteEtudiant1 = await Utilisateur.create({
    nom: 'Mba',
    prenom: 'Junior',
    email: 'pharelalexandre0@gmail.com',
    motDePasse: motDePasseHache,
    role: 'etudiant',
    etablissementId: etablissement.id,
  });

  const compteEtudiant2 = await Utilisateur.create({
    nom: 'Ella',
    prenom: 'Grace',
    email: 'pharelalexandre0+etudiant2@gmail.com',
    motDePasse: motDePasseHache,
    role: 'etudiant',
    etablissementId: etablissement.id,
  });

const professeur = await Professeur.create({
    nom: 'Obame',
    prenom: 'Charly',
    email: 'prof.obame@ecole.ga',
    matiere: 'Python',
    etablissementId: etablissement.id,
  });

  const classe = await Classe.create({ nom: 'Terminale C', niveau: 'Terminale', etablissementId: etablissement.id });

  const semestre = await Semestre.create({ libelle: 'Semestre 1', anneeScolaire: '2025-2026', etablissementId: etablissement.id });

  // Une UE regroupe plusieurs matières allant dans le même sens
  // (ex. UE "Programmation" -> Python, PHP, Java) ; une UE peut aussi ne
  // contenir qu'une seule matière (ex. Français).
  const ueProgrammation = await UniteEnseignement.create({
    code: 'UE-PROG-101',
    intitule: 'Programmation',
    credits: 6,
    coefficient: 3,
    semestreId: semestre.id,
  });
  const matierePython = await Matiere.create({
    code: 'PROG-PY',
    intitule: 'Python',
    coefficient: 2,
    uniteEnseignementId: ueProgrammation.id,
  });
  const matierePhp = await Matiere.create({
    code: 'PROG-PHP',
    intitule: 'PHP',
    coefficient: 1,
    uniteEnseignementId: ueProgrammation.id,
  });
  const matiereJava = await Matiere.create({
    code: 'PROG-JAVA',
    intitule: 'Java',
    coefficient: 1,
    uniteEnseignementId: ueProgrammation.id,
  });

  const ueMaths = await UniteEnseignement.create({
    code: 'UE-MATH-101',
    intitule: 'Mathématiques',
    credits: 6,
    coefficient: 3,
    semestreId: semestre.id,
  });
  const matiereMaths = await Matiere.create({
    code: 'MATH-GEN',
    intitule: 'Mathématiques générales',
    coefficient: 1,
    uniteEnseignementId: ueMaths.id,
  });

  const ueFrancais = await UniteEnseignement.create({
    code: 'UE-FR-101',
    intitule: 'Français',
    credits: 4,
    coefficient: 2,
    semestreId: semestre.id,
  });
  const matiereFrancais = await Matiere.create({
    code: 'FR-GEN',
    intitule: 'Français',
    coefficient: 1,
    uniteEnseignementId: ueFrancais.id,
  });

  const eleve1 = await Eleve.create({
    nom: 'Mba',
    prenom: 'Junior',
    dateNaissance: '2008-03-12',
    classeId: classe.id,
    compteEtudiantId: compteEtudiant1.id,
    etablissementId: etablissement.id,
  });
  const eleve2 = await Eleve.create({
    nom: 'Ella',
    prenom: 'Grace',
    dateNaissance: '2008-07-25',
    classeId: classe.id,
    compteEtudiantId: compteEtudiant2.id,
    etablissementId: etablissement.id,
  });

  // Quelques moyennes déjà saisies pour Junior Mba, pour avoir un bulletin
  // non vide dès la démo (une ligne par élève+matière : moyenne de CC et
  // moyenne d'examen, la note finale étant calculée à l'affichage).
  await Note.create({ eleveId: eleve1.id, matiereId: matierePython.id, moyenneCC: 14, moyenneExamen: 16, saisiParAcademieId: academie.id });
  await Note.create({ eleveId: eleve1.id, matiereId: matierePhp.id, moyenneCC: 11, moyenneExamen: 9, saisiParAcademieId: academie.id });
  await Note.create({ eleveId: eleve1.id, matiereId: matiereMaths.id, moyenneCC: 13, moyenneExamen: 12, saisiParAcademieId: academie.id });

  // Un frais déjà échu (pour tester le flux "impayés") et un frais à venir.
  await FraisScolarite.create({
    eleveId: eleve1.id,
    semestreId: semestre.id,
    libelle: 'Frais de scolarité, Semestre 1',
    montant: 150000,
    dateEcheance: '2026-08-01',
  });
  await FraisScolarite.create({
    eleveId: eleve2.id,
    semestreId: semestre.id,
    libelle: 'Frais de scolarité, Semestre 1',
    montant: 150000,
    dateEcheance: '2026-12-01',
  });

  // Registre du personnel pour la paie (Espace Finance).
  // E-mail réel sur ce profil (sans alias "+" : le mode sandbox de Resend
  // exige une correspondance exacte avec le compte vérifié), pour pouvoir
  // démontrer l'envoi de la fiche de paie en direct.
  const personnelObame = await Personnel.create({ nom: 'Obame', prenom: 'Charly', email: 'pharelalexandre0@gmail.com', poste: 'Professeur de Programmation', salaireBase: 450000, dateEmbauche: '2021-09-01', etablissementId: etablissement.id });
  const personnelNzue = await Personnel.create({ nom: 'Nzue', prenom: 'Larissa', poste: 'Surveillante générale', salaireBase: 280000, dateEmbauche: '2019-01-15', etablissementId: etablissement.id });
  const personnelMoussavou = await Personnel.create({ nom: 'Moussavou', prenom: 'Éric', poste: 'Agent d\'entretien', salaireBase: 150000, dateEmbauche: '2022-03-01', etablissementId: etablissement.id });
  await Salaire.create({ personnelId: personnelObame.id, montant: 450000, periode: 'Août 2026', statut: 'verse', dateVersement: '2026-08-30', gereParFinanceId: finance.id });
  await Salaire.create({ personnelId: personnelNzue.id, montant: 280000, periode: 'Août 2026', statut: 'verse', dateVersement: '2026-08-30', gereParFinanceId: finance.id });

  console.log('\nDonnées de démonstration créées avec succès.');
  console.log(`Mot de passe pour tous les comptes de démo : ${MOT_DE_PASSE_DEMO}\n`);
  console.log('Comptes :');
  console.log(`  Superadmin (gère toutes les écoles) : ${superadmin.email}`);
  console.log(`  Académie (${etablissement.nom}) : ${academie.email}`);
  console.log(`  Finance  (${etablissement.nom}) : ${finance.email}`);
  console.log(`  Étudiant (${eleve1.prenom} ${eleve1.nom}) : ${compteEtudiant1.email}`);
  console.log(`  Étudiant (${eleve2.prenom} ${eleve2.nom}) : ${compteEtudiant2.email}`);
  console.log(`  Académie (${etablissement2.nom}, école neuve sans données) : academie@lepg.ga`);
  console.log('\nRéférences utiles :');
  console.log(`  classeId=${classe.id} semestreId=${semestre.id}`);
  console.log(`  ueProgrammationId=${ueProgrammation.id} (matières : ${matierePython.id}, ${matierePhp.id}, ${matiereJava.id})`);
  console.log(`  ueMathsId=${ueMaths.id} ueFrancaisId=${ueFrancais.id}`);
  console.log(`  professeurId=${professeur.id}`);
  console.log(`  eleve1Id=${eleve1.id} eleve2Id=${eleve2.id}`);

  await sequelize.close();
}

seed().catch((err) => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
