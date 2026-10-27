import { lazy, useState } from 'react';
import EspaceDashboard from '../components/EspaceDashboard';
import {
  IconDashboard, IconBuilding, IconGraduationCap, IconTrendingDown, IconMegaphone, IconShield, IconDocument, IconCalendar, IconTrophy, IconLayers, IconClipboard,
} from '../components/icons';

const VueNationale = lazy(() => import('./ministere/VueNationale'));
const Etablissements = lazy(() => import('./ministere/Etablissements'));
const Resultats = lazy(() => import('./ministere/Resultats'));
const Alertes = lazy(() => import('./ministere/Alertes'));
const Circulaires = lazy(() => import('./ministere/Circulaires'));
const Habilitations = lazy(() => import('./ministere/Habilitations'));
const Inspections = lazy(() => import('./ministere/Inspections'));
const Calendrier = lazy(() => import('./ministere/Calendrier'));
const Annuaire = lazy(() => import('./ministere/Annuaire'));
const VerificationDocuments = lazy(() => import('./ministere/Documents').then((m) => ({ default: m.VerificationDocuments })));
const Rapports = lazy(() => import('./ministere/Documents').then((m) => ({ default: m.Rapports })));

// Espace du Ministère de l'Enseignement supérieur (tutelle) : uniquement des
// données agrégées par établissement, jamais un dossier d'étudiant.
const ONGLETS = [
  { id: 'national', label: 'Vue nationale', composant: VueNationale, icone: IconDashboard,
    description: 'Situation de l’enseignement supérieur : établissements, effectifs, réussite, risques et agréments.' },
  { id: 'etablissements', label: 'Registre national', composant: Etablissements, icone: IconBuilding, groupe: 'Tutelle',
    description: 'Registre des établissements sous tutelle : agréments, formations habilitées, inspections et correspondance.' },
  { id: 'habilitations', label: 'Habilitations', composant: Habilitations, icone: IconGraduationCap, groupe: 'Tutelle',
    description: 'Habilitation des offres de formation (licence, master, doctorat) par arrêté, renouvellement et retrait.' },
  { id: 'calendrier', label: 'Calendrier national', composant: Calendrier, icone: IconCalendar, groupe: 'Tutelle',
    description: 'Calendrier universitaire national publié à tous les établissements, avec suivi des accusés de réception.' },
  { id: 'circulaires', label: 'Circulaires', composant: Circulaires, icone: IconMegaphone, groupe: 'Tutelle',
    description: 'Instructions et informations aux établissements, avec suivi des lectures et accusés de réception.' },
  { id: 'resultats', label: 'Classement', composant: Resultats, icone: IconTrophy, groupe: 'Pilotage',
    description: 'Classement national des établissements par réussite, moyenne, effectif ou assiduité, téléchargeable.' },
  { id: 'annuaire', label: 'Annuaire statistique', composant: Annuaire, icone: IconLayers, groupe: 'Pilotage',
    description: 'Effectifs par établissement, province, niveau et sexe, encadrement et offre de formation : PDF certifié et Excel.' },
  { id: 'alertes', label: 'Alertes de décrochage', composant: Alertes, icone: IconTrendingDown, groupe: 'Pilotage',
    description: 'Étudiants à risque de décrochage par établissement, en nombre seulement.' },
  { id: 'inspections', label: 'Inspections', composant: Inspections, icone: IconClipboard, groupe: 'Contrôle',
    description: 'Missions d’inspection : programmation, rapport, avis, recommandations et suivi de leur mise en œuvre.' },
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
