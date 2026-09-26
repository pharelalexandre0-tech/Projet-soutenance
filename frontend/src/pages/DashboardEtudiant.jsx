import { lazy, useEffect, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import { useAuth } from '../context/AuthContext';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDocument, IconClipboard, IconCalendarAlert, IconReceipt, IconMessage, IconCalendar, IconFlag } from '../components/icons';

const Bulletin = lazy(() => import('./etudiant/Bulletin'));
const RelevesNotes = lazy(() => import('./etudiant/RelevesNotes'));
const AbsencesEtudiant = lazy(() => import('./etudiant/AbsencesEtudiant'));
const Comportement = lazy(() => import('./etudiant/ComportementEleve'));
const FraisEtudiant = lazy(() => import('./etudiant/FraisEtudiant'));
const Messages = lazy(() => import('./etudiant/Messages'));
const EmploiDuTemps = lazy(() => import('./etudiant/EmploiDuTemps'));

function onglets(parent) {
  const dossier = parent ? 'Dossier de l’enfant' : 'Mon dossier';
  return [
    { id: 'bulletin', label: 'Bulletin', icone: IconDocument, groupe: dossier,
      description: parent ? 'Bulletin officiel du semestre de votre enfant.' : 'Ton bulletin officiel du semestre.' },
    { id: 'notes', label: 'Relevé de notes', icone: IconClipboard, groupe: dossier,
      description: parent ? 'Notes détaillées de votre enfant, matière par matière.' : 'Tes notes détaillées, matière par matière.' },
    { id: 'absences', label: 'Absences', icone: IconCalendarAlert, groupe: dossier,
      description: parent ? 'Absences et retards enregistrés, et l’envoi de justificatifs.' : 'Tes absences, et l’envoi de justificatifs.' },
    { id: 'comportement', label: 'Comportement', icone: IconFlag, groupe: dossier,
      description: 'Incidents de comportement signalés par l’établissement.' },
    { id: 'emploi', label: 'Emploi du temps', icone: IconCalendar, groupe: 'Vie scolaire', fonctionnalite: 'emplois-du-temps',
      description: 'Les cours de la semaine.' },
    { id: 'frais', label: 'Frais & reçus', icone: IconReceipt, groupe: 'Vie scolaire', fonctionnalite: 'frais-en-ligne',
      description: 'Frais de scolarité, paiements effectués et reçus.' },
    { id: 'messages', label: 'Messages', icone: IconMessage, groupe: 'Vie scolaire', fonctionnalite: 'communication',
      description: 'Messages de l’administration de l’établissement.' },
  ];
}
const ONGLETS_ETUDIANT = onglets(false);
const ONGLETS_PARENT = onglets(true);

// Un seul compte par élève : l'étudiant y consulte son propre dossier, et
// son parent l'ouvre avec sa propre adresse e-mail et le même mot de passe
// (le matricule). Même contenu, seul le ton change (Espace Parents).
export default function DashboardEtudiant() {
  const { profil } = useAuth();
  const [monDossier, setMonDossier] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('bulletin');

  useEffect(() => {
    client.get('/eleves').then((res) => {
      setMonDossier(res.data.eleves[0] || null);
      setChargement(false);
    });
  }, []);

  // Changement de classe ou de dossier fait par l'établissement.
  useActualisation(() => client.get('/eleves').then((res) => setMonDossier(res.data.eleves[0] || null)), { domaines: ['eleves', 'classes'] });

  const eleveId = monDossier ? String(monDossier.id) : '';

  return (
    <EspaceDashboard
      onglets={profil?.modeParent ? ONGLETS_PARENT : ONGLETS_ETUDIANT}
      actif={onglet}
      onChange={setOnglet}
      avantContenu={!chargement && !monDossier && <div className="vide">Aucun dossier étudiant rattaché à ce compte.</div>}
      bloquerContenu={!chargement && !monDossier}
    >
      {onglet === 'bulletin' && <Bulletin eleveId={eleveId} eleve={monDossier} />}
      {onglet === 'notes' && <RelevesNotes eleveId={eleveId} eleve={monDossier} />}
      {onglet === 'absences' && <AbsencesEtudiant eleveId={eleveId} />}
      {onglet === 'comportement' && <Comportement eleveId={eleveId} />}
      {onglet === 'emploi' && <EmploiDuTemps classeId={monDossier?.classeId} />}
      {onglet === 'frais' && <FraisEtudiant eleveId={eleveId} />}
      {onglet === 'messages' && <Messages />}
    </EspaceDashboard>
  );
}
