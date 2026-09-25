// Catalogue des modules optionnels de la plateforme. Le code d'un module est
// livré par un déploiement (git push -> Render) ; son OUVERTURE aux écoles,
// elle, se pilote ensuite depuis l'espace Superadmin : pour toutes les
// écoles, pour quelques écoles pilotes seulement (déploiement progressif),
// ou pour aucune. Une nouvelle fonctionnalité s'ajoute ici avec
// `porteeParDefaut: 'aucune'` pour arriver en production sans être visible,
// puis s'ouvre école par école une fois validée.
//
// Le socle (élèves, classes, UE, notes, bulletins, frais côté Finance)
// n'apparaît volontairement pas ici : sans lui, une école ne fonctionne pas.
const CATALOGUE_FONCTIONNALITES = [
  {
    cle: 'prediction',
    nom: 'Alertes décrochage (IA)',
    description: "Analyse automatique du risque de décrochage de chaque élève à partir de ses notes, de ses absences et des incidents signalés.",
    espaces: ['academie'],
    porteeParDefaut: 'toutes',
  },
  {
    cle: 'acces-temporaires',
    nom: 'Accès temporaires des professeurs',
    description: "Liens à durée limitée envoyés par e-mail aux professeurs pour saisir des notes ou faire l'appel, sans compte permanent.",
    espaces: ['academie', 'professeur'],
    porteeParDefaut: 'toutes',
  },
  {
    cle: 'emplois-du-temps',
    nom: 'Emplois du temps',
    description: 'Construction des emplois du temps par classe, export PDF, et consultation par les étudiants et leurs parents.',
    espaces: ['academie', 'etudiant', 'parent'],
    porteeParDefaut: 'toutes',
  },
  {
    cle: 'communication',
    nom: 'Communication',
    description: "Messages de l'Académie adressés aux classes, lus depuis l'espace Étudiant et l'espace Parents.",
    espaces: ['academie', 'etudiant', 'parent'],
    porteeParDefaut: 'toutes',
  },
  {
    cle: 'paie',
    nom: 'Paie du personnel',
    description: 'Fiches du personnel, versement des salaires et fiches de paie, depuis l\'espace Finance.',
    espaces: ['finance'],
    porteeParDefaut: 'toutes',
  },
  {
    cle: 'frais-en-ligne',
    nom: 'Frais et reçus en ligne',
    description: 'Consultation des frais de scolarité, des paiements et des reçus par les étudiants et les parents.',
    espaces: ['etudiant', 'parent'],
    porteeParDefaut: 'toutes',
  },
];

const PORTEES = ['toutes', 'selection', 'aucune'];

module.exports = { CATALOGUE_FONCTIONNALITES, PORTEES };
