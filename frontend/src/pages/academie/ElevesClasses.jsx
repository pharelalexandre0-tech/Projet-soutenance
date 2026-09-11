import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [nouvelleClasse, setNouvelleClasse] = useState({ nom: '', niveau: '' });
  const [nouvelEleve, setNouvelEleve] = useState({ nom: '', prenom: '', classeId: '', email: '', motDePasse: '' });
  const [message, setMessage] = useState('');

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes));
  }
  useEffect(charger, []);

  async function creerClasse(e) {
    e.preventDefault();
    await client.post('/classes', nouvelleClasse);
    setNouvelleClasse({ nom: '', niveau: '' });
    charger();
  }

  async function creerEleve(e) {
    e.preventDefault();
    setMessage('');
    try {
      await client.post('/eleves', nouvelEleve);
      setMessage(`Élève ajouté, compte étudiant créé.`);
      setNouvelEleve({ nom: '', prenom: '', classeId: '', email: '', motDePasse: '' });
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Classes</h2>
        <table>
          <thead><tr><th>Nom</th><th>Niveau</th><th>Effectif</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.nom}</td>
                <td>{c.niveau}</td>
                <td>{c.Eleves?.length ?? 0}</td>
              </tr>
            ))}
            {classes.length === 0 && <tr><td colSpan={3} className="vide">Aucune classe</td></tr>}
          </tbody>
        </table>
        <h3 style={{ marginTop: 18 }}>Créer une classe</h3>
        <form className="formulaire" onSubmit={creerClasse}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Nom</label>
              <input value={nouvelleClasse.nom} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, nom: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Niveau</label>
              <input value={nouvelleClasse.niveau} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, niveau: e.target.value })} required />
            </div>
          </div>
          <button className="primaire" type="submit">Ajouter la classe</button>
        </form>
      </div>

      <div className="carte">
        <h2>Élèves</h2>
        <h3>Inscrire un élève</h3>
        <form className="formulaire" onSubmit={creerEleve}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Prénom</label>
              <input value={nouvelEleve.prenom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, prenom: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Nom</label>
              <input value={nouvelEleve.nom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, nom: e.target.value })} required />
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Classe</label>
              <select value={nouvelEleve.classeId} onChange={(e) => setNouvelEleve({ ...nouvelEleve, classeId: e.target.value })} required>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>E-mail (compte étudiant)</label>
              <input type="email" value={nouvelEleve.email} onChange={(e) => setNouvelEleve({ ...nouvelEleve, email: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Mot de passe (compte étudiant)</label>
              <input type="password" value={nouvelEleve.motDePasse} onChange={(e) => setNouvelEleve({ ...nouvelEleve, motDePasse: e.target.value })} minLength={6} required />
            </div>
          </div>
          <button className="primaire" type="submit">Inscrire l'élève</button>
          {message && <div className="message-succes">{message}</div>}
        </form>
      </div>
    </div>
  );
}
