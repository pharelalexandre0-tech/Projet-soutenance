import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import ChampLogo from '../../components/ChampLogo';
import ChampMotDePasse from '../../components/ChampMotDePasse';
import { messageErreur } from '../../utils/erreurs';
import { lireFichierExcel } from '../../utils/excel';
import { IconCheck, IconPlus, IconKey, IconLock, IconUpload, IconTrash } from '../../components/icons';

// Paramétrage complet d'une école par le superadmin : assistant de création,
// règles académiques, structure LMD, comptes du personnel et abonnement.

const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const TYPES = { universite_publique: 'Université publique', universite_privee: 'Université privée', institut_superieur: 'Institut supérieur', grande_ecole: 'Grande école' };
const ROLES = { academie: 'Académie', finance: 'Finance' };
const anneeCourante = () => { const d = new Date(); const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${a}-${a + 1}`; };
const REGLES_VIDES = { seuilValidation: '10', noteEliminatoire: '7', compensationActive: false, noteMinCompensation: '', passageDetteActif: false, creditsMinPassagePct: '' };

// ------------------------------------------------------------------ Règles académiques
function ChampsRegles({ valeur, onChange }) {
  const maj = (champ) => (e) => onChange({ ...valeur, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <>
      <div className="ligne-champs">
        <div className="champ"><label htmlFor="pr-seuil">Seuil de validation d’une UE (sur 20)</label><input id="pr-seuil" type="number" min="1" max="20" step="0.25" value={valeur.seuilValidation} onChange={maj('seuilValidation')} required /></div>
        <div className="champ"><label htmlFor="pr-elim">Note éliminatoire (sur 20)</label><input id="pr-elim" type="number" min="0" max="20" step="0.25" value={valeur.noteEliminatoire} onChange={maj('noteEliminatoire')} required /></div>
      </div>
      <label className="case-confirmation"><input type="checkbox" checked={Boolean(valeur.compensationActive)} onChange={maj('compensationActive')} /> Compenser les UE d’un semestre entre elles</label>
      {valeur.compensationActive && (
        <div className="champ"><label htmlFor="pr-comp">Moyenne minimale d’une UE compensable (sur 20)</label><input id="pr-comp" type="number" min="0" max="20" step="0.25" value={valeur.noteMinCompensation ?? ''} onChange={maj('noteMinCompensation')} required /></div>
      )}
      <label className="case-confirmation"><input type="checkbox" checked={Boolean(valeur.passageDetteActif)} onChange={maj('passageDetteActif')} /> Autoriser le passage en année supérieure avec des UE à repasser</label>
      {valeur.passageDetteActif && (
        <div className="champ"><label htmlFor="pr-dette">Part minimale des crédits de l’année (en %)</label><input id="pr-dette" type="number" min="1" max="99" value={valeur.creditsMinPassagePct ?? ''} onChange={maj('creditsMinPassagePct')} required /></div>
      )}
    </>
  );
}

export function ReglesEcole({ etablissementId, notifier }) {
  const [form, setForm] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    client.get(`/superadmin/etablissements/${etablissementId}/parametrage`).then((r) => {
      const g = r.data.regles;
      setForm({ ...g, seuilValidation: String(g.seuilValidation), noteEliminatoire: String(g.noteEliminatoire), noteMinCompensation: g.noteMinCompensation ?? '', creditsMinPassagePct: g.creditsMinPassagePct ?? '' });
    }).catch(() => setForm(REGLES_VIDES));
  }, [etablissementId]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/superadmin/etablissements/${etablissementId}/regles`, form);
      notifier('Règles académiques enregistrées : les bulletins de l’école les appliquent dès maintenant.');
    } catch (err) {
      setErreur(messageErreur(err, 'enregistrement impossible'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Règles académiques</h2>
      <p className="note-secondaire texte-aide">Les mêmes réglages que ceux de l’Académie dans ses paramètres. L’école peut les ajuster ensuite.</p>
      {!form && <div className="chargement">Chargement…</div>}
      {form && (
        <form className="formulaire" onSubmit={enregistrer} style={{ maxWidth: 720 }}>
          <ChampsRegles valeur={form} onChange={setForm} />
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer les règles'}</button>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Structure pédagogique
function ChampsMaquette({ valeur, onChange, avecSupprimer, onSupprimer }) {
  const maj = (champ) => (e) => onChange({ ...valeur, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <div className="maquette-ligne">
      <div className="ligne-champs">
        <div className="champ" style={{ maxWidth: 170 }}><label>Cycle</label>
          <select value={valeur.cycle} onChange={maj('cycle')}>{Object.entries(CYCLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </div>
        <div className="champ"><label>Mention</label><input placeholder="ex. Informatique" value={valeur.mention} onChange={maj('mention')} required /></div>
        <div className="champ"><label>Parcours (facultatif)</label><input placeholder="ex. Génie logiciel" value={valeur.parcours} onChange={maj('parcours')} /></div>
        <div className="champ" style={{ maxWidth: 160 }}><label>Année</label><input placeholder="2026-2027" value={valeur.anneeScolaire} onChange={maj('anneeScolaire')} required /></div>
        {avecSupprimer && <button type="button" className="bouton-icone" aria-label="Retirer cette formation" onClick={onSupprimer} style={{ alignSelf: 'flex-end' }}><IconTrash width={18} height={18} /></button>}
      </div>
      <label className="case-confirmation"><input type="checkbox" checked={valeur.avecClasses !== false} onChange={maj('avecClasses')} /> Créer aussi les classes de chaque niveau ({valeur.cycle === 'master' ? 'M1, M2' : valeur.cycle === 'doctorat' ? 'Doctorat' : 'L1, L2, L3'})</label>
    </div>
  );
}

const MAQUETTE_VIDE = () => ({ cycle: 'licence', mention: '', parcours: '', anneeScolaire: anneeCourante(), avecClasses: true });

export function StructureEcole({ etablissementId, notifier }) {
  const [donnees, setDonnees] = useState(null);
  const [maquette, setMaquette] = useState(null);
  const [importer, setImporter] = useState(false);
  const charger = () => client.get(`/superadmin/etablissements/${etablissementId}/parametrage`).then((r) => setDonnees(r.data)).catch(() => {});
  useEffect(() => { charger(); }, [etablissementId]);
  useActualisation(charger, { domaines: ['superadmin', 'formations', 'semestres', 'unites-enseignement', 'classes'] });

  if (!donnees) return <div className="carte"><div className="chargement">Chargement…</div></div>;
  return (
    <>
      <div className="carte">
        <div className="entete-carte">
          <h2>Formations <span className="entete-carte-compteur">{donnees.formations.length}</span></h2>
          <button className="primaire" onClick={() => setMaquette(MAQUETTE_VIDE())}><IconPlus /> Préparer une maquette LMD</button>
        </div>
        <p className="note-secondaire texte-aide">Une maquette crée la formation, les semestres du cycle pour l’année et, si vous le souhaitez, une classe par niveau. Rien n’est créé en double.</p>
        {donnees.formations.length === 0 ? <div className="vide">Aucune formation pour le moment.</div> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Cycle</th><th>Mention</th><th>Parcours</th><th className="cellule-nombre">Crédits requis</th><th className="cellule-nombre">Classes</th><th className="cellule-nombre">UE</th></tr></thead>
            <tbody>{donnees.formations.map((f) => <tr key={f.id}><td>{CYCLES[f.cycle]}</td><td className="cellule-nom">{f.mention}</td><td>{f.parcours || ''}</td><td className="cellule-nombre">{f.creditsRequis}</td><td className="cellule-nombre">{f.classes}</td><td className="cellule-nombre">{f.ues}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
      <div className="carte">
        <div className="entete-carte">
          <h2>Semestres et unités d’enseignement <span className="entete-carte-compteur">{donnees.semestres.length}</span></h2>
          <button className="secondaire" onClick={() => setImporter(true)} disabled={!donnees.semestres.length}><IconUpload /> Importer UE et matières</button>
        </div>
        {donnees.semestres.length === 0 ? <div className="vide">Aucun semestre : préparez d’abord une maquette.</div> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Année</th><th>Semestre</th><th className="cellule-nombre">UE</th><th className="cellule-nombre">Matières</th><th className="cellule-nombre">Crédits</th></tr></thead>
            <tbody>{donnees.semestres.map((s) => <tr key={s.id}><td>{s.anneeScolaire}</td><td>{s.libelle}</td><td className="cellule-nombre">{s.ues}</td><td className="cellule-nombre">{s.matieres}</td><td className={`cellule-nombre ${s.ues && s.credits !== 30 ? 'ton-attente' : ''}`}>{s.credits}{s.ues && s.credits !== 30 ? ' (30 attendus)' : ''}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
      <div className="carte">
        <h2>Classes <span className="entete-carte-compteur">{donnees.classes.length}</span></h2>
        {donnees.classes.length === 0 ? <div className="vide">Aucune classe.</div> : <div className="puces">{donnees.classes.map((c) => <span key={c.id} className="puce">{c.nom} · {c.niveau}</span>)}</div>}
      </div>
      {maquette && <ModaleMaquette etablissementId={etablissementId} initiale={maquette} onFermer={() => setMaquette(null)} onCree={(m) => { setMaquette(null); notifier(m); charger(); }} />}
      {importer && <ModaleImportStructure etablissementId={etablissementId} donnees={donnees} onFermer={() => setImporter(false)} onImporte={(m) => { setImporter(false); notifier(m); charger(); }} />}
    </>
  );
}

function ModaleMaquette({ etablissementId, initiale, onFermer, onCree }) {
  const [form, setForm] = useState(initiale);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  async function creer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const r = await client.post(`/superadmin/etablissements/${etablissementId}/maquette`, form);
      onCree(`Maquette prête : ${r.data.semestres} semestres et ${r.data.classes} classe(s) pour « ${r.data.formation.mention} ».`);
    } catch (err) {
      setErreur(messageErreur(err, 'préparation impossible'));
      setEnCours(false);
    }
  }
  return (
    <Modal titre="Préparer une maquette LMD" onFermer={onFermer} largeur={760}>
      <form className="formulaire" onSubmit={creer}>
        <ChampsMaquette valeur={form} onChange={setForm} />
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Préparation…' : 'Préparer la maquette'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModaleImportStructure({ etablissementId, donnees, onFermer, onImporte }) {
  const [semestreId, setSemestreId] = useState(String(donnees.semestres[0]?.id || ''));
  const [formationId, setFormationId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  async function importer(e) {
    e.preventDefault();
    const fichier = e.target.elements.fichier.files[0];
    if (!fichier) return;
    setEnCours(true);
    setErreur('');
    try {
      const lignes = (await lireFichierExcel(fichier)).map((l) => ({
        codeUE: l.codeue, intituleUE: l.intituleue || l.ue, credits: Number(l.credits), codeMatiere: l.codematiere, matiere: l.matiere || l.intitulematiere, coefficient: l.coefficient || l.coef || 1,
      }));
      const r = await client.post(`/superadmin/etablissements/${etablissementId}/structure`, { semestreId, formationId: formationId || null, lignes });
      onImporte(`${r.data.uesCreees} UE et ${r.data.matieresCreees} matière(s) ajoutées${r.data.erreurs.length ? `, ${r.data.erreurs.length} ligne(s) ignorée(s)` : ''}.`);
    } catch (err) {
      setErreur(messageErreur(err, 'import impossible'));
      setEnCours(false);
    }
  }
  return (
    <Modal titre="Importer les UE et matières" onFermer={onFermer} largeur={640}>
      <form className="formulaire" onSubmit={importer}>
        <p className="note-secondaire" style={{ margin: 0 }}>Un fichier Excel ou CSV, une ligne par matière, avec les colonnes <strong>Code UE</strong>, <strong>Intitulé UE</strong>, <strong>Crédits</strong>, <strong>Code matière</strong>, <strong>Matière</strong>, <strong>Coefficient</strong>.</p>
        <div className="ligne-champs">
          <div className="champ"><label>Semestre</label><select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>{donnees.semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}</select></div>
          <div className="champ"><label>Formation</label><select value={formationId} onChange={(e) => setFormationId(e.target.value)}><option value="">Commune à toutes les classes</option>{donnees.formations.map((f) => <option key={f.id} value={f.id}>{[f.mention, f.parcours].filter(Boolean).join(', ')}</option>)}</select></div>
        </div>
        <input type="file" name="fichier" accept=".xlsx,.xls,.csv" required />
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Import…' : 'Importer'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Comptes et abonnement
export function ComptesAbonnementEcole({ etablissementId, notifier }) {
  const [donnees, setDonnees] = useState(null);
  const [abo, setAbo] = useState(null);
  const [nouveau, setNouveau] = useState(null);
  const [acces, setAcces] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [erreur, setErreur] = useState('');
  const charger = () => client.get(`/superadmin/etablissements/${etablissementId}/parametrage`).then((r) => {
    setDonnees(r.data);
    const a = r.data.abonnement;
    setAbo({ abonnementOffre: a.abonnementOffre || '', quotaEtudiants: a.quotaEtudiants ?? '', quotaPersonnel: a.quotaPersonnel ?? '', abonnementFin: a.abonnementFin || '' });
  }).catch(() => {});
  useEffect(() => { charger(); }, [etablissementId]);

  async function enregistrerAbo(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.put(`/superadmin/etablissements/${etablissementId}/abonnement`, abo);
      notifier('Abonnement et quotas enregistrés.');
      charger();
    } catch (err) { setErreur(messageErreur(err, 'enregistrement impossible')); }
  }
  async function basculer(u) {
    await client.patch(`/superadmin/etablissements/${etablissementId}/comptes/${u.id}`, { statut: u.statut === 'actif' ? 'verrouille' : 'actif' }).then(() => charger()).catch((err) => notifier(messageErreur(err, 'action impossible'), 'erreur'));
    setConfirmation(null);
  }
  async function reinitialiser(u) {
    const r = await client.post(`/superadmin/etablissements/${etablissementId}/comptes/${u.id}/reinitialiser`);
    setAcces(r.data);
    setConfirmation(null);
  }

  if (!donnees || !abo) return <div className="carte"><div className="chargement">Chargement…</div></div>;
  const pct = (n, max) => (max ? Math.min(100, Math.round((n / max) * 100)) : 0);
  return (
    <>
      <div className="carte">
        <h2>Abonnement et quotas</h2>
        {donnees.abonnement.expire && <div className="message-erreur">L’abonnement a expiré : les comptes de l’école n’ont plus accès à la plateforme.</div>}
        <dl className="usage-quotas">
          <div><dt>Étudiants</dt><dd>{donnees.usage.etudiants}{donnees.abonnement.quotaEtudiants ? ` / ${donnees.abonnement.quotaEtudiants}` : ''}</dd>{donnees.abonnement.quotaEtudiants ? <span className="jauge-quota"><i style={{ width: `${pct(donnees.usage.etudiants, donnees.abonnement.quotaEtudiants)}%` }} /></span> : <small>sans limite</small>}</div>
          <div><dt>Comptes du personnel</dt><dd>{donnees.usage.personnel}{donnees.abonnement.quotaPersonnel ? ` / ${donnees.abonnement.quotaPersonnel}` : ''}</dd>{donnees.abonnement.quotaPersonnel ? <span className="jauge-quota"><i style={{ width: `${pct(donnees.usage.personnel, donnees.abonnement.quotaPersonnel)}%` }} /></span> : <small>sans limite</small>}</div>
          <div><dt>Fin d’abonnement</dt><dd>{donnees.abonnement.abonnementFin ? new Date(donnees.abonnement.abonnementFin).toLocaleDateString('fr-FR') : 'Sans échéance'}</dd><small>{donnees.abonnement.abonnementOffre || ''}</small></div>
        </dl>
        <form className="formulaire" onSubmit={enregistrerAbo} style={{ maxWidth: 760 }}>
          <ChampsAbonnement valeur={abo} onChange={setAbo} />
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit">Enregistrer</button>
        </form>
      </div>
      <div className="carte">
        <div className="entete-carte">
          <h2>Comptes du personnel <span className="entete-carte-compteur">{donnees.comptes.length}</span></h2>
          <button className="primaire" onClick={() => setNouveau({ role: 'academie', prenom: '', nom: '', email: '', fonction: '' })}><IconPlus /> Créer un compte</button>
        </div>
        {acces && <div className="resultat-acces">À transmettre maintenant (ne sera plus affiché) : <code>{acces.email}</code> / <code>{acces.motDePasse}</code></div>}
        <div className="table-scroll"><table>
          <thead><tr><th>Espace</th><th>Nom</th><th>E-mail</th><th>Fonction</th><th>Statut</th><th aria-label="Actions" /></tr></thead>
          <tbody>{donnees.comptes.map((u) => (
            <tr key={u.id}>
              <td><span className={`badge sans-point ${u.role === 'academie' ? 'bleu' : 'vert'}`}>{ROLES[u.role]}</span></td>
              <td className="cellule-nom">{u.prenom} {u.nom}</td><td>{u.email}</td><td>{u.fonction || ''}</td>
              <td><span className={`badge ${u.statut === 'actif' ? 'vert' : 'rouge'}`}>{u.statut === 'actif' ? 'Actif' : 'Verrouillé'}</span></td>
              <td className="cellule-actions" style={{ whiteSpace: 'nowrap' }}>
                <button className="secondaire" onClick={() => setConfirmation({ type: 'reinit', u })}><IconKey /> Nouveau mot de passe</button>{' '}
                <button className="secondaire" onClick={() => setConfirmation({ type: 'statut', u })}><IconLock /> {u.statut === 'actif' ? 'Verrouiller' : 'Réactiver'}</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      {nouveau && <ModaleCompte etablissementId={etablissementId} initial={nouveau} onFermer={() => setNouveau(null)} onCree={(r) => { setNouveau(null); setAcces({ email: r.compte.email, motDePasse: r.motDePasse }); charger(); }} />}
      {confirmation?.type === 'reinit' && (
        <ConfirmModal titre={`Nouveau mot de passe pour ${confirmation.u.prenom} ${confirmation.u.nom} ?`} boutonConfirmer="Générer" onConfirmer={() => reinitialiser(confirmation.u)} onAnnuler={() => setConfirmation(null)}>
          L’ancien mot de passe cessera de fonctionner et les sessions ouvertes seront fermées.
        </ConfirmModal>
      )}
      {confirmation?.type === 'statut' && (
        <ConfirmModal titre={confirmation.u.statut === 'actif' ? `Verrouiller ${confirmation.u.email} ?` : `Réactiver ${confirmation.u.email} ?`} boutonConfirmer={confirmation.u.statut === 'actif' ? 'Verrouiller' : 'Réactiver'} onConfirmer={() => basculer(confirmation.u)} onAnnuler={() => setConfirmation(null)}>
          {confirmation.u.statut === 'actif' ? 'Ce compte perd l’accès immédiatement.' : 'Ce compte retrouve son accès.'}
        </ConfirmModal>
      )}
    </>
  );
}

function ChampsAbonnement({ valeur, onChange }) {
  const maj = (champ) => (e) => onChange({ ...valeur, [champ]: e.target.value });
  return (
    <>
      <div className="ligne-champs">
        <div className="champ"><label htmlFor="ab-offre">Offre</label><input id="ab-offre" placeholder="ex. Établissement, Annuel" value={valeur.abonnementOffre} onChange={maj('abonnementOffre')} /></div>
        <div className="champ"><label htmlFor="ab-fin">Fin d’abonnement</label><input id="ab-fin" type="date" value={valeur.abonnementFin} onChange={maj('abonnementFin')} /></div>
      </div>
      <div className="ligne-champs">
        <div className="champ"><label htmlFor="ab-etu">Nombre maximal d’étudiants</label><input id="ab-etu" type="number" min="1" placeholder="Sans limite" value={valeur.quotaEtudiants} onChange={maj('quotaEtudiants')} /></div>
        <div className="champ"><label htmlFor="ab-pers">Nombre maximal de comptes du personnel</label><input id="ab-pers" type="number" min="1" placeholder="Sans limite" value={valeur.quotaPersonnel} onChange={maj('quotaPersonnel')} /></div>
      </div>
    </>
  );
}

function ModaleCompte({ etablissementId, initial, onFermer, onCree }) {
  const [form, setForm] = useState(initial);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  async function creer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const r = await client.post(`/superadmin/etablissements/${etablissementId}/comptes`, form);
      onCree(r.data);
    } catch (err) {
      setErreur(messageErreur(err, 'création impossible'));
      setEnCours(false);
    }
  }
  return (
    <Modal titre="Créer un compte du personnel" onFermer={onFermer} largeur={600}>
      <form className="formulaire" onSubmit={creer}>
        <div className="champ"><label>Espace</label><select value={form.role} onChange={maj('role')}><option value="academie">Académie (scolarité)</option><option value="finance">Finance (comptabilité)</option></select></div>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={maj('prenom')} required /></div>
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={maj('nom')} required /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>E-mail</label><input type="email" value={form.email} onChange={maj('email')} required /></div>
          <div className="champ"><label>Fonction (facultatif)</label><input placeholder="ex. Directeur des études" value={form.fonction} onChange={maj('fonction')} /></div>
        </div>
        <p className="note-secondaire" style={{ margin: 0 }}>Un mot de passe provisoire est généré et affiché une seule fois, à transmettre à la personne.</p>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Création…' : 'Créer le compte'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Assistant de création
const ETAPES = ['Identité', 'Comptes', 'Règles', 'Structure', 'Modules et abonnement'];

export function AssistantCreationEcole({ onFermer, onReussi }) {
  const [etape, setEtape] = useState(0);
  const [identite, setIdentite] = useState({ nom: '', sigle: '', devise: '', ville: '', pays: 'République Gabonaise', boitePostale: '', telephone: '', email: '', logo: '', typeEtablissement: 'institut_superieur' });
  const [comptes, setComptes] = useState({ academiePrenom: '', academieNom: '', academieEmail: '', academieMotDePasse: '', financePrenom: '', financeNom: '', financeEmail: '' });
  const [regles, setRegles] = useState(REGLES_VIDES);
  const [maquettes, setMaquettes] = useState([]);
  const [catalogue, setCatalogue] = useState(null);
  const [choix, setChoix] = useState([]);
  const [abo, setAbo] = useState({ abonnementOffre: '', quotaEtudiants: '', quotaPersonnel: '', abonnementFin: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  useEffect(() => { client.get('/superadmin/fonctionnalites').then((r) => { setCatalogue(r.data.fonctionnalites); setChoix(r.data.fonctionnalites.filter((f) => f.integree).map((f) => f.cle)); }).catch(() => setCatalogue([])); }, []);

  const majI = (champ) => (e) => setIdentite({ ...identite, [champ]: e.target.value });
  const majC = (champ) => (e) => setComptes({ ...comptes, [champ]: e.target.value });

  function suivant(e) {
    e.preventDefault();
    setErreur('');
    if (etape < ETAPES.length - 1) { setEtape(etape + 1); return; }
    creer();
  }

  async function creer() {
    setEnCours(true);
    try {
      const corps = {
        ...identite, academieNom: comptes.academieNom, academiePrenom: comptes.academiePrenom, academieEmail: comptes.academieEmail, academieMotDePasse: comptes.academieMotDePasse,
        finance: comptes.financeEmail ? { nom: comptes.financeNom, prenom: comptes.financePrenom, email: comptes.financeEmail } : null,
        regles, abonnement: abo, maquettes: maquettes.filter((m) => m.mention.trim()), fonctionnalites: choix,
      };
      const r = await client.post('/superadmin/etablissements', corps);
      setResultat(r.data);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'affilier cette école"));
    } finally {
      setEnCours(false);
    }
  }

  if (resultat) {
    return (
      <Modal titre="École affiliée" onFermer={() => onReussi(resultat.etablissement)} largeur={680}>
        <div className="formulaire">
          <p><strong>{resultat.etablissement.nom}</strong> est prête.</p>
          <ul className="liste-recap">
            <li><IconCheck /> Compte Académie : {resultat.compteAcademie.email}</li>
            {resultat.compteFinance && <li><IconCheck /> Compte Finance : {resultat.compteFinance.email}</li>}
            {resultat.maquettes?.map((m) => <li key={m.mention}><IconCheck /> {CYCLES[m.cycle]} {m.mention} : {m.semestres} semestres, {m.classes} classe(s)</li>)}
            <li><IconCheck /> {choix.length} module(s) activé(s)</li>
          </ul>
          {resultat.motDePasseFinance && <div className="resultat-acces">Mot de passe provisoire du compte Finance, à transmettre maintenant (ne sera plus affiché) : <code>{resultat.compteFinance.email}</code> / <code>{resultat.motDePasseFinance}</code></div>}
          {resultat.avertissements?.length > 0 && <div className="message-erreur">{resultat.avertissements.join(' · ')}</div>}
          <div className="confirmation-actions"><button className="primaire" onClick={() => onReussi(resultat.etablissement)}>Terminer</button></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titre="Affilier une nouvelle école" onFermer={onFermer} largeur={820}>
      <ol className="assistant-etapes" aria-label="Étapes">
        {ETAPES.map((t, i) => <li key={t} className={i === etape ? 'actuelle' : i < etape ? 'faite' : ''}><button type="button" onClick={() => i < etape && setEtape(i)} disabled={i > etape}><span>{i < etape ? <IconCheck /> : i + 1}</span>{t}</button></li>)}
      </ol>
      <form className="formulaire" onSubmit={suivant} autoComplete="off">
        {etape === 0 && (
          <>
            <ChampLogo valeur={identite.logo} onChange={(logo) => setIdentite({ ...identite, logo })} />
            <div className="ligne-champs">
              <div className="champ" style={{ flex: 3 }}><label>Nom de l'établissement</label><input value={identite.nom} onChange={majI('nom')} required /></div>
              <div className="champ"><label>Sigle</label><input value={identite.sigle} onChange={majI('sigle')} /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ"><label>Ville</label><input value={identite.ville} onChange={majI('ville')} required /></div>
              <div className="champ"><label>Pays</label><input value={identite.pays} onChange={majI('pays')} /></div>
              <div className="champ"><label>Type d’établissement</label><select value={identite.typeEtablissement} onChange={majI('typeEtablissement')}>{Object.entries(TYPES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            </div>
            <div className="champ"><label>Devise</label><input value={identite.devise} onChange={majI('devise')} /></div>
            <div className="ligne-champs">
              <div className="champ"><label>Boîte postale</label><input value={identite.boitePostale} onChange={majI('boitePostale')} /></div>
              <div className="champ"><label>Téléphone</label><input value={identite.telephone} onChange={majI('telephone')} /></div>
              <div className="champ"><label>E-mail de contact</label><input type="email" value={identite.email} onChange={majI('email')} /></div>
            </div>
          </>
        )}
        {etape === 1 && (
          <>
            <h3>Compte Académie (obligatoire)</h3>
            <div className="ligne-champs">
              <div className="champ"><label>Prénom</label><input value={comptes.academiePrenom} onChange={majC('academiePrenom')} required /></div>
              <div className="champ"><label>Nom</label><input value={comptes.academieNom} onChange={majC('academieNom')} required /></div>
            </div>
            <div className="ligne-champs">
              <div className="champ"><label>E-mail</label><input type="email" value={comptes.academieEmail} onChange={majC('academieEmail')} required /></div>
              <div className="champ"><label>Mot de passe</label><ChampMotDePasse autoComplete="new-password" value={comptes.academieMotDePasse} onChange={majC('academieMotDePasse')} required /></div>
            </div>
            <h3>Compte Finance (facultatif)</h3>
            <div className="ligne-champs">
              <div className="champ"><label>Prénom</label><input value={comptes.financePrenom} onChange={majC('financePrenom')} required={Boolean(comptes.financeEmail)} /></div>
              <div className="champ"><label>Nom</label><input value={comptes.financeNom} onChange={majC('financeNom')} required={Boolean(comptes.financeEmail)} /></div>
              <div className="champ"><label>E-mail</label><input type="email" value={comptes.financeEmail} onChange={majC('financeEmail')} /></div>
            </div>
            <p className="note-secondaire" style={{ margin: 0 }}>Le mot de passe du compte Finance est généré et affiché à la fin de l’assistant.</p>
          </>
        )}
        {etape === 2 && (
          <>
            <p className="note-secondaire" style={{ margin: 0 }}>Les règles de validation de l’établissement. Compensation et passage avec dette restent désactivés tant que l’école ne les a pas décidés.</p>
            <ChampsRegles valeur={regles} onChange={setRegles} />
          </>
        )}
        {etape === 3 && (
          <>
            <p className="note-secondaire" style={{ margin: 0 }}>Préparez les formations de l’école : chaque maquette crée la formation, les semestres de l’année et les classes. Vous pouvez aussi passer cette étape.</p>
            {maquettes.map((m, i) => <ChampsMaquette key={i} valeur={m} onChange={(v) => setMaquettes(maquettes.map((x, j) => (j === i ? v : x)))} avecSupprimer onSupprimer={() => setMaquettes(maquettes.filter((_, j) => j !== i))} />)}
            <button type="button" className="secondaire" onClick={() => setMaquettes([...maquettes, MAQUETTE_VIDE()])} style={{ alignSelf: 'flex-start' }}><IconPlus /> Ajouter une formation</button>
          </>
        )}
        {etape === 4 && (
          <>
            <h3>Modules</h3>
            {!catalogue && <div className="chargement">Chargement du catalogue…</div>}
            {catalogue && (
              <div className="cases-choix">
                {catalogue.map((f) => {
                  const choisie = choix.includes(f.cle);
                  return <button key={f.cle} type="button" className={`case-choix ${choisie ? 'choisie' : ''}`} onClick={() => setChoix(choisie ? choix.filter((x) => x !== f.cle) : [...choix, f.cle])} aria-pressed={choisie} title={f.description}><span className="case-choix-coche">{choisie && <IconCheck />}</span><span>{f.nom}</span></button>;
                })}
              </div>
            )}
            <h3>Abonnement et quotas</h3>
            <ChampsAbonnement valeur={abo} onChange={setAbo} />
          </>
        )}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions separees">
          <button type="button" className="secondaire" onClick={() => (etape ? setEtape(etape - 1) : onFermer())}>{etape ? 'Précédent' : 'Annuler'}</button>
          <button type="submit" className="primaire" disabled={enCours}>{etape < ETAPES.length - 1 ? 'Suivant' : enCours ? 'Affiliation…' : "Affilier l'école"}</button>
        </div>
      </form>
    </Modal>
  );
}
