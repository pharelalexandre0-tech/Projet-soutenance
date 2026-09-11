import { useEffect, useState } from 'react';
import client from '../../api/client';
import BulletinDocument from '../../components/BulletinDocument';

// Diagramme 5 : l'Étudiant demande son bulletin -> généré à la volée s'il
// n'existe pas encore, sinon renvoyé depuis le cache.
export default function Bulletin({ eleveId, eleve }) {
  const [semestres, setSemestres] = useState([]);
  const [semestreId, setSemestreId] = useState('');
  const [bulletin, setBulletin] = useState(null);
  const [detail, setDetail] = useState(null);
  const [resume, setResume] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  const semestre = semestres.find((s) => String(s.id) === String(semestreId));

  async function demanderBulletin() {
    setErreur('');
    setBulletin(null);
    setEnCours(true);
    try {
      const res = await client.get(`/bulletins/${eleveId}/${semestreId}`);
      setBulletin(res.data.bulletin);
      setDetail(res.data.detailParUE || null);
      setResume({ creditsTotal: res.data.creditsTotal ?? 0, admis: !!res.data.admis, sessionGlobale: res.data.sessionGlobale });
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de récupérer le bulletin');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Bulletin scolaire</h2>
      <div className="ligne-champs">
        <div className="champ">
          <label>Semestre</label>
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
            <option value="">—</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
        <button className="primaire" style={{ alignSelf: 'flex-end' }} disabled={!semestreId || enCours} onClick={demanderBulletin}>
          {enCours ? 'Chargement…' : 'Consulter le bulletin'}
        </button>
      </div>
      {erreur && <div className="message-erreur" style={{ marginTop: 10 }}>{erreur}</div>}

      <BulletinDocument eleveId={eleveId} eleve={eleve} semestre={semestre} bulletin={bulletin} detail={detail} resume={resume} />
    </div>
  );
}
