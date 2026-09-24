import { useEffect, useState } from 'react';
import client from '../../api/client';

const LIBELLES_TYPE = { message: 'gris', annonce: 'or', convocation: 'rouge' };

export default function Communication() {
  const [onglet, setOnglet] = useState('messages');
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
  }, []);

  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'messages' ? 'actif' : ''} onClick={() => setOnglet('messages')}>Messages &amp; annonces</button>
        <button className={onglet === 'cahier' ? 'actif' : ''} onClick={() => setOnglet('cahier')}>Cahier de textes</button>
      </div>
      {onglet === 'messages' ? <Messages classes={classes} /> : <CahierDeTextes classes={classes} />}
    </div>
  );
}

function Messages({ classes }) {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ classeId: '', type: 'message', titre: '', contenu: '' });
  const [resultat, setResultat] = useState('');
  const [formOuvert, setFormOuvert] = useState(false);

  function charger() {
    client.get('/messages').then((res) => setMessages(res.data.messages));
  }
  useEffect(charger, []);

  async function envoyer(e) {
    e.preventDefault();
    setResultat('');
    const res = await client.post('/messages', { ...form, classeId: Number(form.classeId) });
    setResultat(`Envoyé. ${res.data.etudiantsNotifies} étudiant(s) notifié(s) par notification et e-mail.`);
    setForm({ classeId: form.classeId, type: 'message', titre: '', contenu: '' });
    setFormOuvert(false);
    charger();
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <div className="entete-section">
          <h2>Envoyer un message</h2>
          <button type="button" className={formOuvert ? 'secondaire' : 'primaire'} onClick={() => setFormOuvert((v) => !v)}>
            {formOuvert ? 'Annuler' : '+ Nouveau message'}
          </button>
        </div>
        {formOuvert && (
        <form className="formulaire" onSubmit={envoyer}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Classe</label>
              <select value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })} required>
                <option value="">Choisir une classe</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="message">Message</option>
                <option value="annonce">Annonce</option>
                <option value="convocation">Convocation</option>
              </select>
            </div>
          </div>
          <div className="champ">
            <label>Titre</label>
            <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required />
          </div>
          <div className="champ">
            <label>Contenu</label>
            <textarea rows={4} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} required />
          </div>
          <button className="primaire" type="submit">Envoyer aux étudiants de la classe</button>
          {resultat && <div className="message-succes">{resultat}</div>}
        </form>
        )}
        {!formOuvert && resultat && <div className="message-succes" style={{ marginTop: 14 }}>{resultat}</div>}
      </div>

      <div className="carte">
        <h2>Historique</h2>
        <div className="liste-notifications">
          {messages.map((m) => (
            <div className="notification-item" key={m.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{m.titre}</strong>
                <span className={`badge ${LIBELLES_TYPE[m.type]}`}>{m.type}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--texte-clair)', margin: '4px 0' }}>{m.contenu}</div>
              <span className="vide" style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left' }}>
                {m.Classe?.nom}, {new Date(m.dateEnvoi).toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
          {messages.length === 0 && <div className="vide">Aucun message envoyé</div>}
        </div>
      </div>
    </div>
  );
}

function CahierDeTextes({ classes }) {
  const [classeId, setClasseId] = useState('');
  const [cahier, setCahier] = useState([]);
  const [form, setForm] = useState({ date: '', contenuSeance: '' });
  const [formOuvert, setFormOuvert] = useState(false);

  useEffect(() => {
    if (classeId) client.get(`/cahier-de-textes?classeId=${classeId}`).then((res) => setCahier(res.data.cahier));
    else setCahier([]);
  }, [classeId]);

  async function ajouter(e) {
    e.preventDefault();
    await client.post('/cahier-de-textes', { ...form, classeId: Number(classeId) });
    setForm({ date: '', contenuSeance: '' });
    setFormOuvert(false);
    client.get(`/cahier-de-textes?classeId=${classeId}`).then((res) => setCahier(res.data.cahier));
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Cahier de textes</h2>
        <div className="champ" style={{ marginBottom: 16 }}>
          <label>Classe</label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">Choisir une classe</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
        </div>
        <div className="liste-notifications">
          {cahier.map((c) => (
            <div className="notification-item" key={c.id}>
              <strong>{new Date(c.date).toLocaleDateString('fr-FR')}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--texte-clair)', marginTop: 4 }}>{c.contenuSeance}</div>
            </div>
          ))}
          {classeId && cahier.length === 0 && <div className="vide">Aucune séance enregistrée</div>}
          {!classeId && <div className="vide">Choisis une classe</div>}
        </div>
      </div>

      <div className="carte">
        <div className="entete-section">
          <h2>Ajouter une séance</h2>
          <button type="button" className={formOuvert ? 'secondaire' : 'primaire'} onClick={() => setFormOuvert((v) => !v)} disabled={!classeId}>
            {formOuvert ? 'Annuler' : '+ Nouvelle séance'}
          </button>
        </div>
        {!classeId && <div className="vide">Sélectionne une classe à gauche</div>}
        {formOuvert && classeId && (
        <form className="formulaire" onSubmit={ajouter}>
          <div className="champ">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="champ">
            <label>Contenu de la séance</label>
            <textarea rows={4} value={form.contenuSeance} onChange={(e) => setForm({ ...form, contenuSeance: e.target.value })} required />
          </div>
          <button className="primaire" type="submit">Enregistrer</button>
        </form>
        )}
      </div>
    </div>
  );
}
