import { useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import TableauDeBord from './finance/TableauDeBord';
import DefinirFrais from './finance/DefinirFrais';
import Paiements from './finance/Paiements';
import Impayes from './finance/Impayes';
import Salaires from './finance/Salaires';
import { IconDashboard, IconBanknote, IconCard, IconAlertTriangle, IconWallet } from '../components/icons';

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard },
  { id: 'frais', label: 'Frais de scolarité', composant: DefinirFrais, icone: IconBanknote },
  { id: 'paiements', label: 'Paiements', composant: Paiements, icone: IconCard },
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
