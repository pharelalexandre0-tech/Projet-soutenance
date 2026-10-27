import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import {
  IconDashboard, IconBuilding, IconShield, IconUserCog, IconToggle, IconRocket, IconMegaphone, IconHistory, IconDocument, IconFingerprint,
} from '../components/icons';

const TableauDeBord = lazy(() => import('./superadmin/TableauDeBord'));
const Etablissements = lazy(() => import('./superadmin/Etablissements'));
const Fonctionnalites = lazy(() => import('./superadmin/Fonctionnalites'));
const MisesAJour = lazy(() => import('./superadmin/MisesAJour'));
const AnnoncesMaintenance = lazy(() => import('./superadmin/AnnoncesMaintenance'));
const Journal = lazy(() => import('./superadmin/Journal'));
const AuditSecurite = lazy(() => import('./superadmin/AuditSecurite'));
const ComptesMinistere = lazy(() => import('./superadmin/ComptesMinistere'));
const Superadmins = lazy(() => import('./superadmin/Superadmins'));
const MonProfil = lazy(() => import('./superadmin/MonProfil'));
const PolitiqueConfidentialite = lazy(() => import('./superadmin/PolitiqueConfidentialite'));

const ONGLETS = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', composant: TableauDeBord, icone: IconDashboard,
    description: 'État de la plateforme et chiffres cumulés de toutes les écoles affiliées.' },
  { id: 'etablissements', label: 'Établissements', composant: Etablissements, icone: IconBuilding, groupe: 'Écoles',
    description: 'Écoles affiliées, leurs fonctionnalités et leurs accès.' },
  { id: 'fonctionnalites', label: 'Fonctionnalités', composant: Fonctionnalites, icone: IconToggle, groupe: 'Écoles',
    description: 'Catalogue des fonctionnalités et attribution école par école.' },
  { id: 'mises-a-jour', label: 'Mises à jour', composant: MisesAJour, icone: IconRocket, groupe: 'Plateforme',
    description: 'Version en production et notes de version présentées aux écoles.' },
  { id: 'annonces', label: 'Annonces & maintenance', composant: AnnoncesMaintenance, icone: IconMegaphone, groupe: 'Plateforme',
    description: 'Bandeau d’information dans tous les espaces et mise en maintenance de la plateforme.' },
  { id: 'confidentialite', label: 'Confidentialité', composant: PolitiqueConfidentialite, icone: IconDocument, groupe: 'Plateforme',
    description: 'Politique de confidentialité publiée pour les écoles, les élèves et les familles.' },
  { id: 'journal', label: "Journal d'activité", composant: Journal, icone: IconHistory, groupe: 'Plateforme',
    description: 'Historique des actions effectuées par les superadmins.' },
  { id: 'audit', label: 'Audit de sécurité', composant: AuditSecurite, icone: IconFingerprint, groupe: 'Plateforme',
    description: 'Journal scellé de toutes les connexions et modifications de la plateforme, avec contrôle d’intégrité.' },
  { id: 'superadmins', label: 'Superadmins', composant: Superadmins, icone: IconShield, groupe: 'Administration',
    description: 'Comptes ayant accès à l’administration de la plateforme.' },
  { id: 'ministere', label: 'Comptes Ministère', composant: ComptesMinistere, icone: IconBuilding, groupe: 'Administration',
    description: 'Agents du Ministère de l’Enseignement supérieur : accès à la vue nationale, aux agréments et aux circulaires.' },
  { id: 'profil', label: 'Mon profil', composant: MonProfil, icone: IconUserCog, groupe: 'Administration',
    description: 'Tes informations et ton mot de passe.' },
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
