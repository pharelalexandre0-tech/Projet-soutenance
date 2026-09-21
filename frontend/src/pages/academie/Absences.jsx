import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function Absences() {
  const [onglet, setOnglet] = useState('brief');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'brief' ? 'actif' : ''} onClick={() => setOnglet('brief')}>Brief d'absentéisme</button>
        <button className={onglet === 'comportement' ? 'actif' : ''} onClick={() => setOnglet('comportement')}>Comportement</button>
      </div>
      {onglet === 'brief' && <Brief />}
      {onglet === 'comportement' && <Comportement />}
    </div>
  );
}

// Journal des incidents de comportement — troisième signal utilisé par le
// module de prédiction IA, aux côtés des notes et des absences.
function Comportement() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [eleves, setEleves] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', gravite: 'mineur' });
  const [incidents, setIncidents] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => { client.get('/classes').then((res) => setClasses(res.data.classes)); }, []);
  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves));
    else setEleves([]);
    setEleveId('');
    setIncidents([]);
  }, [classeId]);

  function chargerIncidents(id) {
    client.get(`/incidents/eleve/${id}`).then((res) => setIncidents(res.data.incidents));
  }

  async function enregistrer(e) {
    e.preventDefault();
    setMessage('');
    await client.post('/incidents', { ...form, eleveId: Number(eleveId) });
    setForm({ ...form, description: '' });
    setMessage('Incident enregistré.');
    chargerIncidents(eleveId);
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Signaler un incident</h2>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Élève</label>
            <select value={eleveId} onChange={(e) => { setEleveId(e.target.value); if (e.target.value) chargerIncidents(e.target.value); }} disabled={!classeId}>
              <option value="">—</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
            </select>
          </div>
        </div>
        {eleveId && (
          <form className="formulaire" onSubmit={enregistrer}>
            <div className="ligne-champs">
              <div className="champ"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              <div className="champ">
                <label>Gravité</label>
                <select value={form.gravite} onChange={(e) => setForm({ ...form, gravite: e.target.value })}>
                  <option value="mineur">Mineur</option>
                  <option value="majeur">Majeur</option>
                </select>
              </div>
            </div>
            <div className="champ">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <button className="primaire" type="submit">Enregistrer l'incident</button>
            {message && <div className="message-succes">{message}</div>}
          </form>
        )}
      </div>

      <div className="carte">
        <h2>Historique</h2>
        {!eleveId && <div className="vide">Choisis un élève à gauche</div>}
        {eleveId && incidents.length === 0 && <div className="vide">Aucun incident enregistré</div>}
        {eleveId && incidents.length > 0 && (
          <div className="liste-notifications">
            {incidents.map((i) => (
              <div className="notification-item" key={i.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{new Date(i.date).toLocaleDateString('fr-FR')}</strong>
                  <span className={`badge ${i.gravite === 'majeur' ? 'rouge' : 'or'}`}>{i.gravite}</span>
                </div>
                <p style={{ fontSize: '0.87rem', margin: '6px 0 0' }}>{i.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
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
