import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import {
  IconDashboard, IconUsers, IconDocument, IconPencil, IconKey, IconMessage, IconSettings, IconCalendar, IconLayers, IconTrendingDown,
  IconClipboard,
} from '../components/icons';

// Chaque onglet dans son propre chunk, chargé au premier clic dessus plutôt
// que tout téléchargé d'un bloc à la connexion — un compte Académie qui ne
// touche jamais "Alertes décrochage" ou "Communication" pendant sa session
// n'en télécharge alors jamais le code.
const TableauDeBord = lazy(() => import('./academie/TableauDeBord'));
const ElevesClasses = lazy(() => import('./academie/ElevesClasses'));
const UnitesEnseignement = lazy(() => import('./academie/UnitesEnseignement'));
const EmploisDuTemps = lazy(() => import('./academie/EmploisDuTemps'));
const FeuillesAppel = lazy(() => import('./academie/FeuillesAppel'));
const Notes = lazy(() => import('./academie/Notes'));
const Bulletins = lazy(() => import('./academie/Bulletins'));
const ComptesEphemeres = lazy(() => import('./academie/ComptesEphemeres'));
const PredictionIA = lazy(() => import('./academie/PredictionIA'));
const Communication = lazy(() => import('./academie/Communication'));
const Parametres = lazy(() => import('./academie/Parametres'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard,
    description: "Vue d'ensemble de l'établissement : effectifs, absences et résultats." },
  { id: 'eleves', label: 'Élèves & classes', composant: ElevesClasses, icone: IconUsers, groupe: 'Scolarité',
    description: 'Classes, inscriptions et comptes des élèves et de leurs parents.' },
  { id: 'ue', label: "Unités d'enseignement", composant: UnitesEnseignement, icone: IconLayers, groupe: 'Scolarité',
    description: 'Unités d’enseignement et matières de chaque semestre.' },
  { id: 'emplois', label: 'Emplois du temps', composant: EmploisDuTemps, icone: IconCalendar, groupe: 'Scolarité', fonctionnalite: 'emplois-du-temps',
    description: 'Créneaux hebdomadaires de chaque classe, et export PDF.' },
  { id: 'appels', label: "Feuilles d'appel", composant: FeuillesAppel, icone: IconClipboard, groupe: 'Scolarité', fonctionnalite: 'acces-temporaires',
    description: 'Appels faits par les professeurs depuis leur accès temporaire : présents, absents et retards de chaque séance.' },
  { id: 'notes', label: 'Notes', composant: Notes, icone: IconPencil, groupe: 'Évaluation',
    description: 'Saisie des notes de contrôle continu et d’examen.' },
  { id: 'bulletins', label: 'Bulletins', composant: Bulletins, icone: IconDocument, groupe: 'Évaluation',
    description: 'Bulletins semestriels : consultation et envoi aux étudiants.' },
  { id: 'prediction', label: 'Alertes décrochage', composant: PredictionIA, icone: IconTrendingDown, groupe: 'Évaluation', fonctionnalite: 'prediction',
    description: 'Prédiction du risque d’échec par apprentissage automatique : notes de contrôle continu, assiduité, comportement et paiements.' },
  { id: 'comptes', label: 'Comptes éphémères', composant: ComptesEphemeres, icone: IconKey, groupe: 'Équipe & échanges', fonctionnalite: 'acces-temporaires',
    description: 'Liens d’accès temporaires envoyés aux professeurs pour saisir les notes et faire l’appel.' },
  { id: 'communication', label: 'Communication', composant: Communication, icone: IconMessage, groupe: 'Équipe & échanges', fonctionnalite: 'communication',
    description: 'Messages aux classes et cahier de textes.' },
  { id: 'parametres', label: 'Paramètres', composant: Parametres, icone: IconSettings, groupe: 'Établissement',
    description: 'Identité de l’établissement et comptes du personnel.' },
];

export default function DashboardAcademie() {
  const [onglet, setOnglet] = useState('tableau-de-bord');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;

  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant onNaviguer={setOnglet} />}
    </EspaceDashboard>
  );
}
