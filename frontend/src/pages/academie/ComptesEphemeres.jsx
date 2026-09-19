import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';

// Diagramme 4 : l'Académie génère un compte éphémère (portée + durée),
// reçoit un lien à transmettre au Professeur.
export default function ComptesEphemeres() {
  const [professeurs, setProfesseurs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [form, setForm] = useState({
    tache: 'saisie_notes', professeurId: '', classeId: '', semestreId: '', ueId: '', matiereId: '', categorie: 'cc', evaluationLibelle: '', dureeMinutes: 60,
  });
  const [nouveauProf, setNouveauProf] = useState({ nom: '', prenom: '', email: '', matiere: '' });
  const [lienGenere, setLienGenere] = useState(null);
  const [erreur, setErreur] = useState('');
  const [profFormOuvert, setProfFormOuvert] = useState(false);
  const [professeurASupprimer, setProfesseurASupprimer] = useState(null);

  function chargerReferences() {
    client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs));
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }
  useEffect(chargerReferences, []);

  // Un seul semestre déclaré (le cas le plus courant en début d'année) :
  // pas besoin de faire choisir explicitement ce qui n'a qu'une réponse
  // possible — un champ de moins dans un formulaire déjà chargé.
  useEffect(() => {
    if (semestres.length === 1 && !form.semestreId) {
      setForm((f) => ({ ...f, semestreId: String(semestres[0].id) }));
    }
  }, [semestres]);

  useEffect(() => {
    if (form.semestreId) client.get(`/unites-enseignement?semestreId=${form.semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
  }, [form.semestreId]);

  async function creerProfesseur(e) {
    e.preventDefault();
    await client.post('/professeurs', nouveauProf);
    setNouveauProf({ nom: '', prenom: '', email: '', matiere: '' });
    setProfFormOuvert(false);
    chargerReferences();
  }

  async function confirmerSuppressionProfesseur() {
    await client.delete(`/professeurs/${professeurASupprimer.id}`);
    setProfesseurASupprimer(null);
    chargerReferences();
  }

  async function genererCompte(e) {
    e.preventDefault();
    setErreur('');
    setLienGenere(null);
    try {
      const res = await client.post('/comptes-ephemeres', {
        tache: form.tache,
        professeurId: Number(form.professeurId),
        classeId: Number(form.classeId),
        // La matière n'a de sens que pour la saisie de notes.
        ...(form.tache === 'saisie_notes'
          ? { matiereId: Number(form.matiereId), categorie: form.categorie, evaluationLibelle: form.evaluationLibelle }
          : {}),
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
          Le Professeur n'a pas de compte permanent : ce lien lui permet de saisir les notes ou
          l'appel d'une classe, pour une durée précise, puis se révoque automatiquement.
        </p>
        <form className="formulaire" onSubmit={genererCompte}>
          <div className="onglets-secondaires" style={{ marginBottom: 4 }}>
            <button type="button" className={form.tache === 'saisie_notes' ? 'actif' : ''} onClick={() => setForm({ ...form, tache: 'saisie_notes' })}>
              Saisie des notes
            </button>
            <button type="button" className={form.tache === 'saisie_absences' ? 'actif' : ''} onClick={() => setForm({ ...form, tache: 'saisie_absences' })}>
              Saisie des absences
            </button>
          </div>
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
            {form.tache === 'saisie_notes' && semestres.length > 1 && (
              <div className="champ">
                <label>Semestre</label>
                <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
                  <option value="">—</option>
                  {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                </select>
              </div>
            )}
          </div>
          {form.tache === 'saisie_notes' && (
            <div className="ligne-champs">
              <div className="champ">
                <label>UE</label>
                <select value={form.ueId} onChange={(e) => setForm({ ...form, ueId: e.target.value, matiereId: '' })} required disabled={!form.semestreId}>
                  <option value="">—</option>
                  {ues.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.intitule}</option>)}
                </select>
              </div>
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
          )}
          <div className="ligne-champs">
            {form.tache === 'saisie_notes' && (
              <div className="champ">
                <label>Évaluation (libellé libre)</label>
                <input value={form.evaluationLibelle} onChange={(e) => setForm({ ...form, evaluationLibelle: e.target.value })} placeholder="Devoir surveillé 1" />
              </div>
            )}
            <div className="champ" style={{ maxWidth: 160 }}>
              <label>Durée (minutes)</label>
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
          <thead><tr><th>Nom</th><th>Matière</th><th>E-mail</th><th></th></tr></thead>
          <tbody>
            {professeurs.map((p) => (
              <tr key={p.id}>
                <td>{p.prenom} {p.nom}</td>
                <td>{p.matiere || '—'}</td>
                <td>{p.email}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="secondaire danger" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => setProfesseurASupprimer(p)}>
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
            {professeurs.length === 0 && <tr><td colSpan={4} className="vide">Aucun professeur</td></tr>}
          </tbody>
        </table>
        <div className="separateur-section" />
        <div className="entete-section">
          <h3>Ajouter un professeur</h3>
          <button type="button" className={profFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setProfFormOuvert((v) => !v)}>
            {profFormOuvert ? 'Annuler' : '+ Ajouter un professeur'}
          </button>
        </div>
        {profFormOuvert && (
          <form className="formulaire" onSubmit={creerProfesseur} autoComplete="off">
            <div className="ligne-champs">
              <div className="champ"><label>Prénom</label><input value={nouveauProf.prenom} onChange={(e) => setNouveauProf({ ...nouveauProf, prenom: e.target.value })} required autoFocus /></div>
              <div className="champ"><label>Nom</label><input value={nouveauProf.nom} onChange={(e) => setNouveauProf({ ...nouveauProf, nom: e.target.value })} required /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ"><label>E-mail</label><input type="email" autoComplete="off" value={nouveauProf.email} onChange={(e) => setNouveauProf({ ...nouveauProf, email: e.target.value })} required /></div>
              <div className="champ"><label>Matière</label><input value={nouveauProf.matiere} onChange={(e) => setNouveauProf({ ...nouveauProf, matiere: e.target.value })} /></div>
            </div>
            <button className="primaire" type="submit">Ajouter</button>
          </form>
        )}
      </div>

      {professeurASupprimer && (
        <ConfirmModal
          titre="Retirer ce professeur ?"
          onAnnuler={() => setProfesseurASupprimer(null)}
          onConfirmer={confirmerSuppressionProfesseur}
        >
          Retirer {professeurASupprimer.prenom} {professeurASupprimer.nom} de la liste des professeurs ?
        </ConfirmModal>
      )}
    </div>
  );
}
