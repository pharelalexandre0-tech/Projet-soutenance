import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import ConfirmModal from './ConfirmModal';
import { IconSend, IconDownload, IconSearch, IconUsers } from './icons';
import { enregistrerFichier, nomDepuisEntete, erreurBlob } from '../utils/fichier';
import { messageErreur } from '../utils/erreurs';

export const DOCUMENTS_LOT = [
  { cle: 'bulletin', libelle: 'Bulletins', semestre: true },
  { cle: 'releve', libelle: 'Relevés de notes', semestre: false },
  { cle: 'attestation_scolarite', libelle: 'Certificats de scolarité', semestre: false },
  { cle: 'attestation_inscription', libelle: 'Attestations d’inscription', semestre: false },
  { cle: 'attestation_reussite', libelle: 'Attestations de réussite', semestre: true },
];

const STATUTS = { envoye: ['vert', 'Envoyé'], ignore: ['or', 'Non envoyé'], echec: ['rouge', 'Échec'] };

// Envoi groupé : l'Académie choisit le document, la classe, coche les
// étudiants (ou toute la classe d'un clic) puis envoie par e-mail à chacun
// et à son parent, ou télécharge tout en une archive ZIP.
export default function EnvoiGroupe({ documentInitial = 'bulletin', titre = 'Envoi groupé de documents' }) {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [form, setForm] = useState({ document: documentInitial, classeId: '', semestreId: '' });
  const [eleves, setEleves] = useState([]);
  const [choisis, setChoisis] = useState(new Set());
  const [recherche, setRecherche] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [zipEnCours, setZipEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const minuteur = useRef(null);

  const def = DOCUMENTS_LOT.find((d) => d.cle === form.document);

  function chargerBase() {
    client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {});
    client.get('/semestres').then((r) => {
      setSemestres(r.data.semestres);
      setForm((f) => (f.semestreId || !r.data.semestres[0] ? f : { ...f, semestreId: String(r.data.semestres[0].id) }));
    }).catch(() => {});
    client.get('/documents/lots').then((r) => setHistorique(r.data.envois)).catch(() => {});
  }
  useEffect(() => { chargerBase(); }, []);
  useActualisation(chargerBase, { domaines: ['classes', 'semestres', 'eleves'] });

  useEffect(() => {
    setChoisis(new Set());
    if (!form.classeId) { setEleves([]); return; }
    client.get(`/eleves?classeId=${form.classeId}`).then((r) => {
      const liste = [...r.data.eleves].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
      setEleves(liste);
      setChoisis(new Set(liste.map((e) => e.id)));
    }).catch(() => setEleves([]));
  }, [form.classeId]);

  // Suivi de l'envoi en cours.
  useEffect(() => {
    if (!envoi || envoi.statut === 'termine') return undefined;
    minuteur.current = setTimeout(async () => {
      const r = await client.get(`/documents/lots/${envoi.id}`).catch(() => null);
      if (r) {
        setEnvoi(r.data.envoi);
        if (r.data.envoi.statut === 'termine') client.get('/documents/lots').then((h) => setHistorique(h.data.envois)).catch(() => {});
      }
    }, 1500);
    return () => clearTimeout(minuteur.current);
  }, [envoi]);

  const q = recherche.trim().toLowerCase();
  const affiches = useMemo(() => eleves.filter((e) => !q || `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(q)), [eleves, q]);
  const tousAffichesCoches = affiches.length > 0 && affiches.every((e) => choisis.has(e.id));
  const sansAdresse = eleves.filter((e) => choisis.has(e.id) && !e.compteEtudiant?.email && !e.emailParent).length;

  function basculer(id) {
    setChoisis((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function basculerTous() {
    setChoisis((s) => {
      const n = new Set(s);
      affiches.forEach((e) => (tousAffichesCoches ? n.delete(e.id) : n.add(e.id)));
      return n;
    });
  }

  const corps = () => ({ document: form.document, semestreId: def.semestre ? form.semestreId : undefined, eleveIds: [...choisis] });
  const pret = choisis.size > 0 && (!def.semestre || form.semestreId);

  async function telecharger() {
    setZipEnCours(true);
    setMessage(null);
    try {
      const res = await client.post('/documents/lot/telecharger', corps(), { responseType: 'blob' });
      await enregistrerFichier(res.data, nomDepuisEntete(res, 'documents.zip'));
      setMessage({ type: 'succes', texte: 'Archive téléchargée. Les étudiants sans document (par exemple sans notes) sont listés dans « a-lire.txt ».' });
    } catch (err) {
      setMessage({ type: 'erreur', texte: await erreurBlob(err, 'téléchargement impossible') });
    } finally {
      setZipEnCours(false);
    }
  }

  async function lancerEnvoi() {
    const r = await client.post('/documents/lot/envoyer', corps());
    setEnvoi(r.data.envoi);
    setConfirmer(false);
    setMessage(null);
  }

  const classe = classes.find((c) => String(c.id) === form.classeId);
  const pourcentage = envoi ? Math.round((envoi.traites / Math.max(1, envoi.total)) * 100) : 0;

  return (
    <section className="carte envoi-groupe">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconUsers width={16} height={16} /></span>
          <h2>{titre}</h2>
        </div>
      </div>
      <p className="note-secondaire" style={{ marginTop: -6 }}>Choisissez le document et la classe : toute la classe est cochée, décochez ceux qui ne doivent pas recevoir le document. Chaque étudiant reçoit le sien par e-mail, avec copie à son parent.</p>

      <div className="ligne-champs">
        <div className="champ"><label htmlFor="lot-doc">Document</label>
          <select id="lot-doc" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })}>
            {DOCUMENTS_LOT.map((d) => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
          </select>
        </div>
        <div className="champ"><label htmlFor="lot-classe">Classe</label>
          <select id="lot-classe" value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
            <option value="">Choisir une classe</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
        </div>
        {def.semestre && (
          <div className="champ"><label htmlFor="lot-sem">Semestre</label>
            <select id="lot-sem" value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })}>
              <option value="">Choisir un semestre</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
            </select>
          </div>
        )}
      </div>

      {form.classeId && (
        <>
          <div className="barre-outils envoi-groupe-barre">
            <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Nom, prénom ou matricule…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un étudiant" /></label>
            <span className="badge bleu">{choisis.size} sur {eleves.length} sélectionné{choisis.size > 1 ? 's' : ''}</span>
            <button type="button" className="bouton-texte" onClick={() => setChoisis(new Set(eleves.map((e) => e.id)))}>Toute la classe</button>
            <button type="button" className="bouton-texte" onClick={() => setChoisis(new Set())}>Aucun</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}><input type="checkbox" aria-label="Tout cocher" checked={tousAffichesCoches} onChange={basculerTous} /></th>
                  <th>Nom</th><th>Prénom</th><th>Matricule</th><th>E-mail</th>
                </tr>
              </thead>
              <tbody>
                {affiches.map((e) => (
                  <tr key={e.id} className="ligne-cliquable" onClick={() => basculer(e.id)}>
                    <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${e.prenom} ${e.nom}`} checked={choisis.has(e.id)} onChange={() => basculer(e.id)} /></td>
                    <td className="cellule-nom">{String(e.nom).toUpperCase()}</td>
                    <td>{e.prenom}</td>
                    <td className="mono">{e.matricule || ''}</td>
                    <td>{e.compteEtudiant?.email || e.emailParent ? <span className="badge vert">Oui</span> : <span className="badge or">Aucune adresse</span>}</td>
                  </tr>
                ))}
                {affiches.length === 0 && <tr><td colSpan={5} className="vide">Aucun étudiant.</td></tr>}
              </tbody>
            </table>
          </div>
          {sansAdresse > 0 && <p className="note-secondaire" style={{ margin: '8px 0 0' }}>{sansAdresse} étudiant(s) sélectionné(s) sans adresse e-mail : ils seront signalés « non envoyé ». Le téléchargement ZIP les inclut.</p>}
          <div className="envoi-groupe-actions">
            <button type="button" className="primaire" disabled={!pret || (envoi && envoi.statut !== 'termine')} onClick={() => setConfirmer(true)}>
              <IconSend width={16} height={16} /> Envoyer par e-mail ({choisis.size})
            </button>
            <button type="button" className="secondaire" disabled={!pret || zipEnCours} onClick={telecharger}>
              <IconDownload width={16} height={16} /> {zipEnCours ? 'Préparation…' : `Télécharger en ZIP (${choisis.size})`}
            </button>
          </div>
        </>
      )}
      {message && <div className={message.type === 'succes' ? 'message-succes' : 'message-erreur'} style={{ marginTop: 12 }}>{message.texte}</div>}

      {envoi && (
        <div className="envoi-groupe-suivi" aria-live="polite">
          <div className="envoi-groupe-suivi-tete">
            <strong>{envoi.libelle}</strong>
            <span>{envoi.statut === 'termine' ? 'Terminé' : `Envoi en cours… ${envoi.traites} / ${envoi.total}`}</span>
          </div>
          <div className="barre-progression"><span style={{ width: `${pourcentage}%` }} /></div>
          <p className="note-secondaire" style={{ margin: 0 }}>{envoi.envoyes} envoyé(s), {envoi.echecs} non envoyé(s).</p>
          {envoi.details?.some((d) => d.statut !== 'envoye') && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Étudiant</th><th>Résultat</th><th>Détail</th></tr></thead>
                <tbody>
                  {envoi.details.filter((d) => d.statut !== 'envoye').map((d) => (
                    <tr key={d.eleveId}><td className="cellule-nom">{d.nom}</td><td><span className={`badge ${STATUTS[d.statut][0]}`}>{STATUTS[d.statut][1]}</span></td><td>{d.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {historique.length > 0 && (
        <details className="envoi-groupe-historique">
          <summary>Derniers envois groupés ({historique.length})</summary>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Document</th><th className="chiffre">Envoyés</th><th className="chiffre">Non envoyés</th><th>État</th></tr></thead>
              <tbody>
                {historique.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="cellule-nom">{h.libelle}</td>
                    <td className="chiffre">{h.envoyes}</td>
                    <td className="chiffre">{h.echecs}</td>
                    <td>{h.statut === 'termine' ? <span className="badge vert">Terminé</span> : <span className="badge bleu">En cours</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {confirmer && (
        <ConfirmModal
          titre="Confirmer l’envoi groupé"
          boutonConfirmer={`Envoyer à ${choisis.size} étudiant${choisis.size > 1 ? 's' : ''}`}
          boutonEnCours="Lancement…"
          onConfirmer={lancerEnvoi}
          onAnnuler={() => setConfirmer(false)}
        >
          <p>{def.libelle}{def.semestre ? ` du ${semestres.find((s) => String(s.id) === form.semestreId)?.libelle || ''}` : ''} pour {choisis.size} étudiant{choisis.size > 1 ? 's' : ''} de {classe?.nom}. Chacun reçoit son document par e-mail, avec copie à son parent.</p>
        </ConfirmModal>
      )}
    </section>
  );
}

// Procès-verbaux des résultats de plusieurs classes en une archive.
export function PvPlusieursClasses() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [semestreId, setSemestreId] = useState('');
  const [choisies, setChoisies] = useState(new Set());
  const [enCours, setEnCours] = useState('');
  const [erreur, setErreur] = useState('');

  function charger() {
    client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {});
    client.get('/semestres').then((r) => { setSemestres(r.data.semestres); setSemestreId((s) => s || String(r.data.semestres[0]?.id || '')); }).catch(() => {});
  }
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['classes', 'semestres'] });

  async function telecharger(format) {
    setEnCours(format);
    setErreur('');
    try {
      const res = await client.post('/documents/lot/proces-verbaux', { semestreId, classeIds: [...choisies], format }, { responseType: 'blob' });
      await enregistrerFichier(res.data, nomDepuisEntete(res, 'proces-verbaux.zip'));
    } catch (err) {
      setErreur(await erreurBlob(err, messageErreur(err, 'téléchargement impossible')));
    } finally {
      setEnCours('');
    }
  }

  const toutes = classes.length > 0 && classes.every((c) => choisies.has(c.id));
  return (
    <section className="carte">
      <div className="entete-carte"><h2>Procès-verbaux de plusieurs classes</h2></div>
      <p className="note-secondaire" style={{ marginTop: -6 }}>Cochez les classes : un procès-verbal des résultats par classe, réunis dans une archive ZIP.</p>
      <div className="ligne-champs">
        <div className="champ" style={{ maxWidth: 320 }}><label htmlFor="pvl-sem">Semestre</label>
          <select id="pvl-sem" value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
            <option value="">Choisir un semestre</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
      </div>
      <div className="liste-cases">
        <label className="case-a-cocher forte"><input type="checkbox" checked={toutes} onChange={() => setChoisies(toutes ? new Set() : new Set(classes.map((c) => c.id)))} /> Toutes les classes</label>
        {classes.map((c) => (
          <label key={c.id} className="case-a-cocher">
            <input type="checkbox" checked={choisies.has(c.id)} onChange={() => setChoisies((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
            {c.nom} <span className="note-secondaire">({c.niveau})</span>
          </label>
        ))}
      </div>
      {erreur && <div className="message-erreur" style={{ marginTop: 10 }}>{erreur}</div>}
      <div className="envoi-groupe-actions">
        <button type="button" className="primaire" disabled={!semestreId || !choisies.size || enCours} onClick={() => telecharger('pdf')}><IconDownload width={16} height={16} /> {enCours === 'pdf' ? 'Préparation…' : `PDF en ZIP (${choisies.size})`}</button>
        <button type="button" className="secondaire" disabled={!semestreId || !choisies.size || enCours} onClick={() => telecharger('xlsx')}><IconDownload width={16} height={16} /> {enCours === 'xlsx' ? 'Préparation…' : 'Excel en ZIP'}</button>
      </div>
    </section>
  );
}
