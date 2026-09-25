import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import {
  IconDashboard, IconBuilding, IconKey, IconSettings, IconToggle, IconRocket, IconMegaphone, IconHistory,
} from '../components/icons';

const TableauDeBord = lazy(() => import('./superadmin/TableauDeBord'));
const Etablissements = lazy(() => import('./superadmin/Etablissements'));
const Fonctionnalites = lazy(() => import('./superadmin/Fonctionnalites'));
const MisesAJour = lazy(() => import('./superadmin/MisesAJour'));
const AnnoncesMaintenance = lazy(() => import('./superadmin/AnnoncesMaintenance'));
const Journal = lazy(() => import('./superadmin/Journal'));
const Superadmins = lazy(() => import('./superadmin/Superadmins'));
const MonProfil = lazy(() => import('./superadmin/MonProfil'));

// Trois blocs : le pouls de la plateforme, le pilotage (écoles, modules,
// versions, diffusion), puis la traçabilité et les comptes superadmin.
const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'etablissements', label: 'Établissements', composant: Etablissements, icone: IconBuilding, separateurAvant: true },
  { id: 'fonctionnalites', label: 'Fonctionnalités', composant: Fonctionnalites, icone: IconToggle },
  { id: 'mises-a-jour', label: 'Mises à jour', composant: MisesAJour, icone: IconRocket },
  { id: 'annonces', label: 'Annonces & maintenance', composant: AnnoncesMaintenance, icone: IconMegaphone },
  { id: 'journal', label: "Journal d'activité", composant: Journal, icone: IconHistory, separateurAvant: true },
  { id: 'superadmins', label: 'Superadmins', composant: Superadmins, icone: IconKey },
  { id: 'profil', label: 'Mon profil', composant: MonProfil, icone: IconSettings },
];

export default function DashboardSuperAdmin() {
  const [onglet, setOnglet] = useState('tableau-de-bord');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;

  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant onNaviguer={setOnglet} />}
    </EspaceDashboard>
  );
}
