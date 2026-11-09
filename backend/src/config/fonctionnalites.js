// Catalogue des fonctionnalités de la plateforme. Chaque école ne reçoit que
// celles que le superadmin lui ajoute, selon ses besoins (voir
// ActivationFonctionnalite) : rien n'est imposé à toutes les écoles d'un coup.
//
// Deux familles :
// - les modules intégrés ci-dessous, dont le code fait partie d'EduSphere
//   (un nouveau module de ce type arrive par un déploiement, puis s'ajoute
//   école par école) ;
// - les fonctionnalités personnalisées, créées directement depuis l'espace
//   Superadmin sans écrire de code (FonctionnalitePersonnalisee), à la
//   demande d'une école : page d'information, service en ligne, assistant
//   qui répond aux questions, formulaire de demande, registre tenu par
//   l'Académie. Chacune devient un nouvel onglet dans les espaces choisis.
//
// Le socle (élèves, classes, UE, notes, bulletins, frais côté Finance)
// n'apparaît volontairement pas ici : sans lui, une école ne fonctionne pas.
const MODULES_INTEGRES = [
  {
    cle: 'prediction',
    nom: 'Alertes décrochage (IA)',
    description: "Analyse automatique du risque de décrochage de chaque élève à partir de ses notes, de ses absences et des incidents signalés.",
    espaces: ['academie'],
    icone: 'TrendingDown',
  },
  {
    cle: 'acces-temporaires',
    nom: 'Accès temporaires des professeurs',
    description: "Liens à durée limitée envoyés par e-mail aux professeurs pour saisir des notes ou faire l'appel, sans compte permanent.",
    espaces: ['academie', 'professeur'],
    icone: 'KeyRound',
  },
  {
    cle: 'emplois-du-temps',
    nom: 'Emplois du temps',
    description: 'Construction des emplois du temps par classe, export PDF, et consultation par les étudiants et leurs parents.',
    espaces: ['academie', 'etudiant'],
    icone: 'CalendarDays',
  },
  {
    cle: 'communication',
    nom: 'Communication',
    description: "Messages de l'Académie adressés aux classes, lus depuis l'espace Étudiant (que le parent ouvre avec son adresse).",
    espaces: ['academie', 'etudiant'],
    icone: 'MessagesSquare',
  },
  {
    cle: 'paie',
    nom: 'Paie du personnel',
    description: "Fiches du personnel, versement des salaires et fiches de paie, depuis l'espace Finance.",
    espaces: ['finance'],
    icone: 'Wallet',
  },
  {
    cle: 'preinscription',
    nom: 'Préinscription en ligne',
    description: 'Les candidats déposent leur dossier en ligne avec leurs pièces ; l’Académie l’examine, répond par e-mail et inscrit les candidats acceptés.',
    espaces: ['academie'],
    icone: 'ClipboardList',
  },
  {
    cle: 'anonymat',
    nom: 'Anonymat des copies',
    description: 'Numéros d’anonymat par examen, saisie des notes d’examen par numéro, puis levée de l’anonymat.',
    espaces: ['academie'],
    icone: 'FileText',
  },
  {
    cle: 'soutenances',
    nom: 'Mémoires, soutenances et thèses',
    description: 'Sujets, encadrement, programmation des soutenances, jury, note et procès-verbal certifié.',
    espaces: ['academie', 'etudiant'],
    icone: 'BookOpen',
  },
  {
    cle: 'diplomes',
    nom: 'Diplômes et supplément au diplôme',
    description: 'Délivrance des diplômes de licence, master et doctorat aux étudiants qui ont réuni leurs crédits, avec le supplément au diplôme, certifiés.',
    espaces: ['academie', 'etudiant'],
    icone: 'GraduationCap',
  },
  {
    cle: 'mobilite',
    nom: 'Mobilité et transferts de crédits',
    description: 'Crédits obtenus dans un autre établissement, reconnus et comptés dans le parcours LMD de l’étudiant.',
    espaces: ['academie'],
    icone: 'Globe',
  },
  {
    cle: 'paiement-en-ligne',
    nom: 'Paiement mobile money',
    description: 'Les étudiants et les parents paient leurs frais par Airtel Money ou Moov Money depuis l’application ; le reçu certifié est émis automatiquement.',
    espaces: ['etudiant', 'finance'],
    icone: 'Smartphone',
  },
  {
    cle: 'frais-en-ligne',
    nom: 'Frais et reçus en ligne',
    description: 'Consultation des frais de scolarité, des paiements et des reçus par les étudiants et les parents.',
    espaces: ['etudiant'],
    icone: 'Receipt',
  },
];

// Espaces qui peuvent recevoir une fonctionnalité personnalisée (le
// professeur n'a pas d'espace permanent, seulement des liens temporaires ;
// le parent ouvre l'espace Étudiant de son enfant).
const ESPACES_PERSONNALISABLES = ['academie', 'finance', 'etudiant'];

// Icônes proposées à la création d'une fonctionnalité personnalisée (noms
// d'icônes Lucide, rendues côté frontend).
const ICONES_PERSONNALISABLES = [
  'FileText', 'BookOpen', 'Library', 'GraduationCap', 'Calendar', 'ClipboardList',
  'Newspaper', 'Megaphone', 'Video', 'Globe', 'Link2', 'LifeBuoy',
  'Briefcase', 'Award', 'Bus', 'Utensils', 'HandCoins', 'Info',
  'Bot', 'MessageCircleQuestion', 'Inbox', 'Table2', 'ListChecks', 'Trophy', 'HeartPulse',
];

module.exports = { MODULES_INTEGRES, ESPACES_PERSONNALISABLES, ICONES_PERSONNALISABLES };
