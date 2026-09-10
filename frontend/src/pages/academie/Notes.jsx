import { useEffect, useState } from 'react';
import client from '../../api/client';

// Diagramme 4 (cas nominal) : l'Académie saisit, par matière, la moyenne de
// contrôle continu et la moyenne d'examen de chaque élève — pas note par
// note — pour en tirer la note finale de la matière.
export default function Notes() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [ueId, setUeId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [session, setSession] = useState('normale');
  const [eleves, setEleves] = useState([]);
  const [valeurs, setValeurs] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  useEffect(() => {
    if (semestreId) client.get(`/unites-enseignement?semestreId=${semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
    setUeId('');
  }, [semestreId]);

  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves));
    else setEleves([]);
  }, [classeId]);

  const ueSelectionnee = ues.find((u) => String(u.id) === ueId);
  const matieres = ueSelectionnee?.Matieres || [];

  function valeur(eleveId, categorie) {
    return valeurs[`${eleveId}-${categorie}`] ?? '';
  }
  function fixerValeur(eleveId, categorie, v) {
    setValeurs({ ...valeurs, [`${eleveId}-${categorie}`]: v });
  }

  async function enregistrer(e) {
    e.preventDefault();
    setMessage('');
    if (!matiereId) {
      setMessage('sélectionne une matière');
      return;
    }
    const notes = [];
    eleves.forEach((el) => {
      const cc = valeur(el.id, 'cc');
      const examen = valeur(el.id, 'examen');
      if (cc !== '') notes.push({ eleveId: el.id, matiereId: Number(matiereId), categorie: 'cc', valeur: cc });
      if (examen !== '') notes.push({ eleveId: el.id, matiereId: Number(matiereId), categorie: 'examen', valeur: examen });
    });
    if (notes.length === 0) {
      setMessage('saisis au moins une moyenne');
      return;
    }
    const res = await client.post('/notes', { notes, session });
    setMessage(`${res.data.resultats.length} moyenne(s) enregistrée(s) (session ${session === 'rattrapage' ? 'de rattrapage' : 'normale'}).`);
  }

  return (
    <div className="carte">
      <h2>Saisie des moyennes (Académie)</h2>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Semestre</label>
            <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
              <option value="">—</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>UE</label>
            <select value={ueId} onChange={(e) => { setUeId(e.target.value); setMatiereId(''); }}>
              <option value="">—</option>
              {ues.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.intitule}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Matière</label>
            <select value={matiereId} onChange={(e) => setMatiereId(e.target.value)} disabled={!ueId}>
              <option value="">—</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.intitule}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="normale">Normale</option>
              <option value="rattrapage">Rattrapage</option>
            </select>
          </div>
        </div>
        {session === 'rattrapage' && (
          <div className="message-erreur" style={{ marginTop: -4 }}>
            Session de rattrapage : ces moyennes ne remplacent la session normale que si elles sont meilleures.
          </div>
        )}

        {matiereId && eleves.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Moyenne CC / 20</th>
                <th>Moyenne Examen / 20</th>
              </tr>
            </thead>
            <tbody>
              {eleves.map((el) => (
                <tr key={el.id}>
                  <td>{el.prenom} {el.nom}</td>
                  <td>
                    <input
                      type="number" min="0" max="20" step="0.25" placeholder="/ 20"
                      value={valeur(el.id, 'cc')}
                      onChange={(e) => fixerValeur(el.id, 'cc', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" max="20" step="0.25" placeholder="/ 20"
                      value={valeur(el.id, 'examen')}
                      onChange={(e) => fixerValeur(el.id, 'examen', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {matiereId && eleves.length === 0 && <div className="vide">Choisis une classe pour afficher les élèves.</div>}
        {!matiereId && <div className="vide">Choisis une UE puis une matière pour saisir des moyennes.</div>}

        <button className="primaire" type="submit">Enregistrer les moyennes</button>
        {message && <div className={message.includes('enregistrée') ? 'message-succes' : 'message-erreur'}>{message}</div>}
      </form>
    </div>
  );
}
