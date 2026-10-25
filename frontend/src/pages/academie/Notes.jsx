import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { lireFichierExcel, normaliserTexte } from '../../utils/excel';
import LegendeSeuils from '../../components/LegendeSeuils';
import { REGLES_PAR_DEFAUT, reglesEtablissement, tonNote, noteFr, saisieNoteValide } from '../../utils/seuils';

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
  const [alerteSaisie, setAlerteSaisie] = useState(false);
  const [regles, setRegles] = useState(REGLES_PAR_DEFAUT);
  useEffect(() => { client.get('/etablissement').then((res) => setRegles(reglesEtablissement(res.data.etablissement))).catch(() => {}); }, []);

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  // Changement de semestre : nouvelles UE, et l'UE et la matière choisies
  // ne valent plus.
  useEffect(() => {
    setUeId('');
    setMatiereId('');
    if (semestreId) client.get(`/unites-enseignement?semestreId=${semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
  }, [semestreId]);

  // Changement de classe : la liste suit aussitôt (pas d'anciens élèves
  // affichés pendant le chargement).
  useEffect(() => {
    setEleves([]);
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves));
  }, [classeId]);

  // Toute autre classe, UE, matière ou session : le tableau repart vide,
  // aucune valeur ne passe d'une matière ou d'une classe à l'autre.
  useEffect(() => {
    setValeurs({});
    setImportMessage('');
    setMessage('');
  }, [classeId, semestreId, ueId, matiereId, session]);
  // Les valeurs en cours de saisie ne sont pas touchées : seules les
  // listes (classes, semestres, UE, élèves) se mettent à jour.
  useActualisation(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes)).catch(() => {});
    client.get('/semestres').then((res) => setSemestres(res.data.semestres)).catch(() => {});
    if (semestreId) client.get(`/unites-enseignement?semestreId=${semestreId}`).then((res) => setUes(res.data.ues)).catch(() => {});
    if (classeId) client.get(`/eleves?classeId=${classeId}`).then((res) => setEleves(res.data.eleves)).catch(() => {});
  });

  const ueSelectionnee = ues.find((u) => String(u.id) === ueId);
  const matieres = ueSelectionnee?.Matieres || [];
  // UE ou matière supprimée entre-temps (mise à jour en direct) : sélection remise à zéro.
  useEffect(() => {
    if (ueId && ues.length && !ueSelectionnee) { setUeId(''); setMatiereId(''); }
    else if (matiereId && ueSelectionnee && !matieres.some((m) => String(m.id) === matiereId)) setMatiereId('');
  }, [ues, ueId, matiereId]);

  function valeur(eleveId, categorie) {
    return valeurs[`${eleveId}-${categorie}`] ?? '';
  }
  // Une note va de 0 à 20 : toute frappe qui en sortirait est refusée.
  function fixerValeur(eleveId, categorie, v) {
    if (!saisieNoteValide(v)) {
      setAlerteSaisie(true);
      clearTimeout(fixerValeur.minuteur);
      fixerValeur.minuteur = setTimeout(() => setAlerteSaisie(false), 2500);
      return;
    }
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
    const horsEchelle = [];
    lignes.forEach((ligne, i) => {
      const prenom = ligne.prenom || ligne.prenoms || '';
      const nom = ligne.nom || ligne.noms || '';
      const el = parNomPrenom.get(normaliserTexte(`${prenom} ${nom}`)) || parNomPrenom.get(normaliserTexte(`${nom} ${prenom}`));
      if (!el) {
        introuvables.push(`ligne ${i + 2} (${prenom} ${nom})`.trim());
        return;
      }
      const cc = String(ligne.cc ?? ligne.controlecontinu ?? ligne.moyennecc ?? '').trim();
      const examen = String(ligne.examen ?? ligne.moyenneexamen ?? '').trim();
      const ccOk = saisieNoteValide(cc);
      const examenOk = saisieNoteValide(examen);
      if (!ccOk || !examenOk) horsEchelle.push(`${el.prenom} ${el.nom}`);
      if (cc !== '' && ccOk) nouvellesValeurs[`${el.id}-cc`] = cc;
      if (examen !== '' && examenOk) nouvellesValeurs[`${el.id}-examen`] = examen;
      if (cc !== '' || examen !== '') importees += 1;
    });
    setValeurs(nouvellesValeurs);
    setImportMessage(
      `${importees} élève(s) rempli(s) depuis le fichier.` +
      (introuvables.length ? ` Non reconnus : ${introuvables.join(', ')}.` : '') +
      (horsEchelle.length ? ` Notes hors de l'échelle 0 à 20 ignorées pour : ${horsEchelle.join(', ')}.` : '') +
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
    if (notes.some((n) => !saisieNoteValide(n.valeur))) {
      setMessage("certaines notes sont hors de l'échelle 0 à 20 : corrige-les avant d'enregistrer");
      return;
    }
    setEnCours(true);
    try {
      const res = await client.post('/notes', { notes, session });
      // Enregistré : les champs se vident pour la saisie suivante.
      setValeurs({});
      setImportMessage('');
      setMessage(`${res.data.resultats.length} moyenne(s) enregistrée(s) (session ${session === 'rattrapage' ? 'de rattrapage' : 'normale'}).`);
    } catch (err) {
      setMessage(err.response?.data?.erreur || "échec de l'enregistrement");
    } finally {
      setEnCours(false);
    }
  }

  // Note finale d'une matière : (CC + Examen) / 2, ou la seule note saisie.
  function noteFinale(eleveId) {
    const lire = (cle) => { const v = valeur(eleveId, cle); const n = Number(String(v ?? '').replace(',', '.')); return v === '' || v === undefined || v === null || !Number.isFinite(n) ? null : n; };
    const cc = lire('cc'); const ex = lire('examen');
    if (cc === null && ex === null) return null;
    if (cc === null) return ex;
    if (ex === null) return cc;
    return Math.round(((cc + ex) / 2) * 100) / 100;
  }
  function comptesFinales() {
    const c = {};
    eleves.forEach((el) => { const t = tonNote(noteFinale(el.id), regles); if (t) c[t] = (c[t] || 0) + 1; });
    return Object.keys(c).length ? c : null;
  }

  return (
    <div className="carte">
      <h2>Saisie des moyennes (Académie)</h2>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Semestre</label>
            <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
              <option value="">Choisir un semestre</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>UE</label>
            <select value={ueId} onChange={(e) => { setUeId(e.target.value); setMatiereId(''); }}>
              <option value="">Choisir une UE</option>
              {ues.map((u) => <option key={u.id} value={u.id}>{u.code} : {u.intitule}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Matière</label>
            <select value={matiereId} onChange={(e) => setMatiereId(e.target.value)} disabled={!ueId}>
              <option value="">Choisir une matière</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.code} : {m.intitule}</option>)}
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
            <p>Téléverse un fichier avec les colonnes <strong>prénom</strong>, <strong>nom</strong>, <strong>cc</strong>, <strong>examen</strong>. Chaque ligne remplit automatiquement le tableau ci-dessous par correspondance de nom, sans rien saisir à la main.</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importerNotes} />
            {importMessage && <div style={{ fontSize: '0.82rem', color: 'var(--texte-clair)', marginTop: 8 }}>{importMessage}</div>}
          </div>
        )}

        {matiereId && eleves.length > 0 && (
          <div style={{ margin: '4px 0 12px' }}><LegendeSeuils regles={regles} comptes={comptesFinales()} /></div>
        )}
        {alerteSaisie && <div className="alerte-saisie-note" role="status">Une note va de 0 à 20, avec deux décimales au plus (ex. 12,5).</div>}
        {matiereId && eleves.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Moyenne CC / 20</th>
                  <th>Moyenne Examen / 20</th>
                  <th>Note finale</th>
                </tr>
              </thead>
              <tbody>
                {eleves.map((el) => (
                  <tr key={el.id}>
                    <td>{el.prenom} {el.nom}</td>
                    <td className={tonNote(valeur(el.id, 'cc'), regles) ? `note-${tonNote(valeur(el.id, 'cc'), regles)}` : ''}>
                      <input
                        type="text" inputMode="decimal" maxLength={5} placeholder="/ 20" aria-label={`Moyenne CC de ${el.prenom} ${el.nom}, sur 20`}
                        value={valeur(el.id, 'cc')}
                        onChange={(e) => fixerValeur(el.id, 'cc', e.target.value)}
                      />
                    </td>
                    <td className={tonNote(valeur(el.id, 'examen'), regles) ? `note-${tonNote(valeur(el.id, 'examen'), regles)}` : ''}>
                      <input
                        type="text" inputMode="decimal" maxLength={5} placeholder="/ 20" aria-label={`Moyenne d'examen de ${el.prenom} ${el.nom}, sur 20`}
                        value={valeur(el.id, 'examen')}
                        onChange={(e) => fixerValeur(el.id, 'examen', e.target.value)}
                      />
                    </td>
                    <td>{(() => { const f = noteFinale(el.id); const t = tonNote(f, regles); return f === null ? <span className="note-secondaire">-</span> : <span className={`badge-note ${t}`}>{noteFr(f)}</span>; })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {matiereId && eleves.length === 0 && <div className="vide">Choisis une classe pour afficher les élèves.</div>}
        {!matiereId && (
          <div className="vide">
            Choisis une UE puis une matière pour saisir des moyennes.
            <br />Une classe nombreuse ? Un import depuis un fichier Excel/CSV sera proposé juste après, pas besoin de tout saisir à la main.
          </div>
        )}

        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer les moyennes'}</button>
        {message && <div className={message.includes('enregistrée') ? 'message-succes' : 'message-erreur'}>{message}</div>}
      </form>
    </div>
  );
}
