import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function Absences() {
  const [onglet, setOnglet] = useState('appel');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'appel' ? 'actif' : ''} onClick={() => setOnglet('appel')}>Faire l'appel</button>
        <button className={onglet === 'brief' ? 'actif' : ''} onClick={() => setOnglet('brief')}>Brief d'absentéisme</button>
      </div>
      {onglet === 'appel' ? <Appel /> : <Brief />}
    </div>
  );
}

// "Liste numérique à cocher" : on affiche la classe entière, numérotée, et on
// coche uniquement les élèves absents ce jour-là pour ce cours.
function Appel() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [eleves, setEleves] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cours, setCours] = useState('');
  const [coches, setCoches] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => { client.get('/classes').then((res) => setClasses(res.data.classes)); }, []);
  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => { setEleves(res.data.eleves); setCoches({}); });
    else setEleves([]);
  }, [classeId]);

  function basculer(eleveId) {
    setCoches({ ...coches, [eleveId]: !coches[eleveId] });
  }

  async function envoyerAppel(e) {
    e.preventDefault();
    setMessage('');
    const absentEleveIds = Object.entries(coches).filter(([, coche]) => coche).map(([id]) => Number(id));
    const res = await client.post('/absences/appel', { classeId: Number(classeId), date, cours, absentEleveIds });
    setMessage(res.data.message);
    setCoches({});
  }

  return (
    <div className="carte">
      <h2>Faire l'appel</h2>
      <form className="formulaire" onSubmit={envoyerAppel}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)} required>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="champ">
            <label>Cours</label>
            <input value={cours} onChange={(e) => setCours(e.target.value)} placeholder="ex. Mathématiques" />
          </div>
        </div>

        {classeId && eleves.length > 0 && (
          <div className="liste-notifications">
            {eleves.map((el, i) => (
              <label
                key={el.id}
                className="notification-item"
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: coches[el.id] ? 'var(--erreur-fond)' : undefined }}
              >
                <span style={{ fontFamily: 'var(--police-mono)', color: 'var(--texte-clair)', width: 24 }}>{i + 1}.</span>
                <input type="checkbox" checked={!!coches[el.id]} onChange={() => basculer(el.id)} />
                <span>{el.prenom} {el.nom}</span>
                {coches[el.id] && <span className="badge rouge" style={{ marginLeft: 'auto' }}>absent</span>}
              </label>
            ))}
          </div>
        )}
        {classeId && eleves.length === 0 && <div className="vide">Aucun élève dans cette classe</div>}

        <button className="primaire" type="submit" disabled={!classeId}>Enregistrer l'appel</button>
        {message && <div className="message-succes">{message}</div>}
      </form>
    </div>
  );
}

// Brief par élève : total, non justifiées, taux d'absentéisme — pour
// repérer d'un coup d'œil les enfants à surveiller.
function Brief() {
  const [brief, setBrief] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    client.get('/absences/brief').then((res) => { setBrief(res.data.brief); setChargement(false); });
  }, []);

  function styleTaux(taux) {
    if (taux === 0) return 'vert';
    if (taux <= 20) return 'or';
    return 'rouge';
  }

  return (
    <div className="carte">
      <h2>Brief d'absentéisme par élève</h2>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && (
        <table>
          <thead>
            <tr><th>Élève</th><th>Classe</th><th>Total</th><th>Justifiées</th><th>Non justifiées</th><th>Taux</th></tr>
          </thead>
          <tbody>
            {brief.map((b) => (
              <tr key={b.eleveId}>
                <td>{b.prenom} {b.nom}</td>
                <td>{b.classe}</td>
                <td style={{ fontFamily: 'var(--police-mono)' }}>{b.total}</td>
                <td style={{ fontFamily: 'var(--police-mono)', color: 'var(--succes)' }}>{b.justifiees}</td>
                <td style={{ fontFamily: 'var(--police-mono)', color: 'var(--erreur)' }}>{b.nonJustifiees}</td>
                <td><span className={`badge ${styleTaux(b.tauxAbsenteisme)}`}>{b.tauxAbsenteisme}%</span></td>
              </tr>
            ))}
            {brief.length === 0 && <tr><td colSpan={6} className="vide">Aucun élève</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
