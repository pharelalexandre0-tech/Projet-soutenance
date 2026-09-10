import { useEffect, useState } from 'react';
import client from '../../api/client';
import BulletinDocument from '../../components/BulletinDocument';

// Consultation du bulletin côté Académie : même document que celui vu par
// le Parent (via BulletinDocument), avec en plus la possibilité de le
// renvoyer par e-mail à la demande (ex. le parent dit ne pas l'avoir reçu).
export default function Bulletins() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [eleves, setEleves] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [bulletin, setBulletin] = useState(null);
  const [detail, setDetail] = useState(null);
  const [resume, setResume] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [envoiStatut, setEnvoiStatut] = useState('');

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves));
    else setEleves([]);
    setEleveId('');
  }, [classeId]);

  const eleve = eleves.find((e) => String(e.id) === eleveId);
  const semestre = semestres.find((s) => String(s.id) === String(semestreId));

  async function demanderBulletin() {
    setErreur('');
    setBulletin(null);
    setEnvoiStatut('');
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

  async function envoyerParEmail() {
    setEnvoiStatut('en_cours');
    try {
      const res = await client.post(`/bulletins/${eleveId}/${semestreId}/envoyer`);
      setEnvoiStatut(`envoyé à ${res.data.destinataire}`);
    } catch (err) {
      setEnvoiStatut(err.response?.data?.erreur || 'échec de l\'envoi');
    }
  }

  return (
    <div className="carte">
      <h2>Bulletins scolaires</h2>
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
          <select value={eleveId} onChange={(e) => setEleveId(e.target.value)} disabled={!classeId}>
            <option value="">—</option>
            {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
          </select>
        </div>
        <div className="champ">
          <label>Semestre</label>
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
            <option value="">—</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
        <button className="primaire" style={{ alignSelf: 'flex-end' }} disabled={!eleveId || !semestreId || enCours} onClick={demanderBulletin}>
          {enCours ? 'Chargement…' : 'Consulter le bulletin'}
        </button>
      </div>
      {erreur && <div className="message-erreur" style={{ marginTop: 10 }}>{erreur}</div>}

      <BulletinDocument
        eleveId={eleveId}
        eleve={eleve}
        semestre={semestre}
        bulletin={bulletin}
        detail={detail}
        resume={resume}
        actions={
          <button type="button" className="secondaire" onClick={envoyerParEmail} disabled={envoiStatut === 'en_cours'}>
            {envoiStatut === 'en_cours' ? 'Envoi…' : 'Envoyer par e-mail au parent'}
          </button>
        }
      />
      {envoiStatut && envoiStatut !== 'en_cours' && (
        <div className={envoiStatut.startsWith('envoyé') ? 'message-succes' : 'message-erreur'} style={{ marginTop: 12 }}>
          {envoiStatut.startsWith('envoyé') ? `Bulletin ${envoiStatut}.` : envoiStatut}
        </div>
      )}
    </div>
  );
}
