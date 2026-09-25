import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDashboard, IconBuilding, IconKey, IconSettings } from '../components/icons';

const TableauDeBord = lazy(() => import('./superadmin/TableauDeBord'));
const Etablissements = lazy(() => import('./superadmin/Etablissements'));
const Superadmins = lazy(() => import('./superadmin/Superadmins'));
const MonProfil = lazy(() => import('./superadmin/MonProfil'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'etablissements', label: 'Établissements', composant: Etablissements, icone: IconBuilding },
  { id: 'superadmins', label: 'Superadmins', composant: Superadmins, icone: IconKey },
  { id: 'profil', label: 'Mon profil', composant: MonProfil, icone: IconSettings },
];

export default function DashboardSuperAdmin() {
  const [onglet, setOnglet] = useState('tableau-de-bord');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;

  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant />}
    </EspaceDashboard>
  );
}
