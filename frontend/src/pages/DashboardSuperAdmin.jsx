import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconBuilding, IconKey, IconSettings } from '../components/icons';

const Etablissements = lazy(() => import('./superadmin/Etablissements'));
const Superadmins = lazy(() => import('./superadmin/Superadmins'));
const MonProfil = lazy(() => import('./superadmin/MonProfil'));

const ONGLETS = [
  { id: 'etablissements', label: 'Établissements', composant: Etablissements, icone: IconBuilding },
  { id: 'superadmins', label: 'Superadmins', composant: Superadmins, icone: IconKey },
  { id: 'profil', label: 'Mon profil', composant: MonProfil, icone: IconSettings },
];

export default function DashboardSuperAdmin() {
  const [onglet, setOnglet] = useState('etablissements');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;

  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant />}
    </EspaceDashboard>
  );
}
