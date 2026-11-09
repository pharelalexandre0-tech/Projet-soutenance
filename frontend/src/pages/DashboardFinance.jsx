import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDashboard, IconReceipt, IconCircleAlert, IconWallet, IconSmartphone } from '../components/icons';

const TableauDeBord = lazy(() => import('./finance/TableauDeBord'));
const DefinirFrais = lazy(() => import('./finance/DefinirFrais'));
const Impayes = lazy(() => import('./finance/Impayes'));
const Salaires = lazy(() => import('./finance/Salaires'));
const PaiementsEnLigne = lazy(() => import('./finance/PaiementsEnLigne'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard,
    description: 'Situation financière de l’établissement : encaissements et impayés.' },
  { id: 'frais', label: 'Frais de scolarité', composant: DefinirFrais, icone: IconReceipt, groupe: 'Scolarité',
    description: 'Frais par classe, niveau ou établissement, et enregistrement des paiements.' },
  { id: 'paiements-en-ligne', label: 'Paiements mobile money', composant: PaiementsEnLigne, icone: IconSmartphone, groupe: 'Scolarité', fonctionnalite: 'paiement-en-ligne',
    description: 'Paiements Airtel Money et Moov Money faits par les étudiants et les parents, déjà encaissés avec leur reçu.' },
  { id: 'impayes', label: 'Impayés', composant: Impayes, icone: IconCircleAlert, groupe: 'Scolarité',
    description: 'Soldes restant dus, classe par classe, et relances des familles.' },
  { id: 'salaires', label: 'Paie du personnel', composant: Salaires, icone: IconWallet, groupe: 'Personnel', fonctionnalite: 'paie',
    description: 'Fiches du personnel et versement des salaires.' },
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
