import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDashboard, IconUsers, IconDocument, IconPencil, IconKey, IconAlertTriangle, IconMessage, IconSettings } from '../components/icons';

// Chaque onglet dans son propre chunk, chargé au premier clic dessus plutôt
// que tout téléchargé d'un bloc à la connexion — un compte Académie qui ne
// touche jamais "Alertes décrochage" ou "Communication" pendant sa session
// n'en télécharge alors jamais le code.
const TableauDeBord = lazy(() => import('./academie/TableauDeBord'));
const ElevesClasses = lazy(() => import('./academie/ElevesClasses'));
const UnitesEnseignement = lazy(() => import('./academie/UnitesEnseignement'));
const EmploisDuTemps = lazy(() => import('./academie/EmploisDuTemps'));
const Notes = lazy(() => import('./academie/Notes'));
const Bulletins = lazy(() => import('./academie/Bulletins'));
const ComptesEphemeres = lazy(() => import('./academie/ComptesEphemeres'));
const PredictionIA = lazy(() => import('./academie/PredictionIA'));
const Communication = lazy(() => import('./academie/Communication'));
const Parametres = lazy(() => import('./academie/Parametres'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'eleves', label: 'Élèves & classes', composant: ElevesClasses, icone: IconUsers, separateurAvant: true },
  { id: 'ue', label: "Unités d'enseignement", composant: UnitesEnseignement, icone: IconDocument },
  { id: 'emplois', label: 'Emplois du temps', composant: EmploisDuTemps, icone: IconDashboard },
  { id: 'notes', label: 'Notes', composant: Notes, icone: IconPencil },
  { id: 'bulletins', label: 'Bulletins', composant: Bulletins, icone: IconDocument },
  { id: 'prediction', label: 'Alertes décrochage', composant: PredictionIA, icone: IconAlertTriangle },
  { id: 'comptes', label: 'Comptes éphémères (Professeurs)', composant: ComptesEphemeres, icone: IconKey, separateurAvant: true },
  { id: 'communication', label: 'Communication', composant: Communication, icone: IconMessage, separateurAvant: true },
  { id: 'parametres', label: 'Paramètres', composant: Parametres, icone: IconSettings, separateurAvant: true },
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
