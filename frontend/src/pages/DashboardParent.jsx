import { lazy, useEffect, useState } from 'react';
import client from '../api/client';
import EspaceDashboard from '../components/EspaceDashboard';
import { IconDocument, IconPencil, IconCalendarAlert, IconBanknote, IconMessage, IconCalendar } from '../components/icons';

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
  { id: 'emploi', label: 'Emploi du temps', icone: IconCalendar, fonctionnalite: 'emplois-du-temps' },
  { id: 'frais', label: 'Frais & reçus', icone: IconBanknote, fonctionnalite: 'frais-en-ligne' },
  { id: 'messages', label: 'Messages', icone: IconMessage, fonctionnalite: 'communication' },
];

// Espace Parents : consultation en temps réel des notes, absences, emploi
// du temps et bulletins d'un ou plusieurs enfants (contrairement à
// l'Étudiant, qui n'a jamais qu'un seul dossier — le sien). Les pages
// consultées sont exactement les mêmes composants que l'Espace Étudiant,
// juste alimentées par l'enfant sélectionné plutôt que "son propre" dossier.
export default function DashboardParent() {
  const [enfants, setEnfants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [eleveId, setEleveId] = useState('');
  const [onglet, setOnglet] = useState('bulletin');

  useEffect(() => {
    client.get('/eleves').then((res) => {
      setEnfants(res.data.eleves);
      if (res.data.eleves[0]) setEleveId(String(res.data.eleves[0].id));
      setChargement(false);
    });
  }, []);

  const enfant = enfants.find((e) => String(e.id) === eleveId) || null;

  return (
    <EspaceDashboard
      onglets={ONGLETS}
      actif={onglet}
      onChange={setOnglet}
      avantContenu={!chargement && enfants.length === 0 && <div className="vide">Aucun enfant rattaché à ce compte.</div>}
      bloquerContenu={!chargement && enfants.length === 0}
    >
      {enfants.length > 1 && (
        <div className="champ" style={{ maxWidth: 280, marginBottom: 18 }}>
          <label>Enfant</label>
          <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
            {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.Classe?.nom})</option>)}
          </select>
        </div>
      )}
      {onglet === 'bulletin' && <Bulletin eleveId={eleveId} eleve={enfant} />}
      {onglet === 'notes' && <RelevesNotes eleveId={eleveId} eleve={enfant} />}
      {onglet === 'absences' && <AbsencesEtudiant eleveId={eleveId} />}
      {onglet === 'emploi' && <EmploiDuTemps classeId={enfant?.classeId} />}
      {onglet === 'frais' && <FraisEtudiant eleveId={eleveId} />}
      {onglet === 'messages' && <Messages />}
    </EspaceDashboard>
  );
}
