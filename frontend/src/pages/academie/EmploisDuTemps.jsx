import { useEffect, useState } from 'react';
import client from '../../api/client';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CRENEAU_VIDE = { jour: 'Lundi', heureDebut: '', heureFin: '', matiere: '', salle: '' };

export default function EmploisDuTemps() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [emplois, setEmplois] = useState([]);
  const [formOuvert, setFormOuvert] = useState(false);
  const [nouveauCreneau, setNouveauCreneau] = useState(CRENEAU_VIDE);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  function charger(id) {
    client.get(`/emplois-du-temps?classeId=${id}`).then((res) => setEmplois(res.data.emplois));
  }
  useEffect(() => {
    if (classeId) charger(classeId); else setEmplois([]);
  }, [classeId]);

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/emplois-du-temps', { ...nouveauCreneau, classeId: Number(classeId), semestreId: Number(semestreId) });
      setNouveauCreneau(CRENEAU_VIDE);
      setFormOuvert(false);
      charger(classeId);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de créer ce créneau');
    }
  }

  async function supprimer(id) {
    await client.delete(`/emplois-du-temps/${id}`);
    charger(classeId);
  }

  const parJour = new Map();
  emplois.forEach((e) => {
    if (!parJour.has(e.jour)) parJour.set(e.jour, []);
    parJour.get(e.jour).push(e);
  });

  return (
    <div className="carte">
      <div className="entete-section">
        <h2>Emplois du temps</h2>
        <button type="button" className={formOuvert ? 'secondaire' : 'primaire'} onClick={() => setFormOuvert((v) => !v)} disabled={!classeId || !semestreId}>
          {formOuvert ? 'Annuler' : '+ Ajouter un créneau'}
        </button>
      </div>

      <div className="ligne-champs" style={{ marginBottom: 18 }}>
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
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
      </div>

      {!classeId && <div className="vide">Choisis une classe pour voir ou modifier son emploi du temps</div>}

      {formOuvert && (
        <form className="formulaire" style={{ marginBottom: 22, padding: 14, background: 'var(--gris-fond)', borderRadius: 10 }} onSubmit={ajouter}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Jour</label>
              <select value={nouveauCreneau.jour} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, jour: e.target.value })}>
                {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="champ"><label>Début</label><input type="time" value={nouveauCreneau.heureDebut} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, heureDebut: e.target.value })} required /></div>
            <div className="champ"><label>Fin</label><input type="time" value={nouveauCreneau.heureFin} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, heureFin: e.target.value })} required /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Matière</label><input value={nouveauCreneau.matiere} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, matiere: e.target.value })} placeholder="ex. Mathématiques" required /></div>
            <div className="champ"><label>Salle</label><input value={nouveauCreneau.salle} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, salle: e.target.value })} placeholder="ex. B12" /></div>
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit">Ajouter</button>
        </form>
      )}

      {classeId && JOURS.filter((j) => parJour.has(j)).map((jour) => (
        <div key={jour} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>{jour}</h3>
          <table>
            <thead><tr><th>Horaire</th><th>Matière</th><th>Salle</th><th></th></tr></thead>
            <tbody>
              {parJour.get(jour).map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'var(--police-mono)' }}>{e.heureDebut} – {e.heureFin}</td>
                  <td>{e.matiere || '—'}</td>
                  <td>{e.salle || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="secondaire danger" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => supprimer(e.id)}>Retirer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {classeId && emplois.length === 0 && <div className="vide">Aucun créneau renseigné pour cette classe</div>}
    </div>
  );
}
