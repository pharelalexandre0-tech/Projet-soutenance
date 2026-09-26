import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';

// Incidents de comportement consignés par l'établissement dans le dossier de
// l'élève, visibles de l'étudiant comme de son parent (même compte). Le
// parent en est aussi prévenu par e-mail.
export default function ComportementEleve({ eleveId }) {
  const [incidents, setIncidents] = useState(null);

  function charger() {
    if (!eleveId) return;
    client.get(`/incidents/eleve/${eleveId}`).then((res) => setIncidents(res.data.incidents)).catch(() => setIncidents((i) => i || []));
  }
  useEffect(() => {
    setIncidents(null);
    charger();
  }, [eleveId]);
  useActualisation(charger);

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Comportement <span className="entete-carte-compteur">{incidents ? incidents.length : '…'}</span></h2>
      </div>
      {!incidents && <div className="chargement">Chargement…</div>}
      {incidents && incidents.length === 0 && <div className="vide">Aucun incident signalé par l'établissement.</div>}
      {incidents && incidents.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Gravité</th><th>Motif</th></tr></thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(`${i.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td><span className={`badge ${i.gravite === 'majeur' ? 'rouge' : 'or'}`}>{i.gravite === 'majeur' ? 'Majeur' : 'Mineur'}</span></td>
                  <td>{i.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
