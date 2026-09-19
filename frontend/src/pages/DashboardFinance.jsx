import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDashboard, IconBanknote, IconAlertTriangle, IconWallet } from '../components/icons';

const TableauDeBord = lazy(() => import('./finance/TableauDeBord'));
const DefinirFrais = lazy(() => import('./finance/DefinirFrais'));
const Impayes = lazy(() => import('./finance/Impayes'));
const Salaires = lazy(() => import('./finance/Salaires'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'frais', label: 'Frais de scolarité', composant: DefinirFrais, icone: IconBanknote },
  { id: 'impayes', label: 'Impayés', composant: Impayes, icone: IconAlertTriangle },
  { id: 'salaires', label: 'Paie du personnel', composant: Salaires, icone: IconWallet },
];

export default function DashboardFinance() {
  const [onglet, setOnglet] = useState('tableau-de-bord');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;

  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant onNaviguer={setOnglet} />}
    </EspaceDashboard>
  );
}
