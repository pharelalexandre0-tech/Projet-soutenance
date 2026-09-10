import { useEffect, useState } from 'react';
import client from '../api/client';
import EspaceDashboard from '../components/EspaceDashboard';
import Bulletin from './parent/Bulletin';
import RelevesNotes from './parent/RelevesNotes';
import AbsencesParent from './parent/AbsencesParent';
import FraisParent from './parent/FraisParent';
import Messages from './parent/Messages';
import { IconDocument, IconPencil, IconCalendarAlert, IconBanknote, IconMessage } from '../components/icons';

const ONGLETS = [
  { id: 'bulletin', label: 'Bulletin', icone: IconDocument },
  { id: 'notes', label: 'Relevé de notes', icone: IconPencil },
  { id: 'absences', label: 'Absences', icone: IconCalendarAlert },
  { id: 'frais', label: 'Frais & reçus', icone: IconBanknote },
  { id: 'messages', label: 'Messages', icone: IconMessage },
];

export default function DashboardParent() {
  const [enfants, setEnfants] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('bulletin');

  useEffect(() => {
    client.get('/eleves').then((res) => {
      setEnfants(res.data.eleves);
      if (res.data.eleves.length > 0) setEleveId(String(res.data.eleves[0].id));
      setChargement(false);
    });
  }, []);

  const avantContenu = (
    <>
      {enfants.length > 1 && (
        <div className="champ" style={{ maxWidth: 280, marginBottom: 22 }}>
          <label>Enfant</label>
          <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
            {enfants.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
          </select>
        </div>
      )}
      {!chargement && !eleveId && <div className="vide">Aucun enfant rattaché à ce compte parent.</div>}
    </>
  );

  return (
    <EspaceDashboard
      onglets={ONGLETS}
      actif={onglet}
      onChange={setOnglet}
      avantContenu={avantContenu}
      bloquerContenu={!chargement && !eleveId}
    >
      {onglet === 'bulletin' && <Bulletin eleveId={eleveId} eleve={enfants.find((e) => String(e.id) === eleveId)} />}
      {onglet === 'notes' && <RelevesNotes eleveId={eleveId} eleve={enfants.find((e) => String(e.id) === eleveId)} />}
      {onglet === 'absences' && <AbsencesParent eleveId={eleveId} />}
      {onglet === 'frais' && <FraisParent eleveId={eleveId} />}
      {onglet === 'messages' && <Messages />}
    </EspaceDashboard>
  );
}
