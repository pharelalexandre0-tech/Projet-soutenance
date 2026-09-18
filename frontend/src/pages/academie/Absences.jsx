import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function Absences() {
  const [onglet, setOnglet] = useState('appel');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'appel' ? 'actif' : ''} onClick={() => setOnglet('appel')}>Faire l'appel</button>
        <button className={onglet === 'brief' ? 'actif' : ''} onClick={() => setOnglet('brief')}>Brief d'absentéisme</button>
        <button className={onglet === 'comportement' ? 'actif' : ''} onClick={() => setOnglet('comportement')}>Comportement</button>
      </div>
      {onglet === 'appel' && <Appel />}
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
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
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

// "Liste numérique à cocher" : on affiche la classe entière, numérotée, et on
// coche uniquement les élèves absents ce jour-là pour ce cours.
function Appel() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [eleves, setEleves] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cours, setCours] = useState('');
  // Par élève : undefined (présent, rien à saisir), 'absence' ou 'retard'.
  const [statuts, setStatuts] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => { client.get('/classes').then((res) => setClasses(res.data.classes)); }, []);
  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => { setEleves(res.data.eleves); setStatuts({}); });
    else setEleves([]);
  }, [classeId]);

  // Un clic fait cycler présent -> absent -> retard -> présent, pour rester
  // aussi rapide qu'une simple case à cocher tout en couvrant les 3 états.
  function cycler(eleveId) {
    const suivant = { present: 'absence', absence: 'retard', retard: 'present' };
    const actuel = statuts[eleveId] || 'present';
    setStatuts({ ...statuts, [eleveId]: suivant[actuel] });
  }

  async function envoyerAppel(e) {
    e.preventDefault();
    setMessage('');
    const absentEleveIds = Object.entries(statuts).filter(([, s]) => s === 'absence').map(([id]) => Number(id));
    const retardEleveIds = Object.entries(statuts).filter(([, s]) => s === 'retard').map(([id]) => Number(id));
    const res = await client.post('/absences/appel', { classeId: Number(classeId), date, cours, absentEleveIds, retardEleveIds });
    setMessage(res.data.message);
    setStatuts({});
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
          <>
            <p className="note-secondaire" style={{ marginTop: -4 }}>Clique un élève pour faire défiler présent → absent → retard.</p>
            <div className="liste-notifications">
              {eleves.map((el, i) => {
                const statut = statuts[el.id] || 'present';
                const fond = statut === 'absence' ? 'var(--erreur-fond)' : statut === 'retard' ? 'var(--alerte-fond)' : undefined;
                return (
                  <button
                    type="button"
                    key={el.id}
                    className="notification-item"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: fond, width: '100%', textAlign: 'left', border: 'none' }}
                    onClick={() => cycler(el.id)}
                  >
                    <span style={{ fontFamily: 'var(--police-mono)', color: 'var(--texte-clair)', width: 24 }}>{i + 1}.</span>
                    <span>{el.prenom} {el.nom}</span>
                    {statut === 'absence' && <span className="badge rouge" style={{ marginLeft: 'auto' }}>absent</span>}
                    {statut === 'retard' && <span className="badge or" style={{ marginLeft: 'auto' }}>retard</span>}
                  </button>
                );
              })}
            </div>
          </>
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
