import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import BoutonDocument from '../../components/BoutonDocument';
import { messageErreur } from '../../utils/erreurs';
import { IconDownload, IconPlus } from '../../components/icons';

// Modules LMD de l'Académie : préinscriptions, anonymat des copies,
// mémoires et soutenances, diplômes, transferts de crédits.

const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const fr = (n) => (n == null ? '-' : String(Math.round(n * 100) / 100).replace('.', ','));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

function useListes() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  useEffect(() => {
    client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {});
    client.get('/eleves').then((r) => setEleves(r.data.eleves)).catch(() => {});
  }, []);
  return { classes, eleves };
}

function ChoixEtudiant({ eleves, valeur, onChange, id = 'choix-etudiant' }) {
  const [filtre, setFiltre] = useState('');
  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return eleves.filter((e) => !f || `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(f)).slice(0, 200);
  }, [eleves, filtre]);
  return (
    <div className="ligne-champs">
      <div className="champ"><label htmlFor={`${id}-f`}>Rechercher</label><input id={`${id}-f`} placeholder="Nom ou matricule" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></div>
      <div className="champ"><label htmlFor={id}>Étudiant</label>
        <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)} required>
          <option value="">Choisir un étudiant</option>
          {visibles.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom} ({e.matricule})</option>)}
        </select>
      </div>
    </div>
  );
}

// ========================================================================== Préinscriptions
const STATUTS_PRE = { deposee: ['Déposé', 'bleu'], en_examen: ['En examen', 'or'], acceptee: ['Accepté', 'vert'], refusee: ['Refusé', 'rouge'], inscrite: ['Inscrit', 'gris'] };
const PIECES = { identite: 'Pièce d’identité', diplome: 'Diplôme', releve: 'Relevé', photo: 'Photo', autre: 'Autre' };

export function Preinscriptions() {
  const [donnees, setDonnees] = useState(null);
  const [filtre, setFiltre] = useState('tous');
  const [ouvert, setOuvert] = useState(null);
  const [toast, setToast] = useState(null);
  const { classes } = useListes();
  const charger = () => client.get('/preinscriptions').then((r) => setDonnees(r.data)).catch(() => setDonnees({ dossiers: [], formations: [] }));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['preinscriptions', 'preinscriptions-publiques'] });
  if (!donnees) return <div className="chargement">Chargement…</div>;
  const formation = (id) => donnees.formations.find((f) => f.id === id);
  const liste = donnees.dossiers.filter((d) => filtre === 'tous' || d.statut === filtre);
  const lien = `${window.location.origin}/preinscription`;
  return (
    <>
      <div className="encart-info" style={{ marginBottom: 16 }}><span>Lien à diffuser aux candidats : <strong>{lien}</strong></span></div>
      <section className="carte">
        <div className="entete-carte">
          <h2>Dossiers de préinscription <span className="entete-carte-compteur">{donnees.dossiers.length}</span></h2>
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
            <option value="tous">Tous les dossiers</option>
            {Object.entries(STATUTS_PRE).map(([v, [t]]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        {liste.length === 0 ? <div className="vide">Aucun dossier.</div> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Numéro</th><th>Déposé le</th><th>Candidat</th><th>Niveau demandé</th><th>Formation</th><th>Diplôme d’accès</th><th className="cellule-nombre">Pièces</th><th>Statut</th><th aria-label="Ouvrir" /></tr></thead>
            <tbody>{liste.map((d) => {
              const f = formation(d.formationId);
              return (
                <tr key={d.id}>
                  <td className="mono">{d.numero}</td><td>{dateFr(d.createdAt)}</td><td className="cellule-nom">{d.nom} {d.prenom}</td><td>{d.niveauDemande}</td>
                  <td>{f ? [f.mention, f.parcours].filter(Boolean).join(', ') : ''}</td><td>{d.diplomeAcces || ''}</td><td className="cellule-nombre">{d.pieces.length}</td>
                  <td><span className={`badge ${STATUTS_PRE[d.statut][1]}`}>{STATUTS_PRE[d.statut][0]}</span></td>
                  <td className="cellule-actions"><button type="button" className="secondaire" onClick={() => setOuvert(d)}>Examiner</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
      {ouvert && <DossierCandidat dossier={ouvert} classes={classes} onFermer={() => setOuvert(null)} onFait={(m) => { setOuvert(null); setToast({ message: m, type: 'succes' }); charger(); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function DossierCandidat({ dossier: d, classes, onFermer, onFait }) {
  const [commentaire, setCommentaire] = useState(d.commentaire || '');
  const [classeId, setClasseId] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  async function decider(statut) {
    setEnCours(true); setErreur('');
    try { await client.put(`/preinscriptions/${d.id}`, { statut, commentaire }); onFait(statut === 'acceptee' ? 'Dossier accepté : le candidat est prévenu par e-mail.' : statut === 'refusee' ? 'Dossier refusé : le candidat est prévenu par e-mail.' : 'Dossier mis en examen.'); }
    catch (err) { setErreur(messageErreur(err, 'action impossible')); setEnCours(false); }
  }
  async function inscrire() {
    setEnCours(true); setErreur('');
    try { await client.post(`/preinscriptions/${d.id}/inscrire`, { classeId }); onFait(`${d.prenom} ${d.nom} est inscrit(e) : compte étudiant et matricule créés.`); }
    catch (err) { setErreur(messageErreur(err, 'inscription impossible')); setEnCours(false); }
  }
  return (
    <Modal titre={`Dossier ${d.numero}`} onFermer={onFermer} largeur={720}>
      <div className="formulaire">
        <dl className="fiche-dossier">
          <div><dt>Candidat</dt><dd>{d.prenom} {d.nom}{d.sexe ? ` (${d.sexe})` : ''}</dd></div>
          <div><dt>Naissance</dt><dd>{dateFr(d.dateNaissance) || '-'}</dd></div>
          <div><dt>E-mail</dt><dd>{d.email}</dd></div>
          <div><dt>Téléphone</dt><dd>{d.telephone || '-'}</dd></div>
          <div><dt>Nationalité</dt><dd>{d.nationalite || '-'}</dd></div>
          <div><dt>Niveau demandé</dt><dd>{d.niveauDemande}</dd></div>
          <div><dt>Diplôme d’accès</dt><dd>{[d.diplomeAcces, d.anneeDiplome, d.mentionDiplome].filter(Boolean).join(', ') || '-'}</dd></div>
          <div><dt>Établissement d’origine</dt><dd>{d.etablissementOrigine || '-'}</dd></div>
        </dl>
        {d.pieces.length > 0 && <div className="puces">{d.pieces.map((p) => <BoutonDocument key={p.id} className="secondaire" chemin={`/api/preinscriptions/pieces/${p.id}`} nomFichier={p.nomFichier}><IconDownload width={14} height={14} /> {PIECES[p.type]}</BoutonDocument>)}</div>}
        <div className="champ"><label htmlFor="pre-com">Message au candidat (facultatif)</label><textarea id="pre-com" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></div>
        {d.statut === 'acceptee' && (
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pre-classe">Classe d’inscription</label><select id="pre-classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}><option value="">Choisir une classe</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}</select></div>
            <button type="button" className="primaire" disabled={!classeId || enCours} onClick={inscrire} style={{ alignSelf: 'flex-end' }}>Inscrire l’étudiant</button>
          </div>
        )}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions separees">
          <button type="button" className="secondaire" onClick={onFermer}>Fermer</button>
          {d.statut !== 'inscrite' && (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="secondaire" disabled={enCours} onClick={() => decider('en_examen')}>Mettre en examen</button>
              <button type="button" className="secondaire danger" disabled={enCours} onClick={() => decider('refusee')}>Refuser</button>
              <button type="button" className="primaire" disabled={enCours} onClick={() => decider('acceptee')}>Accepter</button>
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ========================================================================== Anonymat
export function Anonymat() {
  const { classes } = useListes();
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [choix, setChoix] = useState({ classeId: '', semestreId: '', matiereId: '', session: 'normale' });
  const [donnees, setDonnees] = useState(null);
  const [notes, setNotes] = useState({});
  const [correspondance, setCorrespondance] = useState(false);
  const [lever, setLever] = useState(false);
  const [toast, setToast] = useState(null);
  useEffect(() => { client.get('/semestres').then((r) => setSemestres(r.data.semestres)).catch(() => {}); }, []);
  useEffect(() => { if (choix.semestreId) client.get(`/unites-enseignement?semestreId=${choix.semestreId}${choix.classeId ? `&classeId=${choix.classeId}` : ''}`).then((r) => setUes(r.data.ues)).catch(() => {}); }, [choix.semestreId, choix.classeId]);
  const charger = () => {
    if (!choix.matiereId) { setDonnees(null); return; }
    client.get(`/anonymat?matiereId=${choix.matiereId}&session=${choix.session}${correspondance ? '&correspondance=1' : ''}`).then((r) => setDonnees(r.data)).catch(() => setDonnees(null));
  };
  useEffect(charger, [choix.matiereId, choix.session, correspondance]);
  const maj = (k) => (e) => setChoix({ ...choix, [k]: e.target.value, ...(k === 'semestreId' ? { matiereId: '' } : {}) });
  async function generer() {
    const r = await client.post('/anonymat', choix);
    setToast({ message: `${r.data.crees} numéro(s) d’anonymat attribué(s).`, type: 'succes' });
    charger();
  }
  async function enregistrer() {
    const r = await client.post('/anonymat/notes', { ...choix, notes: Object.entries(notes).map(([numero, valeur]) => ({ numero, valeur })) });
    setToast({ message: `${r.data.enregistrees} note(s) d’examen enregistrée(s) par numéro.`, type: 'succes' });
    setNotes({});
    charger();
  }
  async function confirmerLever() {
    await client.post('/anonymat/lever', choix);
    setLever(false);
    setToast({ message: 'Anonymat levé : les noms sont maintenant visibles.', type: 'succes' });
    charger();
  }
  function exporter() {
    const lignes = [['Numéro', 'Nom', 'Prénom', 'Matricule'], ...donnees.lignes.map((l) => [l.numero, l.eleve?.nom, l.eleve?.prenom, l.eleve?.matricule])];
    const csv = `﻿${lignes.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'correspondance-anonymat.csv';
    a.click();
  }
  const matieres = ues.flatMap((u) => (u.Matieres || []).map((m) => ({ ...m, ue: u.code })));
  return (
    <>
      <section className="carte">
        <h2>Examen à anonymiser</h2>
        <div className="ligne-champs">
          <div className="champ"><label>Classe</label><select value={choix.classeId} onChange={maj('classeId')}><option value="">Choisir</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
          <div className="champ"><label>Semestre</label><select value={choix.semestreId} onChange={maj('semestreId')}><option value="">Choisir</option>{semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}</select></div>
          <div className="champ"><label>Matière</label><select value={choix.matiereId} onChange={maj('matiereId')}><option value="">Choisir</option>{matieres.map((m) => <option key={m.id} value={m.id}>{m.code} : {m.intitule}</option>)}</select></div>
          <div className="champ" style={{ maxWidth: 160 }}><label>Session</label><select value={choix.session} onChange={maj('session')}><option value="normale">Normale</option><option value="rattrapage">Rattrapage</option></select></div>
        </div>
        {choix.matiereId && choix.classeId && <button type="button" className="secondaire" onClick={generer}><IconPlus /> Attribuer les numéros d’anonymat</button>}
      </section>
      {donnees && (
        <section className="carte">
          <div className="entete-carte">
            <h2>Copies <span className="entete-carte-compteur">{donnees.lignes.length}</span> {donnees.leve ? <span className="badge vert">Anonymat levé</span> : <span className="badge or">Anonyme</span>}</h2>
            <div className="actions-entete">
              {!donnees.leve && <label className="case-confirmation"><input type="checkbox" checked={correspondance} onChange={(e) => setCorrespondance(e.target.checked)} /> Afficher la correspondance (scolarité seulement)</label>}
              {(correspondance || donnees.leve) && <button type="button" className="secondaire" onClick={exporter}><IconDownload /> Correspondance</button>}
              {!donnees.leve && <button type="button" className="secondaire" onClick={() => setLever(true)}>Lever l’anonymat</button>}
            </div>
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Numéro d’anonymat</th>{(correspondance || donnees.leve) && <th>Étudiant</th>}<th className="cellule-nombre">Note d’examen enregistrée</th><th>Nouvelle note d’examen / 20</th></tr></thead>
            <tbody>{donnees.lignes.map((l) => (
              <tr key={l.numero}>
                <td className="mono">{l.numero}</td>
                {(correspondance || donnees.leve) && <td>{l.eleve ? `${l.eleve.nom} ${l.eleve.prenom}` : ''}</td>}
                <td className="cellule-nombre">{fr(l.moyenneExamen)}</td>
                <td><input type="text" inputMode="decimal" maxLength={5} aria-label={`Note de la copie ${l.numero}`} value={notes[l.numero] ?? ''} onChange={(e) => setNotes({ ...notes, [l.numero]: e.target.value })} /></td>
              </tr>
            ))}</tbody>
          </table></div>
          <button type="button" className="primaire" disabled={!Object.values(notes).some((v) => v !== '')} onClick={enregistrer} style={{ marginTop: 12 }}>Enregistrer les notes d’examen</button>
        </section>
      )}
      {lever && <ConfirmModal titre="Lever l’anonymat ?" boutonConfirmer="Lever l’anonymat" onConfirmer={confirmerLever} onAnnuler={() => setLever(false)}>Les noms des étudiants apparaîtront à côté de chaque numéro. Faites-le une fois toutes les copies notées.</ConfirmModal>}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

// ========================================================================== Mémoires et soutenances
const TYPES_MEMOIRE = { rapport_stage: 'Rapport de stage', memoire_licence: 'Mémoire de licence', memoire_master: 'Mémoire de master', these: 'Thèse de doctorat' };
const STATUTS_MEMOIRE = { sujet_valide: ['Sujet validé', 'bleu'], en_redaction: ['En rédaction', 'bleu'], depose: ['Déposé', 'or'], soutenance_programmee: ['Soutenance programmée', 'or'], soutenu: ['Soutenu', 'vert'], ajourne: ['Ajourné', 'rouge'] };
const QUALITES = ['Président', 'Rapporteur', 'Examinateur', 'Encadrant', 'Membre invité'];

export function Soutenances() {
  const [memoires, setMemoires] = useState(null);
  const [edition, setEdition] = useState(null);
  const [toast, setToast] = useState(null);
  const { eleves } = useListes();
  const charger = () => client.get('/memoires').then((r) => setMemoires(r.data.memoires)).catch(() => setMemoires([]));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['memoires'] });
  if (!memoires) return <div className="chargement">Chargement…</div>;
  const nouveau = { eleveId: '', type: 'memoire_licence', sujet: '', encadrant: '', coEncadrant: '', statut: 'sujet_valide', dateDepot: '', dateSoutenance: '', lieu: '', jury: [], note: '', observations: '' };
  return (
    <>
      <section className="carte">
        <div className="entete-carte">
          <h2>Mémoires, rapports et thèses <span className="entete-carte-compteur">{memoires.length}</span></h2>
          <button type="button" className="primaire" onClick={() => setEdition(nouveau)}><IconPlus /> Nouveau sujet</button>
        </div>
        {memoires.length === 0 ? <div className="vide">Aucun mémoire enregistré.</div> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Étudiant</th><th>Classe</th><th>Type</th><th>Sujet</th><th>Encadrant</th><th>Soutenance</th><th className="cellule-nombre">Note</th><th>Statut</th><th aria-label="Actions" /></tr></thead>
            <tbody>{memoires.map((m) => (
              <tr key={m.id}>
                <td className="cellule-nom">{m.Eleve?.nom} {m.Eleve?.prenom}</td><td>{m.Eleve?.Classe?.nom}</td><td>{TYPES_MEMOIRE[m.type]}</td>
                <td className="cellule-description">{m.sujet}</td><td>{m.encadrant || ''}</td><td>{m.dateSoutenance ? new Date(m.dateSoutenance).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
                <td className="cellule-nombre">{fr(m.note)}</td><td><span className={`badge ${STATUTS_MEMOIRE[m.statut][1]}`}>{STATUTS_MEMOIRE[m.statut][0]}</span></td>
                <td className="cellule-actions" style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="secondaire" onClick={() => setEdition({ ...m, dateSoutenance: m.dateSoutenance ? new Date(m.dateSoutenance).toISOString().slice(0, 16) : '', note: m.note ?? '', dateDepot: m.dateDepot || '' })}>Modifier</button>{' '}
                  {['soutenu', 'ajourne'].includes(m.statut) && <BoutonDocument className="secondaire" chemin={`/api/memoires/${m.id}/pv`}><IconDownload width={14} height={14} /> PV</BoutonDocument>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      {edition && <ModaleMemoire initial={edition} eleves={eleves} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); setToast({ message: 'Mémoire enregistré.', type: 'succes' }); charger(); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function ModaleMemoire({ initial, eleves, onFermer, onEnregistre }) {
  const [form, setForm] = useState(initial);
  const [erreur, setErreur] = useState('');
  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const avecJury = ['soutenance_programmee', 'soutenu', 'ajourne'].includes(form.statut);
  async function enregistrer(e) {
    e.preventDefault(); setErreur('');
    try {
      if (form.id) await client.put(`/memoires/${form.id}`, form); else await client.post('/memoires', form);
      onEnregistre();
    } catch (err) { setErreur(messageErreur(err, 'enregistrement impossible')); }
  }
  const majJury = (i, k, v) => setForm({ ...form, jury: form.jury.map((j, n) => (n === i ? { ...j, [k]: v } : j)) });
  return (
    <Modal titre={form.id ? 'Modifier le mémoire' : 'Nouveau sujet'} onFermer={onFermer} largeur={780}>
      <form className="formulaire" onSubmit={enregistrer}>
        {!form.id && <ChoixEtudiant eleves={eleves} valeur={form.eleveId} onChange={(v) => setForm({ ...form, eleveId: v })} />}
        <div className="ligne-champs">
          <div className="champ"><label>Type</label><select value={form.type} onChange={maj('type')}>{Object.entries(TYPES_MEMOIRE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div className="champ"><label>Statut</label><select value={form.statut} onChange={maj('statut')}>{Object.entries(STATUTS_MEMOIRE).map(([v, [t]]) => <option key={v} value={v}>{t}</option>)}</select></div>
        </div>
        <div className="champ"><label>Sujet</label><textarea rows={2} value={form.sujet} onChange={maj('sujet')} required /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Encadrant</label><input value={form.encadrant || ''} onChange={maj('encadrant')} /></div>
          <div className="champ"><label>Co-encadrant</label><input value={form.coEncadrant || ''} onChange={maj('coEncadrant')} /></div>
          <div className="champ"><label>Date de dépôt</label><input type="date" value={form.dateDepot || ''} onChange={maj('dateDepot')} /></div>
        </div>
        {avecJury && (
          <>
            <div className="ligne-champs">
              <div className="champ"><label>Date et heure de soutenance</label><input type="datetime-local" value={form.dateSoutenance || ''} onChange={maj('dateSoutenance')} required /></div>
              <div className="champ"><label>Lieu</label><input value={form.lieu || ''} onChange={maj('lieu')} /></div>
            </div>
            <h3>Jury {form.type === 'these' && <small className="note-secondaire">(3 à 5 membres, dont au moins 2 rapporteurs)</small>}</h3>
            {form.jury.map((j, i) => (
              <div className="ligne-champs" key={i}>
                <div className="champ"><label>Nom</label><input value={j.nom} onChange={(e) => majJury(i, 'nom', e.target.value)} /></div>
                <div className="champ" style={{ maxWidth: 200 }}><label>Qualité</label><select value={j.qualite} onChange={(e) => majJury(i, 'qualite', e.target.value)}>{QUALITES.map((q) => <option key={q}>{q}</option>)}</select></div>
                <button type="button" className="secondaire" style={{ alignSelf: 'flex-end' }} onClick={() => setForm({ ...form, jury: form.jury.filter((_, n) => n !== i) })}>Retirer</button>
              </div>
            ))}
            <button type="button" className="secondaire" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({ ...form, jury: [...form.jury, { nom: '', qualite: form.jury.length ? 'Examinateur' : 'Président' }] })}><IconPlus /> Ajouter un membre</button>
          </>
        )}
        {['soutenu', 'ajourne'].includes(form.statut) && (
          <div className="ligne-champs">
            <div className="champ" style={{ maxWidth: 180 }}><label>Note / 20</label><input inputMode="decimal" value={form.note} onChange={maj('note')} required /></div>
            <div className="champ"><label>Observations du jury</label><input value={form.observations || ''} onChange={maj('observations')} /></div>
          </div>
        )}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

// ========================================================================== Diplômes
export function Diplomes() {
  const { classes } = useListes();
  const [classeId, setClasseId] = useState('');
  const [lignes, setLignes] = useState(null);
  const [aDelivrer, setADelivrer] = useState(null);
  const [toast, setToast] = useState(null);
  const charger = () => { setLignes(null); client.get(`/diplomes/eligibles${classeId ? `?classeId=${classeId}` : ''}`).then((r) => setLignes(r.data.lignes)).catch(() => setLignes([])); };
  useEffect(charger, [classeId]);
  async function delivrer() {
    const r = await client.post(`/diplomes/${aDelivrer.eleveId}`);
    setADelivrer(null);
    setToast({ message: `Diplôme ${r.data.diplome.numero} délivré.`, type: 'succes' });
    charger();
  }
  const eligibles = (lignes || []).filter((l) => l.eligible && !l.diplome);
  return (
    <>
      <section className="carte">
        <div className="entete-carte">
          <h2>Diplômes</h2>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}</select>
        </div>
        <p className="note-secondaire texte-aide">Un diplôme se délivre quand l’étudiant a réuni tous les crédits de son cycle (180 en licence, 120 en master). Le diplôme et son supplément sont certifiés et vérifiables en ligne.</p>
        {!lignes && <div className="chargement">Calcul des parcours…</div>}
        {lignes && (
          <>
            <p><strong>{eligibles.length}</strong> étudiant(s) peuvent recevoir leur diplôme.</p>
            <div className="table-scroll"><table>
              <thead><tr><th>Étudiant</th><th>Matricule</th><th>Classe</th><th>Cycle</th><th className="cellule-nombre">Crédits</th><th className="cellule-nombre">Moyenne</th><th>Diplôme</th><th aria-label="Actions" /></tr></thead>
              <tbody>{lignes.map((l) => (
                <tr key={l.eleveId}>
                  <td className="cellule-nom">{l.nom} {l.prenom}</td><td className="mono">{l.matricule}</td><td>{l.classe}</td><td>{CYCLES[l.cycle]}</td>
                  <td className="cellule-nombre">{l.creditsAcquis} / {l.creditsRequis}</td><td className="cellule-nombre">{fr(l.moyenne)}</td>
                  <td>{l.diplome ? <span className="badge vert">{l.diplome.numero}</span> : l.eligible ? <span className="badge bleu">Cycle validé</span> : <span className="note-secondaire">En cours</span>}</td>
                  <td className="cellule-actions" style={{ whiteSpace: 'nowrap' }}>
                    {l.diplome ? (
                      <>
                        <BoutonDocument className="secondaire" chemin={`/api/diplomes/${l.diplome.id}/pdf`}><IconDownload width={14} height={14} /> Diplôme</BoutonDocument>{' '}
                        <BoutonDocument className="secondaire" chemin={`/api/diplomes/${l.diplome.id}/supplement`}><IconDownload width={14} height={14} /> Supplément</BoutonDocument>
                      </>
                    ) : l.eligible && <button type="button" className="primaire" onClick={() => setADelivrer(l)}>Délivrer</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </section>
      {aDelivrer && <ConfirmModal titre={`Délivrer le diplôme de ${aDelivrer.prenom} ${aDelivrer.nom} ?`} boutonConfirmer="Délivrer" onConfirmer={delivrer} onAnnuler={() => setADelivrer(null)}>Le diplôme de {CYCLES[aDelivrer.cycle]} ({aDelivrer.creditsAcquis} crédits, moyenne {fr(aDelivrer.moyenne)}) sera enregistré avec un numéro unique, et téléchargeable par l’étudiant.</ConfirmModal>}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

// ========================================================================== Transferts de crédits
export function Mobilite() {
  const { eleves } = useListes();
  const [eleveId, setEleveId] = useState('');
  const [transferts, setTransferts] = useState([]);
  const [ajout, setAjout] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  const [toast, setToast] = useState(null);
  const charger = () => { if (eleveId) client.get(`/transferts?eleveId=${eleveId}`).then((r) => setTransferts(r.data.transferts)).catch(() => setTransferts([])); else setTransferts([]); };
  useEffect(charger, [eleveId]);
  async function ajouter(e) {
    e.preventDefault();
    try {
      await client.post('/transferts', { ...ajout, eleveId });
      setAjout(null);
      setToast({ message: 'Crédits reconnus : ils comptent maintenant dans le parcours LMD de l’étudiant.', type: 'succes' });
      charger();
    } catch (err) { setToast({ message: messageErreur(err, 'enregistrement impossible'), type: 'erreur' }); }
  }
  async function retirer() {
    await client.delete(`/transferts/${aRetirer.id}`);
    setARetirer(null);
    charger();
  }
  const total = transferts.reduce((s, t) => s + t.credits, 0);
  return (
    <>
      <section className="carte">
        <h2>Crédits obtenus dans un autre établissement</h2>
        <p className="note-secondaire texte-aide">Pour un étudiant venu d’ailleurs ou parti en mobilité : chaque UE reconnue compte dans son parcours LMD, et solde une UE à repasser de même code ou de même intitulé.</p>
        <ChoixEtudiant eleves={eleves} valeur={eleveId} onChange={setEleveId} id="mob-etudiant" />
      </section>
      {eleveId && (
        <section className="carte">
          <div className="entete-carte">
            <h2>UE reconnues <span className="entete-carte-compteur">{transferts.length}</span> <small className="note-secondaire">{total} crédits</small></h2>
            <button type="button" className="primaire" onClick={() => setAjout({ etablissementOrigine: '', pays: 'Gabon', code: '', intitule: '', credits: '6', note: '', cycle: 'licence', numeroSemestre: '1', anneeScolaire: '', observations: '' })}><IconPlus /> Reconnaître une UE</button>
          </div>
          {transferts.length === 0 ? <div className="vide">Aucun crédit transféré pour cet étudiant.</div> : (
            <div className="table-scroll"><table>
              <thead><tr><th>Établissement d’origine</th><th>Pays</th><th>Code</th><th>UE</th><th className="cellule-nombre">Crédits</th><th className="cellule-nombre">Note</th><th>Équivalence</th><th>Décidé par</th><th aria-label="Retirer" /></tr></thead>
              <tbody>{transferts.map((t) => (
                <tr key={t.id}><td>{t.etablissementOrigine}</td><td>{t.pays || ''}</td><td className="mono">{t.code || ''}</td><td>{t.intitule}</td><td className="cellule-nombre">{t.credits}</td><td className="cellule-nombre">{fr(t.note)}</td><td>{CYCLES[t.cycle]}, S{t.numeroSemestre}</td><td>{t.decideParNom}</td>
                  <td className="cellule-actions"><button type="button" className="secondaire" onClick={() => setARetirer(t)}>Retirer</button></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}
      {ajout && (
        <Modal titre="Reconnaître une UE obtenue ailleurs" onFermer={() => setAjout(null)} largeur={720}>
          <form className="formulaire" onSubmit={ajouter}>
            <div className="ligne-champs">
              <div className="champ"><label>Établissement d’origine</label><input value={ajout.etablissementOrigine} onChange={(e) => setAjout({ ...ajout, etablissementOrigine: e.target.value })} required /></div>
              <div className="champ" style={{ maxWidth: 200 }}><label>Pays</label><input value={ajout.pays} onChange={(e) => setAjout({ ...ajout, pays: e.target.value })} /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ" style={{ maxWidth: 180 }}><label>Code de l’UE</label><input value={ajout.code} onChange={(e) => setAjout({ ...ajout, code: e.target.value })} /></div>
              <div className="champ"><label>Intitulé</label><input value={ajout.intitule} onChange={(e) => setAjout({ ...ajout, intitule: e.target.value })} required /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ"><label>Crédits</label><input type="number" min="1" max="60" value={ajout.credits} onChange={(e) => setAjout({ ...ajout, credits: e.target.value })} required /></div>
              <div className="champ"><label>Note / 20 (facultatif)</label><input inputMode="decimal" value={ajout.note} onChange={(e) => setAjout({ ...ajout, note: e.target.value })} /></div>
              <div className="champ"><label>Cycle</label><select value={ajout.cycle} onChange={(e) => setAjout({ ...ajout, cycle: e.target.value })}>{Object.entries(CYCLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
              <div className="champ"><label>Semestre équivalent</label><input type="number" min="1" max="8" value={ajout.numeroSemestre} onChange={(e) => setAjout({ ...ajout, numeroSemestre: e.target.value })} required /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ" style={{ maxWidth: 200 }}><label>Année universitaire</label><input placeholder="2025-2026" value={ajout.anneeScolaire} onChange={(e) => setAjout({ ...ajout, anneeScolaire: e.target.value })} /></div>
              <div className="champ"><label>Observations</label><input value={ajout.observations} onChange={(e) => setAjout({ ...ajout, observations: e.target.value })} /></div>
            </div>
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setAjout(null)}>Annuler</button>
              <button type="submit" className="primaire">Reconnaître</button>
            </div>
          </form>
        </Modal>
      )}
      {aRetirer && <ConfirmModal titre="Retirer cette UE reconnue ?" boutonConfirmer="Retirer" onConfirmer={retirer} onAnnuler={() => setARetirer(null)}>Les {aRetirer.credits} crédits de « {aRetirer.intitule} » ne compteront plus dans le parcours de l’étudiant.</ConfirmModal>}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
