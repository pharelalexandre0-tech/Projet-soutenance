import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel, motDePasseAleatoire } from '../../utils/excel';

const ELEVE_VIDE = { nom: '', prenom: '', classeId: '', email: '', motDePasse: '' };

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [nouvelleClasse, setNouvelleClasse] = useState({ nom: '', niveau: '' });
  const [nouvelEleve, setNouvelEleve] = useState(ELEVE_VIDE);
  const [message, setMessage] = useState('');
  const [classeImportId, setClasseImportId] = useState('');
  const [importEnCours, setImportEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState(null);

  // Les formulaires de création restent cachés par défaut — ils
  // apparaissent au clic sur leur bouton d'action, pas en permanence sous
  // la liste qu'ils encombrent sinon.
  const [classeFormOuvert, setClasseFormOuvert] = useState(false);
  const [eleveFormOuvert, setEleveFormOuvert] = useState(false);
  const [importFormOuvert, setImportFormOuvert] = useState(false);

  // Détail d'une classe (voir/modifier/supprimer) : une seule ouverte à la
  // fois, dépliée sous sa ligne — pas une page séparée, pour rester dans le
  // même geste que la liste.
  const [classeOuverte, setClasseOuverte] = useState(null);
  const [statsClasse, setStatsClasse] = useState(null);
  const [editionClasse, setEditionClasse] = useState({ nom: '', niveau: '' });
  const [erreurClasse, setErreurClasse] = useState('');

  const [filtreClasse, setFiltreClasse] = useState('');

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/eleves').then((res) => setEleves(res.data.eleves));
  }
  useEffect(charger, []);

  async function ouvrirClasse(c) {
    if (classeOuverte === c.id) { setClasseOuverte(null); return; }
    setClasseOuverte(c.id);
    setEditionClasse({ nom: c.nom, niveau: c.niveau });
    setErreurClasse('');
    setStatsClasse(null);
    const res = await client.get(`/classes/${c.id}/statistiques`);
    setStatsClasse(res.data);
  }

  async function enregistrerClasse(id) {
    setErreurClasse('');
    try {
      await client.put(`/classes/${id}`, editionClasse);
      charger();
    } catch (err) {
      setErreurClasse(err.response?.data?.erreur || 'erreur');
    }
  }

  async function supprimerClasseAction(id) {
    setErreurClasse('');
    try {
      await client.delete(`/classes/${id}`);
      setClasseOuverte(null);
      charger();
    } catch (err) {
      setErreurClasse(err.response?.data?.erreur || 'erreur');
    }
  }

  async function supprimerEleveAction(eleve) {
    if (!window.confirm(`Retirer ${eleve.prenom} ${eleve.nom} ? Son compte étudiant sera aussi supprimé.`)) return;
    await client.delete(`/eleves/${eleve.id}`);
    charger();
  }

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
    setClasseFormOuvert(false);
    charger();
  }

  async function creerEleve(e) {
    e.preventDefault();
    setMessage('');
    try {
      await client.post('/eleves', nouvelEleve);
      setMessage(`Élève ajouté, compte étudiant créé.`);
      setNouvelEleve(ELEVE_VIDE);
      setEleveFormOuvert(false);
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  const elevesAffiches = filtreClasse ? eleves.filter((e) => String(e.classeId) === filtreClasse) : eleves;

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Classes</h2>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 16 }}>
          Clique une classe pour voir son effectif, ses statistiques, la modifier ou la supprimer.
        </p>
        <table>
          <thead><tr><th>Nom</th><th>Niveau</th><th>Effectif</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <Fragment key={c.id}>
                <tr className="ligne-cliquable" onClick={() => ouvrirClasse(c)}>
                  <td>{c.nom}</td>
                  <td>{c.niveau}</td>
                  <td>{c.Eleves?.length ?? 0}</td>
                </tr>
                {classeOuverte === c.id && (
                  <tr>
                    <td colSpan={3} style={{ padding: 0 }}>
                      <div className="detail-classe">
                        {!statsClasse ? (
                          <div className="vide">Chargement…</div>
                        ) : (
                          <div className="detail-classe-stats">
                            <div className="detail-classe-chiffre">
                              <strong>{statsClasse.effectif}</strong>
                              <span>élève(s)</span>
                            </div>
                            <span className={`badge ${statsClasse.statut === 'active' ? 'vert' : 'gris'}`}>
                              {statsClasse.statut === 'active' ? 'Active' : 'Vide'}
                            </span>
                            <div className="detail-classe-chiffre">
                              <strong>{statsClasse.absences.total}</strong>
                              <span>absence(s) — {statsClasse.absences.justifiees} justifiée(s), {statsClasse.absences.nonJustifiees} non justifiée(s)</span>
                            </div>
                          </div>
                        )}
                        <div className="ligne-champs" style={{ marginTop: 14 }}>
                          <div className="champ">
                            <label>Nom</label>
                            <input value={editionClasse.nom} onChange={(e) => setEditionClasse({ ...editionClasse, nom: e.target.value })} />
                          </div>
                          <div className="champ">
                            <label>Niveau</label>
                            <input value={editionClasse.niveau} onChange={(e) => setEditionClasse({ ...editionClasse, niveau: e.target.value })} />
                          </div>
                        </div>
                        {erreurClasse && <div className="message-erreur" style={{ marginTop: 10 }}>{erreurClasse}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="secondaire" onClick={() => enregistrerClasse(c.id)}>Enregistrer</button>
                          <button className="secondaire danger" onClick={() => supprimerClasseAction(c.id)}>Supprimer</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {classes.length === 0 && <tr><td colSpan={3} className="vide">Aucune classe</td></tr>}
          </tbody>
        </table>
        <div className="entete-section">
          <h3>Créer une classe</h3>
          <button type="button" className={classeFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setClasseFormOuvert((v) => !v)}>
            {classeFormOuvert ? 'Annuler' : '+ Nouvelle classe'}
          </button>
        </div>
        {classeFormOuvert && (
          <form className="formulaire" onSubmit={creerClasse}>
            <div className="ligne-champs">
              <div className="champ">
                <label>Nom</label>
                <input value={nouvelleClasse.nom} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, nom: e.target.value })} required autoFocus />
              </div>
              <div className="champ">
                <label>Niveau</label>
                <input value={nouvelleClasse.niveau} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, niveau: e.target.value })} required />
              </div>
            </div>
            <button className="primaire" type="submit">Ajouter la classe</button>
          </form>
        )}
      </div>

      <div className="carte">
        <h2>Élèves</h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Liste ({elevesAffiches.length})</h3>
          <select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>Élève</th><th>Classe</th><th></th></tr></thead>
          <tbody>
            {elevesAffiches.map((e) => (
              <tr key={e.id}>
                <td>{e.prenom} {e.nom}</td>
                <td>{e.Classe?.nom ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="secondaire danger" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => supprimerEleveAction(e)}>
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
            {elevesAffiches.length === 0 && <tr><td colSpan={3} className="vide">Aucun élève</td></tr>}
          </tbody>
        </table>

        <div className="entete-section" style={{ marginTop: 22 }}>
          <h3>Inscrire un élève</h3>
          <button type="button" className={eleveFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setEleveFormOuvert((v) => !v)}>
            {eleveFormOuvert ? 'Annuler' : '+ Inscrire un élève'}
          </button>
        </div>
        {eleveFormOuvert && (
          <form className="formulaire" onSubmit={creerEleve} autoComplete="off">
            <div className="ligne-champs">
              <div className="champ">
                <label>Prénom</label>
                <input value={nouvelEleve.prenom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, prenom: e.target.value })} required autoFocus />
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
              <div className="champ">
                <label>E-mail (compte étudiant)</label>
                <input type="email" autoComplete="off" value={nouvelEleve.email} onChange={(e) => setNouvelEleve({ ...nouvelEleve, email: e.target.value })} required />
              </div>
            </div>
            <div className="ligne-champs">
              <div className="champ" style={{ flex: 1 }}>
                <label>Mot de passe (compte étudiant)</label>
                <input type="password" autoComplete="new-password" value={nouvelEleve.motDePasse} onChange={(e) => setNouvelEleve({ ...nouvelEleve, motDePasse: e.target.value })} minLength={6} required />
              </div>
              <button
                type="button" className="secondaire"
                style={{ alignSelf: 'flex-end', marginBottom: 1 }}
                onClick={() => setNouvelEleve({ ...nouvelEleve, motDePasse: motDePasseAleatoire() })}
              >
                Générer
              </button>
            </div>
            <button className="primaire" type="submit">Inscrire l'élève</button>
            {message && <div className={message.includes('ajouté') ? 'message-succes' : 'message-erreur'}>{message}</div>}
          </form>
        )}

        <div className="entete-section" style={{ marginTop: 18 }}>
          <h3>Importer une liste (Excel/CSV)</h3>
          <button type="button" className={importFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setImportFormOuvert((v) => !v)}>
            {importFormOuvert ? 'Annuler' : '+ Importer un fichier'}
          </button>
        </div>
        {importFormOuvert && (
          <>
            <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -4, marginBottom: 14 }}>
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
          </>
        )}
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
