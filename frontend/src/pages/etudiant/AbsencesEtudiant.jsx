import { useEffect, useState } from 'react';
import client from '../../api/client';
import { IconCalendarAlert, IconAlertTriangle } from '../../components/icons';

export default function AbsencesEtudiant({ eleveId }) {
  const [absences, setAbsences] = useState([]);
  const [motifs, setMotifs] = useState({});
  const [chargement, setChargement] = useState(true);

  function charger() {
    setChargement(true);
    client.get(`/absences/eleve/${eleveId}`).then((res) => {
      setAbsences(res.data.absences);
      setChargement(false);
    });
  }
  useEffect(charger, [eleveId]);

  async function transmettreJustificatif(id) {
    await client.post(`/absences/${id}/justificatif`, { motif: motifs[id] || 'justificatif transmis' });
    charger();
  }

  const justifiees = absences.filter((a) => a.justifie).length;
  const nonJustifiees = absences.length - justifiees;
  const taux = absences.length > 0 ? Math.round((nonJustifiees / absences.length) * 100) : 0;

  return (
    <>
      {absences.length > 0 && (
        <div className="stats-grid">
          <div className="stat-tile">
            <div className="stat-tile-haut"><span className="libelle">Total absences</span><span className="puce-icone petite"><IconCalendarAlert width={16} height={16} /></span></div>
            <div className="valeur">{absences.length}</div>
          </div>
          <div className="stat-tile tile-vert">
            <div className="stat-tile-haut"><span className="libelle">Justifiées</span></div>
            <div className="valeur">{justifiees}</div>
          </div>
          <div className={`stat-tile ${nonJustifiees > 0 ? 'tile-rouge' : 'tile-vert'}`}>
            <div className="stat-tile-haut"><span className="libelle">Non justifiées</span><span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span></div>
            <div className="valeur">{nonJustifiees}</div>
          </div>
          <div className={`stat-tile ${taux >= 30 ? 'tile-rouge' : taux > 0 ? 'tile-or' : 'tile-vert'}`}>
            <div className="stat-tile-haut"><span className="libelle">Taux non justifié</span></div>
            <div className="valeur">{taux}%</div>
          </div>
        </div>
      )}

      <div className="carte">
        <h2>Absences</h2>
        {chargement && <div className="chargement">Chargement…</div>}
        {!chargement && absences.length === 0 && <div className="vide">Aucune absence enregistrée</div>}
        {!chargement && absences.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Cours</th><th>Statut</th><th>Justificatif</th></tr></thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{a.cours || '—'}</td>
                    <td>{a.justifie ? <span className="badge vert">justifiée</span> : <span className="badge rouge">non justifiée</span>}</td>
                    <td>
                      {a.justifie ? (
                        <span className="note-secondaire">{a.motif}</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            placeholder="motif du justificatif"
                            value={motifs[a.id] || ''}
                            onChange={(e) => setMotifs({ ...motifs, [a.id]: e.target.value })}
                            style={{ maxWidth: 180 }}
                          />
                          <button className="secondaire" onClick={() => transmettreJustificatif(a.id)}>Transmettre</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
