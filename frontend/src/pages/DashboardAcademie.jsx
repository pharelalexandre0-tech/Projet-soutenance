import { useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import TableauDeBord from './academie/TableauDeBord';
import ElevesClasses from './academie/ElevesClasses';
import UnitesEnseignement from './academie/UnitesEnseignement';
import EmploisDuTemps from './academie/EmploisDuTemps';
import Notes from './academie/Notes';
import Bulletins from './academie/Bulletins';
import ComptesEphemeres from './academie/ComptesEphemeres';
import Absences from './academie/Absences';
import PredictionIA from './academie/PredictionIA';
import Communication from './academie/Communication';
import Parametres from './academie/Parametres';
import { IconDashboard, IconUsers, IconDocument, IconPencil, IconKey, IconCalendarAlert, IconBrain, IconMessage, IconSettings } from '../components/icons';

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'eleves', label: 'Élèves & classes', composant: ElevesClasses, icone: IconUsers },
  { id: 'ue', label: "Unités d'enseignement", composant: UnitesEnseignement, icone: IconDocument },
  { id: 'emplois', label: 'Emplois du temps', composant: EmploisDuTemps, icone: IconDashboard },
  { id: 'notes', label: 'Notes', composant: Notes, icone: IconPencil },
  { id: 'bulletins', label: 'Bulletins', composant: Bulletins, icone: IconDocument },
  { id: 'comptes', label: 'Comptes éphémères (Professeurs)', composant: ComptesEphemeres, icone: IconKey },
  { id: 'absences', label: 'Absences', composant: Absences, icone: IconCalendarAlert },
  { id: 'communication', label: 'Communication', composant: Communication, icone: IconMessage },
  { id: 'prediction', label: 'Prédiction IA', composant: PredictionIA, icone: IconBrain },
  { id: 'parametres', label: 'Paramètres', composant: Parametres, icone: IconSettings },
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
