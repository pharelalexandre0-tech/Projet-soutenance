import { useEffect, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel, motDePasseAleatoire } from '../../utils/excel';

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [nouvelleClasse, setNouvelleClasse] = useState({ nom: '', niveau: '' });
  const [nouvelEleve, setNouvelEleve] = useState({ nom: '', prenom: '', classeId: '', email: '', motDePasse: '' });
  const [message, setMessage] = useState('');
  const [classeImportId, setClasseImportId] = useState('');
  const [importEnCours, setImportEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState(null);

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes));
  }
  useEffect(charger, []);

  // Une ligne doit fournir au moins prénom + nom + email — le mot de passe
  // du compte étudiant est généré s'il manque (un enseignant qui exporte sa
  // liste depuis son propre tableur n'a évidemment pas de colonne mot de
  // passe), et rapporté dans le résumé pour que l'Académie puisse le
  // communiquer.
  async function importerEleves(e) {
    e.preventDefault();
    if (!classeImportId) return;
    const fichier = e.target.elements.fichierEleves.files[0];
    if (!fichier) return;
    setImportEnCours(true);
    setResultatImport(null);
    const lignes = await lireFichierExcel(fichier);
    const reussis = [];
    const echecs = [];
    for (let i = 0; i < lignes.length; i += 1) {
      const ligne = lignes[i];
      const prenom = ligne.prenom || ligne.prenoms;
      const nom = ligne.nom || ligne.noms;
      const email = ligne.email || ligne.mail || ligne.courriel;
      if (!prenom || !nom || !email) {
        echecs.push({ ligne: i + 2, raison: 'prénom, nom ou e-mail manquant' });
        continue;
      }
      const motDePasse = ligne.motdepasse || ligne.mdp || ligne.password || motDePasseAleatoire();
      try {
        await client.post('/eleves', {
          nom, prenom, email,
          motDePasse: String(motDePasse),
          classeId: classeImportId,
          dateNaissance: ligne.datenaissance || undefined,
        });
        reussis.push({ nom, prenom, email, motDePasse });
      } catch (err) {
        echecs.push({ ligne: i + 2, raison: err.response?.data?.erreur || 'erreur inconnue' });
      }
    }
    setResultatImport({ reussis, echecs });
    setImportEnCours(false);
    e.target.reset();
    charger();
  }

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
        <form className="formulaire" onSubmit={creerEleve} autoComplete="off">
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
              <input type="email" autoComplete="off" value={nouvelEleve.email} onChange={(e) => setNouvelEleve({ ...nouvelEleve, email: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Mot de passe (compte étudiant)</label>
              <input type="password" autoComplete="new-password" value={nouvelEleve.motDePasse} onChange={(e) => setNouvelEleve({ ...nouvelEleve, motDePasse: e.target.value })} minLength={6} required />
            </div>
          </div>
          <button className="primaire" type="submit">Inscrire l'élève</button>
          {message && <div className="message-succes">{message}</div>}
        </form>

        <h3 style={{ marginTop: 24 }}>Importer une liste (Excel/CSV)</h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 14 }}>
          Colonnes attendues : <strong>prénom</strong>, <strong>nom</strong>, <strong>email</strong> — et en
          option date de naissance, mot de passe (sinon généré automatiquement).
        </p>
        <form className="formulaire" onSubmit={importerEleves}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Classe cible</label>
              <select value={classeImportId} onChange={(e) => setClasseImportId(e.target.value)} required>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Fichier</label>
              <input type="file" name="fichierEleves" accept=".xlsx,.xls,.csv" required />
            </div>
          </div>
          <button className="secondaire" type="submit" disabled={importEnCours || !classeImportId}>
            {importEnCours ? 'Import en cours…' : 'Importer'}
          </button>
        </form>
        {resultatImport && (
          <div style={{ marginTop: 12 }}>
            {resultatImport.reussis.length > 0 && (
              <div className="message-succes" style={{ marginBottom: 8 }}>
                {resultatImport.reussis.length} élève(s) importé(s).
              </div>
            )}
            {resultatImport.reussis.length > 0 && (
              <table style={{ marginBottom: 8 }}>
                <thead><tr><th>Élève</th><th>E-mail</th><th>Mot de passe</th></tr></thead>
                <tbody>
                  {resultatImport.reussis.map((r, i) => (
                    <tr key={i}>
                      <td>{r.prenom} {r.nom}</td>
                      <td style={{ fontFamily: 'var(--police-mono)' }}>{r.email}</td>
                      <td style={{ fontFamily: 'var(--police-mono)' }}>{r.motDePasse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {resultatImport.echecs.length > 0 && (
              <div className="message-erreur">
                {resultatImport.echecs.length} ligne(s) ignorée(s) :
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {resultatImport.echecs.map((e, i) => <li key={i}>ligne {e.ligne} : {e.raison}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
