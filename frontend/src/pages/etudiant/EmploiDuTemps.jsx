import { useEffect, useState } from 'react';
import client from '../../api/client';
import { JOURS } from '../../utils/jours';

export default function EmploiDuTemps({ classeId }) {
  const [emplois, setEmplois] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!classeId) { setChargement(false); return; }
    setChargement(true);
    client.get(`/emplois-du-temps?classeId=${classeId}`).then((res) => {
      setEmplois(res.data.emplois);
      setChargement(false);
    });
  }, [classeId]);

  const parJour = new Map();
  emplois.forEach((e) => {
    if (!parJour.has(e.jour)) parJour.set(e.jour, []);
    parJour.get(e.jour).push(e);
  });
  const jours = [...parJour.keys()].sort((a, b) => JOURS.indexOf(a) - JOURS.indexOf(b));

  return (
    <div className="carte">
      <h2>Emploi du temps</h2>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && emplois.length === 0 && <div className="vide">Aucun créneau renseigné pour le moment</div>}
      {!chargement && jours.map((jour) => (
        <div key={jour} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>{jour}</h3>
          <div className="liste-notifications">
            {parJour.get(jour).map((e) => (
              <div className="notification-item" key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{e.matiere || 'Cours'}</strong>
                  {e.salle && <span className="note-secondaire"> — {e.salle}</span>}
                </div>
                <span style={{ fontFamily: 'var(--police-mono)', fontSize: '0.8rem', color: 'var(--texte-clair)' }}>
                  {e.heureDebut} – {e.heureFin}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
