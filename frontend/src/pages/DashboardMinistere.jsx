import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import {
  IconDashboard, IconBuilding, IconGraduationCap, IconTrendingDown, IconMegaphone, IconShield, IconDocument,
} from '../components/icons';

const VueNationale = lazy(() => import('./ministere/VueNationale'));
const Etablissements = lazy(() => import('./ministere/Etablissements'));
const Resultats = lazy(() => import('./ministere/Resultats'));
const Alertes = lazy(() => import('./ministere/Alertes'));
const Circulaires = lazy(() => import('./ministere/Circulaires'));
const VerificationDocuments = lazy(() => import('./ministere/Documents').then((m) => ({ default: m.VerificationDocuments })));
const Rapports = lazy(() => import('./ministere/Documents').then((m) => ({ default: m.Rapports })));

// Espace du Ministère de l'Enseignement supérieur (tutelle) : uniquement des
// données agrégées par établissement, jamais un dossier d'étudiant.
const ONGLETS = [
  { id: 'national', label: 'Vue nationale', composant: VueNationale, icone: IconDashboard,
    description: 'Situation de l’enseignement supérieur : établissements, effectifs, réussite, risques et agréments.' },
  { id: 'etablissements', label: 'Établissements', composant: Etablissements, icone: IconBuilding, groupe: 'Tutelle',
    description: 'Registre des établissements sous tutelle, fiches, historique et décisions d’agrément.' },
  { id: 'circulaires', label: 'Circulaires', composant: Circulaires, icone: IconMegaphone, groupe: 'Tutelle',
    description: 'Instructions et informations aux établissements, avec suivi des lectures et accusés de réception.' },
  { id: 'resultats', label: 'Résultats & réussite', composant: Resultats, icone: IconGraduationCap, groupe: 'Pilotage',
    description: 'Classement des établissements par taux de réussite, moyenne, effectif et assiduité.' },
  { id: 'alertes', label: 'Alertes de décrochage', composant: Alertes, icone: IconTrendingDown, groupe: 'Pilotage',
    description: 'Étudiants à risque de décrochage par établissement, en nombre seulement.' },
  { id: 'documents', label: 'Vérifier un document', composant: VerificationDocuments, icone: IconShield, groupe: 'Contrôle',
    description: 'Authenticité des diplômes, relevés, attestations et procès-verbaux émis par les établissements.' },
  { id: 'rapports', label: 'Rapports', composant: Rapports, icone: IconDocument, groupe: 'Contrôle',
    description: 'Rapport national certifié (PDF) et données détaillées (Excel).' },
];

export default function DashboardMinistere() {
  const [onglet, setOnglet] = useState('national');
  const Composant = ONGLETS.find((o) => o.id === onglet)?.composant;
  return (
    <EspaceDashboard onglets={ONGLETS} actif={onglet} onChange={setOnglet}>
      {Composant && <Composant onNaviguer={setOnglet} />}
    </EspaceDashboard>
  );
}
