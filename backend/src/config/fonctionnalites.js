// Catalogue des fonctionnalités de la plateforme. Chaque école ne reçoit que
// celles que le superadmin lui ajoute, selon ses besoins (voir
// ActivationFonctionnalite) : rien n'est imposé à toutes les écoles d'un coup.
//
// Deux familles :
// - les modules intégrés ci-dessous, dont le code fait partie d'EduSphere
//   (un nouveau module de ce type arrive par un déploiement, puis s'ajoute
//   école par école) ;
// - les fonctionnalités personnalisées, créées directement depuis l'espace
//   Superadmin sans écrire de code (FonctionnalitePersonnalisee) : une page
//   d'information ou l'accès à un service en ligne, ajoutée comme un nouvel
//   onglet dans les espaces choisis.
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
];

module.exports = { MODULES_INTEGRES, ESPACES_PERSONNALISABLES, ICONES_PERSONNALISABLES };
