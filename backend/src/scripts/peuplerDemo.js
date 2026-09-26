// Jeu de données de démonstration et de test : `npm run seed:demo`.
//
// Ajoute dans PostgreSQL un établissement complet et réaliste (« Institut
// de Démonstration EduSphere », sigle IDE) sans rien toucher aux données
// existantes : classes, semestre, UE et matières, 60 étudiants avec
// matricule, parents, professeurs, notes CC et examen aux profils variés,
// absences, incidents, frais et paiements (soldés, partiels, impayés),
// personnel et salaires, emploi du temps publié, un appel de professeur,
// messages, puis une analyse de risque de décrochage.
//
// Les adresses e-mail sont toutes en @*.example.com (domaine réservé aux
// tests) : aucun vrai destinataire ne reçoit quoi que ce soit, et le script
// n'envoie de toute façon aucun e-mail. Relancé alors que l'établissement
// existe déjà, il s'arrête sans rien modifier.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const m = require('../models');
const { MODULES_INTEGRES } = require('../config/fonctionnalites');
const { attribuerMatricule } = require('../services/matriculeService');
const { rattacherProfesseursALaPaie } = require('../services/paieService');
const { consignerAppel } = require('../services/compteRenduService');
const { calculerRisqueEleve } = require('../services/riskService');
const { genererJetonEphemere } = require('../utils/tokenGenerator');
const { publier } = require('../services/evenementsService');

const SIGLE = 'IDE';
const MOT_DE_PASSE = process.env.DEMO_MOT_DE_PASSE || 'EduSphere2026';

