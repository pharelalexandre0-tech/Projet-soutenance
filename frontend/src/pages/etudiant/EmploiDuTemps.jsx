import { useEffect, useState } from 'react';
import client from '../../api/client';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps';

// Même grille que côté Académie, en lecture seule.
export default function EmploiDuTemps({ classeId }) {
  const [emplois, setEmplois] = useState([]);
  const [publication, setPublication] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!classeId) { setChargement(false); return; }
    setChargement(true);
    client.get(`/emplois-du-temps?classeId=${classeId}`).then((res) => {
      setEmplois(res.data.emplois);
      setPublication(res.data.publication || null);
      setChargement(false);
    });
  }, [classeId]);

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Semaine type</h2>
        {publication && (
          <span className="note-secondaire">
            Publié le {new Date(publication.publieLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
      </div>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && emplois.length === 0 && (
        <div className="vide">L'établissement n'a pas encore publié cet emploi du temps. Une notification et un e-mail seront envoyés dès sa publication.</div>
      )}
      {!chargement && emplois.length > 0 && <GrilleEmploiDuTemps creneaux={emplois} />}
    </div>
  );
}
