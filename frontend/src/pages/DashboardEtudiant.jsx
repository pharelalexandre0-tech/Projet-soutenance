import { lazy, useEffect, useState } from 'react';
import client from '../api/client';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDocument, IconClipboard, IconCalendarAlert, IconReceipt, IconMessage, IconCalendar } from '../components/icons';

const Bulletin = lazy(() => import('./etudiant/Bulletin'));
const RelevesNotes = lazy(() => import('./etudiant/RelevesNotes'));
const AbsencesEtudiant = lazy(() => import('./etudiant/AbsencesEtudiant'));
const FraisEtudiant = lazy(() => import('./etudiant/FraisEtudiant'));
const Messages = lazy(() => import('./etudiant/Messages'));
const EmploiDuTemps = lazy(() => import('./etudiant/EmploiDuTemps'));

const ONGLETS = [
  { id: 'bulletin', label: 'Bulletin', icone: IconDocument, groupe: 'Mon dossier',
    description: 'Ton bulletin officiel du semestre.' },
  { id: 'notes', label: 'Relevé de notes', icone: IconClipboard, groupe: 'Mon dossier',
    description: 'Tes notes détaillées, matière par matière.' },
  { id: 'absences', label: 'Absences', icone: IconCalendarAlert, groupe: 'Mon dossier',
    description: 'Tes absences, et l’envoi de justificatifs.' },
  { id: 'emploi', label: 'Emploi du temps', icone: IconCalendar, groupe: 'Vie scolaire', fonctionnalite: 'emplois-du-temps',
    description: 'Les cours de la semaine.' },
  { id: 'frais', label: 'Frais & reçus', icone: IconReceipt, groupe: 'Vie scolaire', fonctionnalite: 'frais-en-ligne',
    description: 'Frais de scolarité, paiements effectués et reçus.' },
  { id: 'messages', label: 'Messages', icone: IconMessage, groupe: 'Vie scolaire', fonctionnalite: 'communication',
    description: 'Messages de l’administration de l’établissement.' },
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