// Générateur pseudo-aléatoire à graine fixe : le même jeu de données à
// chaque exécution (utile pour comparer des résultats).
let graine = 20260925;
function alea() {
  graine = (graine + 0x6D2B79F5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + alea() * (max - min);
const entier = (min, max) => Math.floor(entre(min, max + 1));
const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
const quart = (v) => Math.round(Math.min(20, Math.max(0, v)) * 4) / 4;
const sansAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const PRENOMS = [
  'Junior', 'Grâce', 'Ornella', 'Christian', 'Merveille', 'Stève', 'Prisca', 'Loïc', 'Divine', 'Arnaud', 'Chancelle', 'Brice',
  'Hermine', 'Yannick', 'Rolande', 'Fabrice', 'Lauriane', 'Cédric', 'Nadège', 'Ghislain', 'Anicet', 'Carine', 'Dimitri', 'Josiane',
  'Kévin', 'Laetitia', 'Marius', 'Nelly', 'Olivier', 'Patricia', 'Rodrigue', 'Sandrine', 'Thierry', 'Ursule', 'Vanessa', 'Wilfried',
  'Yvon', 'Zita', 'Aymar', 'Bénédicte', 'Clarisse', 'Darius', 'Estelle', 'Franck', 'Gaëlle', 'Hugues', 'Inès', 'Jordan', 'Kelly',
  'Landry', 'Mireille', 'Nathan', 'Océane', 'Parfait', 'Queen', 'Régis', 'Sonia', 'Tatiana', 'Ulrich', 'Viviane',
];
const NOMS = [
  'MBA', 'NGUEMA', 'OBAME', 'ELLA', 'NDONG', 'MOUSSAVOU', 'MBOUMBA', 'NZIENGUI', 'MOUKAGNI', 'BOUSSOUGOU', 'MAKAYA', 'MOUNDOUNGA',
  'NDOUTOUME', 'OYANE', 'MINTSA', 'ESSONE', 'NTOUTOUME', 'MAGANGA', 'BIYOGO', 'MENDOME', 'KOUMBA', 'IBINGA', 'NZE', 'ONDO',
  'ABESSOLO', 'MVOU', 'EYEGHE', 'NGOUA', 'MBADINGA', 'NDZENGUE',
];

const CLASSES = [
  { nom: 'Informatique A', niveau: 'Licence 1' },
  { nom: 'Informatique B', niveau: 'Licence 1' },
  { nom: 'Réseaux et télécoms', niveau: 'Licence 2' },
];

const UES = [
  { code: 'IDE-UE11', intitule: 'Informatique fondamentale', credits: 6, coefficient: 3, matieres: [
    ['INF111', 'Algorithmique', 2], ['INF112', 'Programmation Python', 2], ['INF113', 'Architecture des ordinateurs', 1]] },
  { code: 'IDE-UE12', intitule: 'Mathématiques', credits: 6, coefficient: 3, matieres: [
    ['MAT121', 'Analyse', 2], ['MAT122', 'Algèbre linéaire', 2], ['MAT123', 'Probabilités', 1]] },
  { code: 'IDE-UE13', intitule: 'Bases de données', credits: 4, coefficient: 2, matieres: [
    ['BDD131', 'SQL et modélisation Merise', 2]] },
  { code: 'IDE-UE14', intitule: 'Langues et communication', credits: 4, coefficient: 2, matieres: [
    ['LNG141', 'Anglais', 1], ['LNG142', "Techniques d'expression", 1]] },
];

const PROFESSEURS = [
  ['Jean-Pierre', 'MOUSSAVOU', 'Algorithmique'], ['Sylvie', 'NDONG', 'Mathématiques'], ['Hervé', 'OBIANG', 'Programmation Python'],
  ['Estelle', 'MABIKA', 'Anglais'], ['Rodrigue', 'NZAMBA', 'Bases de données'],
];
const PERSONNEL = [
  ['Clarisse', 'EBANG', 'Comptable', 450000], ['Serge', 'MOUELE', 'Surveillant général', 350000], ['Nina', 'OKOME', 'Secrétaire de direction', 320000],
];

// Profils d'élèves : moyenne visée, nombre d'absences, incidents.
const PROFILS = [
  { nom: 'excellent', part: 0.2, moyenne: [15, 18], absences: [0, 1], incidents: [0, 0] },
  { nom: 'moyen', part: 0.45, moyenne: [11, 14], absences: [0, 3], incidents: [0, 0] },
  { nom: 'fragile', part: 0.2, moyenne: [8.5, 11], absences: [2, 5], incidents: [0, 1] },
  { nom: 'en difficulté', part: 0.15, moyenne: [4, 8.5], absences: [4, 9], incidents: [1, 2] },
];
function tirerProfil() {
  let r = alea();
  for (const p of PROFILS) {
    if (r < p.part) return p;
    r -= p.part;
  }
  return PROFILS[1];
}

// Jours ouvrés de septembre 2026 (pour les absences).
const JOURS_OUVRES = [];
for (let j = 1; j <= 25; j += 1) {
  const d = new Date(2026, 8, j);
  if (d.getDay() !== 0 && d.getDay() !== 6) JOURS_OUVRES.push(`2026-09-${String(j).padStart(2, '0')}`);
}

async function main() {
  await m.sequelize.authenticate();
  if (await m.Etablissement.findOne({ where: { sigle: SIGLE } })) {
    console.log(`L'établissement de démonstration (${SIGLE}) existe déjà : rien n'a été modifié.`);
    console.log('Pour le recréer, supprimez-le depuis l’espace superadmin puis relancez npm run seed:demo.');
    await m.sequelize.close();
    return;
  }
  const hache = await bcrypt.hash(MOT_DE_PASSE, 10);
  const compteurs = {};
  const compter = (cle, n = 1) => { compteurs[cle] = (compteurs[cle] || 0) + n; };

  const etab = await m.Etablissement.create({
    nom: 'Institut de Démonstration EduSphere', sigle: SIGLE, devise: 'Apprendre, Innover, Réussir',
    ville: 'Libreville', pays: 'République Gabonaise', boitePostale: 'BP 2026', telephone: '+241 01 00 20 26', email: 'contact@ide.example.com',
  });
  for (const module of MODULES_INTEGRES) await m.ActivationFonctionnalite.create({ etablissementId: etab.id, cle: module.cle });

  const academie = await m.Utilisateur.create({ nom: 'OKANA', prenom: 'Sylvie', email: 'academie@ide.example.com', motDePasse: hache, role: 'academie', service: 'Scolarité', etablissementId: etab.id });
  const finance = await m.Utilisateur.create({ nom: 'NGOUA', prenom: 'Paul', email: 'finance@ide.example.com', motDePasse: hache, role: 'finance', fonction: 'Comptable', etablissementId: etab.id });

  const semestre = await m.Semestre.create({ libelle: 'Semestre 1', anneeScolaire: '2025-2026', cycle: 'licence', numero: 1, etablissementId: etab.id });
  const matieres = [];
  for (const ue of UES) {
    const u = await m.UniteEnseignement.create({ code: ue.code, intitule: ue.intitule, credits: ue.credits, coefficient: ue.coefficient, semestreId: semestre.id });
    for (const [code, intitule, coefficient] of ue.matieres) {
      matieres.push(await m.Matiere.create({ code: `${SIGLE}-${code}`, intitule, coefficient, uniteEnseignementId: u.id }));
    }
  }

  const professeurs = [];
  for (const [prenom, nom, matiere] of PROFESSEURS) {
    professeurs.push(await m.Professeur.create({ prenom, nom, matiere, email: `${sansAccents(prenom)}.${sansAccents(nom)}@profs.example.com`, etablissementId: etab.id }));
  }

  const classes = [];
  for (const c of CLASSES) classes.push(await m.Classe.create({ ...c, etablissementId: etab.id }));

  // Étudiants, parents, notes, absences, incidents, frais et paiements.
  let indexNom = 0;
  const eleves = [];
  for (const classe of classes) {
    for (let i = 0; i < 20; i += 1) {
      const prenom = PRENOMS[indexNom % PRENOMS.length];
      const nom = NOMS[(indexNom * 7 + 3) % NOMS.length];
      indexNom += 1;
      const email = `${sansAccents(prenom)}.${sansAccents(nom)}${indexNom}@eleves.example.com`;
      const profil = tirerProfil();
      const compte = await m.Utilisateur.create({ nom, prenom, email, motDePasse: hache, role: 'etudiant', etablissementId: etab.id });
      // Un élève sur deux a l'adresse d'un parent : le parent ouvre le
      // compte de l'enfant avec elle et le matricule.
      const emailParent = i % 2 === 0 ? `parent.${sansAccents(nom)}${indexNom}@parents.example.com` : null;
      if (emailParent) compter('parents');
      const eleve = await m.Eleve.create({
        nom, prenom, dateNaissance: `${entier(2003, 2007)}-${String(entier(1, 12)).padStart(2, '0')}-${String(entier(1, 28)).padStart(2, '0')}`,
        classeId: classe.id, etablissementId: etab.id, compteEtudiantId: compte.id, emailParent,
      });
      await attribuerMatricule(eleve);
      eleves.push({ eleve, profil, classe });
      compter('etudiants');

      // Notes : moyenne visée par le profil, avec un écart par matière.
      const cible = entre(...profil.moyenne);
      for (const matiere of matieres) {
        const niveauMatiere = cible + entre(-2.5, 2.5);
        await m.Note.create({
          eleveId: eleve.id, matiereId: matiere.id, session: 'normale', saisiParAcademieId: academie.id,
          moyenneCC: quart(niveauMatiere + entre(-2, 2)), moyenneExamen: quart(niveauMatiere + entre(-3, 2)),
        });
        compter('notes');
      }

      // Absences (certaines justifiées) et retards.
      const nbAbsences = entier(...profil.absences);
      const jours = [...JOURS_OUVRES].sort(() => alea() - 0.5).slice(0, nbAbsences);
      for (const date of jours) {
        const justifie = alea() < 0.3;
        await m.Absence.create({
          eleveId: eleve.id, date, type: alea() < 0.25 ? 'retard' : 'absence', justifie, motif: justifie ? choisir(['Certificat médical', 'Décès dans la famille', 'Convocation administrative']) : null,
          cours: choisir(matieres).intitule, saisiParAcademieId: academie.id,
        });
        compter('absences');
      }

      // Incidents de comportement.
      const nbIncidents = entier(...profil.incidents);
      for (let k = 0; k < nbIncidents; k += 1) {
        await m.IncidentComportement.create({
          eleveId: eleve.id, date: choisir(JOURS_OUVRES), saisiParAcademieId: academie.id,
          gravite: profil.nom === 'en difficulté' && alea() < 0.4 ? 'majeur' : 'mineur',
          description: choisir(['Retards répétés en première heure', 'Bavardages persistants malgré avertissements', 'Téléphone utilisé pendant un devoir', 'Absence de travail rendu à trois reprises', 'Propos irrespectueux envers un camarade']),
        });
        compter('incidents');
      }

      // Frais : inscription (échue au 15 septembre) et scolarité (échéance fin octobre).
      const inscription = await m.FraisScolarite.create({ eleveId: eleve.id, semestreId: semestre.id, libelle: "Frais d'inscription 2025-2026", montant: 150000, dateEcheance: '2026-09-15', statut: 'du' });
      const scolarite = await m.FraisScolarite.create({ eleveId: eleve.id, semestreId: semestre.id, libelle: 'Frais de scolarité 2025-2026', montant: 1500000, dateEcheance: '2026-10-31', statut: 'du' });
      compter('frais', 2);
      const payer = async (frais, montant, jour) => {
        const paiement = await m.Paiement.create({
          fraisId: frais.id, montant, modePaiement: choisir(['especes', 'mobile_money', 'virement']), statut: 'valide',
          datePaiement: new Date(`2026-09-${String(jour).padStart(2, '0')}T10:00:00`), enregistreParFinanceId: finance.id,
        });
        const numero = `REC-2026-${String(paiement.id).padStart(5, '0')}`;
        // Le PDF du reçu est reconstruit à la première ouverture du lien.
        await m.Recu.create({ numero, paiementId: paiement.id, fichierPDF: `/fichiers/recu_${numero}.pdf` });
        frais.montantRegle += montant;
        compter('paiements');
      };
      if (alea() < 0.85) await payer(inscription, 150000, entier(1, 14));
      const r = alea();
      if (r < 0.4) await payer(scolarite, 1500000, entier(2, 20));
      else if (r < 0.75) {
        await payer(scolarite, 650000, entier(2, 12));
        if (alea() < 0.4) await payer(scolarite, 350000, entier(13, 24));
      }
      for (const frais of [inscription, scolarite]) {
        const echu = new Date(`${frais.dateEcheance}T23:59:59`) < new Date();
        frais.statut = frais.montantRegle >= frais.montant ? 'solde' : echu ? 'impaye' : frais.montantRegle > 0 ? 'partiel' : 'du';
        await frais.save();
      }
    }
  }

  // Emploi du temps de chaque classe, publié.
  const CRENEAUX = [['08:00', '10:00'], ['10:15', '12:15'], ['14:00', '16:00']];
  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  for (const classe of classes) {
    const cours = [];
    JOURS.forEach((jour, j) => {
      CRENEAUX.slice(0, j === 2 ? 2 : 3).forEach(([heureDebut, heureFin], k) => {
        cours.push({ jour, heureDebut, heureFin, matiere: matieres[(j * 3 + k + classe.id) % matieres.length].intitule, salle: `Salle ${String.fromCharCode(65 + (k % 3))}${entier(1, 12)}` });
      });
    });
    const crees = [];
    for (const c of cours) crees.push(await m.EmploiDuTemps.create({ ...c, classeId: classe.id, semestreId: semestre.id }));
    await m.PublicationEmploiDuTemps.create({
      classeId: classe.id, semestreId: semestre.id, publieParId: academie.id, publieLe: new Date('2026-09-01T09:00:00'),
      nbDestinataires: 0, version: 1,
      creneaux: crees.map((c) => ({ id: c.id, jour: c.jour, heureDebut: c.heureDebut, heureFin: c.heureFin, matiere: c.matiere, salle: c.salle })),
    });
    compter('cours', crees.length);
  }

  // Un appel déjà fait par un professeur (accès temporaire terminé).
  const classeA = classes[0];
  const elevesA = eleves.filter((e) => e.classe.id === classeA.id).map((e) => e.eleve);
  const acces = await m.CompteEphemere.create({
    jeton: genererJetonEphemere(), tache: 'saisie_absences', professeurId: professeurs[0].id, classeId: classeA.id, creeParAcademieId: academie.id,
    dateCreation: new Date('2026-09-24T07:55:00'), dateExpiration: new Date('2026-09-24T09:55:00'), statut: 'revoque', saisieEnvoyeeLe: new Date('2026-09-24T08:20:00'),
  });
  const marques = [{ eleveId: elevesA[3].id, type: 'absence' }, { eleveId: elevesA[11].id, type: 'retard' }];
  for (const mq of marques) {
    await m.Absence.create({ eleveId: mq.eleveId, date: '2026-09-24', type: mq.type, justifie: false, cours: 'Algorithmique', compteEphemereId: acces.id });
  }
  await consignerAppel(acces, { eleves: elevesA, marques, date: '2026-09-24', envoyeLe: acces.saisieEnvoyeeLe });

  // Messages aux classes.
  for (const classe of classes) {
    await m.MessageAnnonce.create({ titre: 'Réunion de rentrée', contenu: 'Une réunion d’information se tiendra vendredi à 16 h en amphithéâtre A.', type: 'annonce', classeId: classe.id, auteurId: academie.id });
  }

  // Personnel : les professeurs sont repris automatiquement, plus trois
  // membres du personnel administratif ; deux mois de salaires versés.
  await rattacherProfesseursALaPaie(etab.id);
  for (const [prenom, nom, poste, salaireBase] of PERSONNEL) {
    await m.Personnel.create({ prenom, nom, poste, salaireBase, email: `${sansAccents(prenom)}.${sansAccents(nom)}@personnel.example.com`, dateEmbauche: '2024-09-01', etablissementId: etab.id });
  }
  const personnel = await m.Personnel.findAll({ where: { etablissementId: etab.id } });
  for (const p of personnel) {
    if (!p.salaireBase) await p.update({ salaireBase: 400000, dateEmbauche: '2025-09-01' });
    for (const [periode, date] of [['Juillet 2026', '2026-07-31'], ['Août 2026', '2026-08-31']]) {
      const salaire = await m.Salaire.create({ personnelId: p.id, montant: p.salaireBase, periode, statut: 'verse', dateVersement: date, gereParFinanceId: finance.id });
      await salaire.update({ fichierPDF: `/fichiers/fiche_paie_${salaire.id}.pdf` });
      compter('salaires');
    }
  }

  // Analyse de risque de décrochage pour chaque étudiant.
  let alertes = 0;
  for (const { eleve } of eleves) {
    const risque = await calculerRisqueEleve(eleve.id);
    await m.PredictionIA.create({ eleveId: eleve.id, ...risque });
    if (risque.alerteGeneree) alertes += 1;
  }

  await publier(etab.id, 'eleves');
  console.log(`Établissement de démonstration créé : ${etab.nom} (${SIGLE}).`);
  console.log(`  ${classes.length} classes, ${matieres.length} matières, ${professeurs.length} professeurs, ${personnel.length} membres du personnel`);
  console.log(`  ${compteurs.etudiants} étudiants (${compteurs.parents} avec l'adresse d'un parent), ${compteurs.notes} notes, ${compteurs.absences || 0} absences, ${compteurs.incidents || 0} incidents`);
  console.log(`  ${compteurs.frais} frais, ${compteurs.paiements} paiements, ${compteurs.salaires} salaires, ${compteurs.cours} cours publiés, ${alertes} élève(s) en alerte de décrochage`);
  console.log(`Connexion : academie@${SIGLE.toLowerCase()}.example.com ou finance@${SIGLE.toLowerCase()}.example.com (mot de passe : DEMO_MOT_DE_PASSE, sinon celui défini en tête de ce script).`);
  console.log("Étudiants : leur matricule comme mot de passe ; parents : leur adresse e-mail et le matricule de l'enfant.");
  await m.sequelize.close();
}

main().catch(async (err) => {
  console.error('Échec du peuplement :', err);
  await m.sequelize.close();
  process.exit(1);
});
