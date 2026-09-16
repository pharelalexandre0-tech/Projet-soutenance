import { useEffect, useState } from 'react';
import client from '../../api/client';

// Diagramme 4 : l'Académie génère un compte éphémère (portée + durée),
// reçoit un lien à transmettre au Professeur.
export default function ComptesEphemeres() {
  const [professeurs, setProfesseurs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [form, setForm] = useState({
    professeurId: '', classeId: '', semestreId: '', ueId: '', matiereId: '', categorie: 'cc', evaluationLibelle: '', dureeMinutes: 60,
  });
  const [nouveauProf, setNouveauProf] = useState({ nom: '', prenom: '', email: '', matiere: '' });
  const [lienGenere, setLienGenere] = useState(null);
  const [erreur, setErreur] = useState('');

  function chargerReferences() {
    client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs));
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }
  useEffect(chargerReferences, []);

  useEffect(() => {
    if (form.semestreId) client.get(`/unites-enseignement?semestreId=${form.semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
  }, [form.semestreId]);

  async function creerProfesseur(e) {
    e.preventDefault();
    await client.post('/professeurs', nouveauProf);
    setNouveauProf({ nom: '', prenom: '', email: '', matiere: '' });
    chargerReferences();
  }

  async function genererCompte(e) {
    e.preventDefault();
    setErreur('');
    setLienGenere(null);
    try {
      const res = await client.post('/comptes-ephemeres', {
        professeurId: Number(form.professeurId),
        classeId: Number(form.classeId),
        matiereId: Number(form.matiereId),
        categorie: form.categorie,
        evaluationLibelle: form.evaluationLibelle,
        dureeMinutes: Number(form.dureeMinutes),
      });
      setLienGenere(res.data);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'erreur lors de la création du compte éphémère');
    }
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Créer un accès temporaire pour un Professeur</h2>
        <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem' }}>
          Le Professeur n'a pas de compte permanent : ce lien lui permet de saisir les notes d'une
          classe, pour une UE et une durée précises, puis se révoque automatiquement.
        </p>
        <form className="formulaire" onSubmit={genererCompte}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Professeur</label>
              <select value={form.professeurId} onChange={(e) => setForm({ ...form, professeurId: e.target.value })} required>
                <option value="">—</option>
                {professeurs.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.matiere})</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Classe</label>
              <select value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })} required>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Semestre</label>
              <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
                <option value="">—</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>UE</label>
              <select value={form.ueId} onChange={(e) => setForm({ ...form, ueId: e.target.value, matiereId: '' })} required>
                <option value="">—</option>
                {ues.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.intitule}</option>)}
              </select>
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Matière</label>
              <select value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })} required disabled={!form.ueId}>
                <option value="">—</option>
                {(ues.find((u) => String(u.id) === form.ueId)?.Matieres || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.code} — {m.intitule}</option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>Catégorie</label>
              <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                <option value="cc">Contrôle continu (CC)</option>
                <option value="examen">Examen</option>
              </select>
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Évaluation (libellé libre)</label>
              <input value={form.evaluationLibelle} onChange={(e) => setForm({ ...form, evaluationLibelle: e.target.value })} placeholder="Devoir surveillé 1" />
            </div>
            <div className="champ">
              <label>Durée de validité (minutes)</label>
              <input type="number" min="5" value={form.dureeMinutes} onChange={(e) => setForm({ ...form, dureeMinutes: e.target.value })} />
            </div>
          </div>
          <button className="primaire" type="submit">Générer le lien d'accès</button>
          {erreur && <div className="message-erreur">{erreur}</div>}
        </form>

        {lienGenere && (
          <div className="carte" style={{ marginTop: 16, background: '#fbf3df' }}>
            <strong>Lien à transmettre au Professeur :</strong>
            <div style={{ wordBreak: 'break-all', marginTop: 6 }}>
              <a href={lienGenere.lien} target="_blank" rel="noreferrer">{lienGenere.lien}</a>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--texte-clair)', marginTop: 6 }}>
              Expire le {new Date(lienGenere.compte.dateExpiration).toLocaleString('fr-FR')}
            </div>
          </div>
        )}
      </div>

      <div className="carte">
        <h2>Professeurs</h2>
        <table>
          <thead><tr><th>Nom</th><th>Matière</th><th>E-mail</th></tr></thead>
          <tbody>
            {professeurs.map((p) => (
              <tr key={p.id}><td>{p.prenom} {p.nom}</td><td>{p.matiere}</td><td>{p.email}</td></tr>
            ))}
            {professeurs.length === 0 && <tr><td colSpan={3} className="vide">Aucun professeur</td></tr>}
          </tbody>
        </table>
        <h3 style={{ marginTop: 18 }}>Ajouter un professeur</h3>
        <form className="formulaire" onSubmit={creerProfesseur} autoComplete="off">
          <div className="ligne-champs">
            <div className="champ"><label>Prénom</label><input value={nouveauProf.prenom} onChange={(e) => setNouveauProf({ ...nouveauProf, prenom: e.target.value })} required /></div>
            <div className="champ"><label>Nom</label><input value={nouveauProf.nom} onChange={(e) => setNouveauProf({ ...nouveauProf, nom: e.target.value })} required /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>E-mail</label><input type="email" autoComplete="off" value={nouveauProf.email} onChange={(e) => setNouveauProf({ ...nouveauProf, email: e.target.value })} required /></div>
            <div className="champ"><label>Matière</label><input value={nouveauProf.matiere} onChange={(e) => setNouveauProf({ ...nouveauProf, matiere: e.target.value })} /></div>
          </div>
          <button className="primaire" type="submit">Ajouter</button>
        </form>
      </div>
    </div>
  );
}
