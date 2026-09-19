import { lazy, useEffect, useState } from 'react';
import client from '../api/client';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDocument, IconPencil, IconCalendarAlert, IconBanknote, IconMessage, IconDashboard } from '../components/icons';

const Bulletin = lazy(() => import('./etudiant/Bulletin'));
const RelevesNotes = lazy(() => import('./etudiant/RelevesNotes'));
const AbsencesEtudiant = lazy(() => import('./etudiant/AbsencesEtudiant'));
const FraisEtudiant = lazy(() => import('./etudiant/FraisEtudiant'));
const Messages = lazy(() => import('./etudiant/Messages'));
const EmploiDuTemps = lazy(() => import('./etudiant/EmploiDuTemps'));

const ONGLETS = [
  { id: 'bulletin', label: 'Bulletin', icone: IconDocument },
  { id: 'notes', label: 'Relevé de notes', icone: IconPencil },
  { id: 'absences', label: 'Absences', icone: IconCalendarAlert },
  { id: 'emploi', label: 'Emploi du temps', icone: IconDashboard },
  { id: 'frais', label: 'Frais & reçus', icone: IconBanknote },
  { id: 'messages', label: 'Messages', icone: IconMessage },
];

// Plateforme universitaire : l'étudiant consulte directement son propre
// dossier — pas de sélecteur "enfant", son compte n'a qu'une seule fiche.
export default function DashboardEtudiant() {
  const [monDossier, setMonDossier] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('bulletin');

  useEffect(() => {
    client.get('/eleves').then((res) => {
      setMonDossier(res.data.eleves[0] || null);
      setChargement(false);
    });
  }, []);

  const eleveId = monDossier ? String(monDossier.id) : '';

  return (
    <EspaceDashboard
      onglets={ONGLETS}
      actif={onglet}
      onChange={setOnglet}
      avantContenu={!chargement && !monDossier && <div className="vide">Aucun dossier étudiant rattaché à ce compte.</div>}
      bloquerContenu={!chargement && !monDossier}
    >
      {onglet === 'bulletin' && <Bulletin eleveId={eleveId} eleve={monDossier} />}
      {onglet === 'notes' && <RelevesNotes eleveId={eleveId} eleve={monDossier} />}
      {onglet === 'absences' && <AbsencesEtudiant eleveId={eleveId} />}
      {onglet === 'emploi' && <EmploiDuTemps classeId={monDossier?.classeId} />}
      {onglet === 'frais' && <FraisEtudiant eleveId={eleveId} />}
      {onglet === 'messages' && <Messages />}
    </EspaceDashboard>
  );
}
