import { useEffect, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel, normaliserTexte } from '../../utils/excel';

// Diagramme 4 (cas nominal) : l'Académie saisit, par matière, la moyenne de
// contrôle continu et la moyenne d'examen de chaque élève — pas note par
// note — pour en tirer la note finale de la matière.
export default function Notes() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [ueId, setUeId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [session, setSession] = useState('normale');
  const [eleves, setEleves] = useState([]);
  const [valeurs, setValeurs] = useState({});
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  useEffect(() => {
    if (semestreId) client.get(`/unites-enseignement?semestreId=${semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
    setUeId('');
  }, [semestreId]);

  useEffect(() => {
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves));
    else setEleves([]);
  }, [classeId]);

  const ueSelectionnee = ues.find((u) => String(u.id) === ueId);
  const matieres = ueSelectionnee?.Matieres || [];

  function valeur(eleveId, categorie) {
    return valeurs[`${eleveId}-${categorie}`] ?? '';
  }
  function fixerValeur(eleveId, categorie, v) {
    setValeurs({ ...valeurs, [`${eleveId}-${categorie}`]: v });
  }

  // Un enseignant hors du système envoie ses moyennes dans son propre
  // tableur — pas d'identifiant technique, juste un nom et un prénom. On
  // retrouve l'élève par nom+prénom (dans les deux sens, au cas où les
  // colonnes soient inversées) parmi les élèves déjà chargés pour la
  // classe choisie, puis on remplit le tableau de saisie exactement comme
  // une saisie manuelle — rien n'est enregistré tant que l'Académie n'a
  // pas vérifié et cliqué sur "Enregistrer les moyennes".
  async function importerNotes(e) {
    setImportMessage('');
    const fichier = e.target.files[0];
    if (!fichier || eleves.length === 0) return;

    const parNomPrenom = new Map();
    eleves.forEach((el) => {
      parNomPrenom.set(normaliserTexte(`${el.prenom} ${el.nom}`), el);
      parNomPrenom.set(normaliserTexte(`${el.nom} ${el.prenom}`), el);
    });

    const lignes = await lireFichierExcel(fichier);
    const nouvellesValeurs = { ...valeurs };
    let importees = 0;
    const introuvables = [];
    lignes.forEach((ligne, i) => {
      const prenom = ligne.prenom || ligne.prenoms || '';
      const nom = ligne.nom || ligne.noms || '';
      const el = parNomPrenom.get(normaliserTexte(`${prenom} ${nom}`)) || parNomPrenom.get(normaliserTexte(`${nom} ${prenom}`));
      if (!el) {
        introuvables.push(`ligne ${i + 2} (${prenom} ${nom})`.trim());
        return;
      }
      const cc = ligne.cc ?? ligne.controlecontinu ?? ligne.moyennecc ?? '';
      const examen = ligne.examen ?? ligne.moyenneexamen ?? '';
      if (cc !== '') nouvellesValeurs[`${el.id}-cc`] = cc;
      if (examen !== '') nouvellesValeurs[`${el.id}-examen`] = examen;
      if (cc !== '' || examen !== '') importees += 1;
    });
    setValeurs(nouvellesValeurs);
    setImportMessage(
      `${importees} élève(s) rempli(s) depuis le fichier.` +
      (introuvables.length ? ` Non reconnus : ${introuvables.join(', ')}.` : '') +
      ' Vérifie les valeurs puis enregistre.'
    );
    e.target.value = '';
  }

  async function enregistrer(e) {
    e.preventDefault();
    setMessage('');
    if (!matiereId) {
      setMessage('sélectionne une matière');
      return;
    }
    const notes = [];
    eleves.forEach((el) => {
      const cc = valeur(el.id, 'cc');
      const examen = valeur(el.id, 'examen');
      if (cc !== '') notes.push({ eleveId: el.id, matiereId: Number(matiereId), categorie: 'cc', valeur: cc });
      if (examen !== '') notes.push({ eleveId: el.id, matiereId: Number(matiereId), categorie: 'examen', valeur: examen });
    });
    if (notes.length === 0) {
      setMessage('saisis au moins une moyenne');
      return;
    }
    setEnCours(true);
    try {
      const res = await client.post('/notes', { notes, session });
      setMessage(`${res.data.resultats.length} moyenne(s) enregistrée(s) (session ${session === 'rattrapage' ? 'de rattrapage' : 'normale'}).`);
    } catch (err) {
      setMessage(err.response?.data?.erreur || "échec de l'enregistrement");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Saisie des moyennes (Académie)</h2>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Semestre</label>
            <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
              <option value="">—</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>UE</label>
            <select value={ueId} onChange={(e) => { setUeId(e.target.value); setMatiereId(''); }}>
              <option value="">—</option>
              {ues.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.intitule}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Matière</label>
            <select value={matiereId} onChange={(e) => setMatiereId(e.target.value)} disabled={!ueId}>
              <option value="">—</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.intitule}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="normale">Normale</option>
              <option value="rattrapage">Rattrapage</option>
            </select>
          </div>
        </div>
        {session === 'rattrapage' && (
          <div className="message-erreur" style={{ marginTop: -4 }}>
            Session de rattrapage : ces moyennes ne remplacent la session normale que si elles sont meilleures.
          </div>
        )}

        {matiereId && eleves.length > 0 && (
          <div className="encart-import">
            <div className="encart-import-titre">Import rapide (recommandé pour une classe nombreuse)</div>
            <p>Téléverse un fichier avec les colonnes <strong>prénom</strong>, <strong>nom</strong>, <strong>cc</strong>, <strong>examen</strong> — chaque ligne remplit automatiquement le tableau ci-dessous par correspondance de nom, sans rien saisir à la main.</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importerNotes} />
            {importMessage && <div style={{ fontSize: '0.82rem', color: 'var(--texte-clair)', marginTop: 8 }}>{importMessage}</div>}
          </div>
        )}

        {matiereId && eleves.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Moyenne CC / 20</th>
                <th>Moyenne Examen / 20</th>
              </tr>
            </thead>
            <tbody>
              {eleves.map((el) => (
                <tr key={el.id}>
                  <td>{el.prenom} {el.nom}</td>
                  <td>
                    <input
                      type="number" min="0" max="20" step="0.25" placeholder="/ 20"
                      value={valeur(el.id, 'cc')}
                      onChange={(e) => fixerValeur(el.id, 'cc', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" max="20" step="0.25" placeholder="/ 20"
                      value={valeur(el.id, 'examen')}
                      onChange={(e) => fixerValeur(el.id, 'examen', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {matiereId && eleves.length === 0 && <div className="vide">Choisis une classe pour afficher les élèves.</div>}
        {!matiereId && (
          <div className="vide">
            Choisis une UE puis une matière pour saisir des moyennes.
            <br />Une classe nombreuse ? Un import depuis un fichier Excel/CSV sera proposé juste après — pas besoin de tout saisir à la main.
          </div>
        )}

        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer les moyennes'}</button>
        {message && <div className={message.includes('enregistrée') ? 'message-succes' : 'message-erreur'}>{message}</div>}
      </form>
    </div>
  );
}
