import { useEffect, useState } from 'react';
import client from '../../api/client';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps';

// Même grille que côté Académie, en lecture seule.
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

  return (
    <div className="carte">
      <h2>Semaine type</h2>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && emplois.length === 0 && <div className="vide">Aucun cours renseigné pour le moment.</div>}
      {!chargement && emplois.length > 0 && <GrilleEmploiDuTemps creneaux={emplois} />}
    </div>
  );
}
