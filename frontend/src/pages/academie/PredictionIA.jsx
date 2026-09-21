import { useEffect, useState } from 'react';
import client from '../../api/client';
import ChiffreAnime from '../../components/ChiffreAnime';
import { IconAlertTriangle } from '../../components/icons';

const STYLE_NIVEAU = { faible: 'vert', moyen: 'or', eleve: 'rouge' };
const LIBELLE_NIVEAU = { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' };

// Diagramme d'activité 7 : déclencher l'analyse -> collecte -> calcul du
// score -> alerte si seuil dépassé -> l'Académie consulte le dossier et
// décide d'une action. Le signalement de comportement vit ici (sous-onglet)
// plutôt que dans un onglet "Absences" à part : c'est un des trois signaux
// de ce même calcul (notes, absences, comportement), pas un sujet séparé.
export default function PredictionIA() {
  const [onglet, setOnglet] = useState('alertes');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'alertes' ? 'actif' : ''} onClick={() => setOnglet('alertes')}>Alertes décrochage</button>
        <button className={onglet === 'comportement' ? 'actif' : ''} onClick={() => setOnglet('comportement')}>Signaler un comportement</button>
      </div>
      {onglet === 'alertes' && <Alertes />}
      {onglet === 'comportement' && <Comportement />}
    </div>
  );
}

function Alertes() {
  const [alertes, setAlertes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierResultat, setDernierResultat] = useState(null);

  function charger() {
    client.get('/predictions/alertes').then((res) => setAlertes(res.data.alertes));
  }
  useEffect(charger, []);

  async function lancerAnalyse() {
    setEnCours(true);
    try {
      const res = await client.post('/predictions/executer');
      setDernierResultat(res.data);
      charger();
    } finally {
      setEnCours(false);
    }
  }

  const parNiveau = { faible: 0, moyen: 0, eleve: 0 };
  alertes.forEach((a) => { if (parNiveau[a.niveauRisque] !== undefined) parNiveau[a.niveauRisque] += 1; });
  // Les plus urgentes en premier — une liste de 40 élèves dans l'ordre de
  // calcul obligerait à tout parcourir pour repérer qui a le score le plus haut.
  const alertesTriees = [...alertes].sort((a, b) => b.scoreRisque - a.scoreRisque);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Alertes actives</span>
            <span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={alertes.length} /></div>
        </div>
        <div className={`stat-tile ${parNiveau.eleve > 0 ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque élevé</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.eleve} /></div>
        </div>
        <div className={`stat-tile ${parNiveau.moyen > 0 ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque moyen</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.moyen} /></div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Risque faible</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.faible} /></div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-section">
          <h2>Alertes décrochage</h2>
          <button className="primaire" onClick={lancerAnalyse} disabled={enCours}>
            {enCours ? 'Analyse en cours…' : "Lancer l'analyse maintenant"}
          </button>
        </div>
        <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -8, marginBottom: 16 }}>
          Analyse périodique des notes, absences et incidents de comportement, qui calcule un score de risque de
          décrochage par élève. Au-delà du seuil d'alerte, l'équipe pédagogique est notifiée ; la décision d'action
          (suivi, entretien, soutien) reste humaine.
        </p>
        {dernierResultat && (
          <div className="message-succes" style={{ marginBottom: 14 }}>
            {dernierResultat.analysés} élève(s) analysé(s), {dernierResultat.alertesGenerees} alerte(s) générée(s).
          </div>
        )}

        <table>
          <thead><tr><th>Élève</th><th>Score</th><th>Niveau</th><th>Facteurs clés</th><th>Date</th></tr></thead>
          <tbody>
            {alertesTriees.map((a) => (
              <tr key={a.id}>
                <td>{a.Eleve?.prenom} {a.Eleve?.nom}</td>
                <td style={{ fontFamily: 'var(--police-mono)' }}>{a.scoreRisque}/100</td>
                <td><span className={`badge ${STYLE_NIVEAU[a.niveauRisque]}`}>{LIBELLE_NIVEAU[a.niveauRisque] || a.niveauRisque}</span></td>
                <td>{a.facteursCles}</td>
                <td>{new Date(a.dateCalcul).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
            {alertes.length === 0 && <tr><td colSpan={5} className="vide">Aucune alerte active pour l'instant</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Journal des incidents de comportement — troisième signal utilisé par le
// calcul de risque, aux côtés des notes et des absences.
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
