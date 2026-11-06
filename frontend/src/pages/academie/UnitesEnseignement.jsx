import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { IconEdit, IconTrash, IconUpload } from '../../components/icons';
import Formations from './Formations';
import Modal from '../../components/Modal';
import { lireFichierExcel } from '../../utils/excel';
import { messageErreur } from '../../utils/erreurs';

const UE_VIDE = { code: '', intitule: '', credits: '', semestreId: '', formationId: '' };
const MATIERE_VIDE = { code: '', intitule: '', coefficient: '1' };
const SEMESTRE_VIDE = { cycle: 'licence', numero: '1', anneeScolaire: '' };
const CYCLES = [
  { valeur: 'licence', libelle: 'Licence' },
  { valeur: 'master', libelle: 'Master' },
  { valeur: 'doctorat', libelle: 'Doctorat' },
];
const NUMEROS_SEMESTRE = [1, 2, 3, 4, 5, 6, 7, 8];

export default function UnitesEnseignement() {
  const [ues, setUes] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ueOuverte, setUeOuverte] = useState(null);
  const [nouvelleUE, setNouvelleUE] = useState(UE_VIDE);
  const [nouvelleMatiere, setNouvelleMatiere] = useState(MATIERE_VIDE);
  const [nouveauSemestre, setNouveauSemestre] = useState(SEMESTRE_VIDE);
  const [formSemestreOuvert, setFormSemestreOuvert] = useState(false);
  const [message, setMessage] = useState('');
  const [matiereASupprimer, setMatiereASupprimer] = useState(null);
  const [toast, setToast] = useState(null);
  const [importStructure, setImportStructure] = useState(false);
  const [formations, setFormations] = useState([]);
  const [ueEditee, setUeEditee] = useState(null);
  const chargerFormations = () => client.get('/formations').then((res) => setFormations(res.data.formations)).catch(() => {});

  function charger() {
    client.get('/unites-enseignement').then((res) => setUes(res.data.ues));
  }
  function chargerSemestres() {
    return client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }
  useEffect(() => {
    charger();
    chargerSemestres();
    chargerFormations();
  }, []);
  useActualisation(() => {
    charger();
    chargerFormations();
    chargerSemestres().catch(() => {});
  });

  async function creerSemestre(e) {
    e.preventDefault();
    const res = await client.post('/semestres', nouveauSemestre);
    setNouveauSemestre(SEMESTRE_VIDE);
    setFormSemestreOuvert(false);
    await chargerSemestres();
    setNouvelleUE((v) => ({ ...v, semestreId: String(res.data.semestre.id) }));
  }

  async function creerUE(e) {
    e.preventDefault();
    setMessage('');
    try {
      // Le coefficient de l'UE ne se règle pas à la création — l'Académie
      // crée une UE, pas un poids ; il part sur la même valeur que les
      // crédits (convention LMD courante : coefficient = crédits ECTS).
      await client.post('/unites-enseignement', {
        ...nouvelleUE,
        formationId: nouvelleUE.formationId || null,
        credits: Number(nouvelleUE.credits),
        coefficient: Number(nouvelleUE.credits),
      });
      setMessage('UE créée.');
      setNouvelleUE(UE_VIDE);
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  async function creerMatiere(e, uniteEnseignementId) {
    e.preventDefault();
    await client.post('/matieres', {
      ...nouvelleMatiere,
      coefficient: Number(nouvelleMatiere.coefficient),
      uniteEnseignementId,
    });
    setNouvelleMatiere(MATIERE_VIDE);
    charger();
  }

  async function supprimerMatiere() {
    try {
      const res = await client.delete(`/matieres/${matiereASupprimer.id}`);
      const n = res.data.notesSupprimees || 0;
      setToast({ message: `« ${matiereASupprimer.intitule} » retirée de l'UE${n ? ` (${n} note${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''})` : ''}.`, type: 'succes' });
      charger();
    } catch (err) {
      setToast({ message: messageErreur(err, 'impossible de supprimer cette matière'), type: 'erreur' });
    } finally {
      setMatiereASupprimer(null);
    }
  }

  return (
    <>
    <Formations />
    <div className="grille-2">
      <div className="carte">
        <div className="entete-carte">
          <h2>Unités d'enseignement</h2>
          <button type="button" className="secondaire" onClick={() => setImportStructure(true)} disabled={semestres.length === 0}>
            <IconUpload width={16} height={16} /> Importer UE et matières
          </button>
        </div>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 16 }}>
          Une UE regroupe plusieurs matières allant dans le même sens (ex. l'UE « Programmation » regroupe
          Python, PHP, Java). Clique une UE pour voir/ajouter ses matières.
        </p>
        {ues.map((ue) => (
          <div key={ue.id} style={{ marginBottom: 14, border: '1px solid var(--bordure)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setUeOuverte(ueOuverte === ue.id ? null : ue.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: 'var(--gris-fond)', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>
                <strong style={{ fontFamily: 'var(--police-mono)', fontSize: '0.8rem' }}>{ue.code}</strong>
                {' : '}{ue.intitule} <span style={{ color: 'var(--texte-clair)' }}>({ue.Semestre?.libelle}, coef. {ue.coefficient}, {ue.credits} crédits, {ue.Formation ? ue.Formation.mention : 'commune'})</span>
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--texte-clair)' }}>{ue.Matieres?.length ?? 0} matière(s)</span>
            </button>

            {ueOuverte === ue.id && (
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button type="button" className="secondaire" onClick={() => setUeEditee({ id: ue.id, code: ue.code, intitule: ue.intitule, credits: String(ue.credits), formationId: ue.formationId ? String(ue.formationId) : '' })}><IconEdit width={16} height={16} /> Modifier l’UE</button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Code</th><th>Matière</th><th>Coef.</th><th aria-label="Actions" /></tr></thead>
                    <tbody>
                      {(ue.Matieres || []).map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontFamily: 'var(--police-mono)' }}>{m.code}</td>
                          <td>{m.intitule}</td>
                          <td>{m.coefficient}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="secondaire danger petit" onClick={() => setMatiereASupprimer(m)} title={`Supprimer ${m.intitule}`}>
                              <IconTrash width={14} height={14} /> Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!ue.Matieres || ue.Matieres.length === 0) && <tr><td colSpan={4} className="vide">Aucune matière</td></tr>}
                    </tbody>
                  </table>
                </div>
                <form className="ligne-champs" style={{ marginTop: 12 }} onSubmit={(e) => creerMatiere(e, ue.id)}>
                  <div className="champ">
                    <label>Code</label>
                    <input placeholder="ex. PROG-PY" value={nouvelleMatiere.code} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, code: e.target.value })} required />
                  </div>
                  <div className="champ">
                    <label>Matière</label>
                    <input placeholder="ex. Python" value={nouvelleMatiere.intitule} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, intitule: e.target.value })} required />
                  </div>
                  <div className="champ" style={{ maxWidth: 90 }}>
                    <label>Coef.</label>
                    <input type="number" min="0.5" step="0.5" value={nouvelleMatiere.coefficient} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, coefficient: e.target.value })} required />
                  </div>
                  <button className="secondaire" type="submit" style={{ alignSelf: 'flex-end' }}>Ajouter la matière</button>
                </form>
              </div>
            )}
          </div>
        ))}
        {ues.length === 0 && <div className="vide">Aucune UE pour le moment</div>}
      </div>

      <div className="carte">
        <h2>Créer une UE</h2>
        {semestres.length === 0 && (
          <div className="message-erreur" style={{ marginBottom: 14 }}>
            Aucun semestre n'existe encore pour cet établissement. Crée-en un avant de pouvoir créer une UE.
          </div>
        )}
        {(formSemestreOuvert || semestres.length === 0) && (
          <form
            className="ligne-champs"
            style={{ marginBottom: 18, padding: 14, background: 'var(--gris-fond)', borderRadius: 10 }}
            onSubmit={creerSemestre}
          >
            <div className="champ">
              <label>Cycle</label>
              <select
                value={nouveauSemestre.cycle}
                onChange={(e) => setNouveauSemestre({ ...nouveauSemestre, cycle: e.target.value })}
              >
                {CYCLES.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Semestre</label>
              <select
                value={nouveauSemestre.numero}
                onChange={(e) => setNouveauSemestre({ ...nouveauSemestre, numero: e.target.value })}
              >
                {NUMEROS_SEMESTRE.map((n) => <option key={n} value={n}>Semestre {n}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Année scolaire</label>
              <input
                placeholder="ex. 2025-2026"
                value={nouveauSemestre.anneeScolaire}
                onChange={(e) => setNouveauSemestre({ ...nouveauSemestre, anneeScolaire: e.target.value })}
                required
              />
            </div>
            <button className="secondaire" type="submit" style={{ alignSelf: 'flex-end' }}>Créer le semestre</button>
          </form>
        )}
        <form className="formulaire" onSubmit={creerUE}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Code</label>
              <input placeholder="ex. UE-PROG-101" value={nouvelleUE.code} onChange={(e) => setNouvelleUE({ ...nouvelleUE, code: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Intitulé (thème)</label>
              <input placeholder="ex. Programmation" value={nouvelleUE.intitule} onChange={(e) => setNouvelleUE({ ...nouvelleUE, intitule: e.target.value })} required />
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Semestre
                <button
                  type="button"
                  onClick={() => setFormSemestreOuvert((v) => !v)}
                  style={{ background: 'none', border: 'none', color: 'var(--primaire)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}
                >
                  + Nouveau semestre
                </button>
              </label>
              <select value={nouvelleUE.semestreId} onChange={(e) => setNouvelleUE({ ...nouvelleUE, semestreId: e.target.value })} required>
                <option value="">Choisir un semestre</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Crédits</label>
              <input type="number" min="1" value={nouvelleUE.credits} onChange={(e) => setNouvelleUE({ ...nouvelleUE, credits: e.target.value })} required />
            </div>
          </div>
          <div className="champ">
            <label htmlFor="ue-formation">Formation</label>
            <select id="ue-formation" value={nouvelleUE.formationId} onChange={(e) => setNouvelleUE({ ...nouvelleUE, formationId: e.target.value })}>
              <option value="">Commune à toutes les classes</option>
              {formations.map((f) => <option key={f.id} value={f.id}>{libelleFormation(f)}</option>)}
            </select>
          </div>
          <button className="primaire" type="submit">Créer l'UE</button>
          {message && <div className={message === 'UE créée.' ? 'message-succes' : 'message-erreur'}>{message}</div>}
        </form>
      </div>
      {matiereASupprimer && (
        <ConfirmModal titre={`Supprimer « ${matiereASupprimer.intitule} » ?`} boutonConfirmer="Supprimer la matière" onConfirmer={supprimerMatiere} onAnnuler={() => setMatiereASupprimer(null)}>
          La matière sera retirée de son UE. Les notes déjà saisies pour cette matière (session normale et rattrapage) seront aussi supprimées, et les bulletins recalculés sans elle. Cette action est irréversible.
        </ConfirmModal>
      )}
      {importStructure && (
        <ImportStructure semestres={semestres} ues={ues} onFermer={() => setImportStructure(false)} onImporte={() => charger()} />
      )}
      {ueEditee && (
        <ModifierUE
          ue={ueEditee} formations={formations} onFermer={() => setUeEditee(null)}
          onModifiee={() => { setUeEditee(null); setToast({ message: 'UE modifiée.', type: 'succes' }); charger(); chargerFormations(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
    </>
  );
}

const libelleFormation = (f) => [f.mention, f.parcours].filter(Boolean).join(', ');

function ModifierUE({ ue, formations, onFermer, onModifiee }) {
  const [form, setForm] = useState(ue);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/unites-enseignement/${ue.id}`, { intitule: form.intitule, credits: Number(form.credits), formationId: form.formationId || null });
      onModifiee();
    } catch (err) {
      setErreur(messageErreur(err, 'modification impossible'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Modifier ${ue.code}`} onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="champ">
          <label htmlFor="mu-intitule">Intitulé</label>
          <input id="mu-intitule" value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="mu-credits">Crédits</label>
            <input id="mu-credits" type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} required />
          </div>
          <div className="champ">
            <label htmlFor="mu-formation">Formation</label>
            <select id="mu-formation" value={form.formationId} onChange={(e) => setForm({ ...form, formationId: e.target.value })}>
              <option value="">Commune à toutes les classes</option>
              {formations.map((f) => <option key={f.id} value={f.id}>{libelleFormation(f)}</option>)}
            </select>
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Import d'un fichier Excel/CSV décrivant les UE et leurs matières d'un
// semestre : une ligne par matière (Code UE, Intitulé UE, Crédits, Code
// matière, Matière, Coefficient). Une UE déjà présente dans ce semestre
// (même code) est complétée, jamais dupliquée ; une matière déjà présente
// dans son UE (même code) est ignorée.
function ImportStructure({ semestres, ues, onFermer, onImporte }) {
  const [semestreId, setSemestreId] = useState(semestres[0] ? String(semestres[0].id) : '');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  async function importer(e) {
    e.preventDefault();
    const fichier = e.target.elements.fichierStructure.files[0];
    if (!semestreId || !fichier) return;
    setEnCours(true);
    setResultat(null);
    const lignes = await lireFichierExcel(fichier);
    const parUE = new Map();
    const erreurs = [];
    lignes.forEach((l, i) => {
      const codeUE = String(l.codeue || '').trim();
      const intituleUE = String(l.intituleue || l.ue || '').trim();
      const codeMatiere = String(l.codematiere || '').trim();
      const intituleMatiere = String(l.matiere || l.intitulematiere || '').trim();
      if (!codeUE || !intituleUE || !codeMatiere || !intituleMatiere) { erreurs.push(`ligne ${i + 2} : code ou intitulé manquant`); return; }
      if (!parUE.has(codeUE)) parUE.set(codeUE, { code: codeUE, intitule: intituleUE, credits: Number(l.credits) || 0, matieres: [] });
      parUE.get(codeUE).matieres.push({ code: codeMatiere, intitule: intituleMatiere, coefficient: Number(String(l.coefficient || 1).replace(',', '.')) || 1 });
    });
    let uesCreees = 0; let matieresCreees = 0;
    for (const ue of parUE.values()) {
      try {
        let existante = ues.find((u) => u.code === ue.code && String(u.semestreId ?? u.Semestre?.id) === semestreId);
        if (!existante) {
          const res = await client.post('/unites-enseignement', { code: ue.code, intitule: ue.intitule, credits: ue.credits, coefficient: ue.credits || 1, semestreId });
          existante = { ...res.data.ue, Matieres: [] };
          uesCreees += 1;
        }
        for (const m of ue.matieres) {
          if ((existante.Matieres || []).some((x) => x.code === m.code)) continue;
          try {
            await client.post('/matieres', { ...m, uniteEnseignementId: existante.id });
            matieresCreees += 1;
          } catch (err) { erreurs.push(`matière ${m.code} : ${messageErreur(err, 'refusée')}`); }
        }
      } catch (err) { erreurs.push(`UE ${ue.code} : ${messageErreur(err, 'refusée')}`); }
    }
    setResultat({ uesCreees, matieresCreees, erreurs });
    setEnCours(false);
    onImporte();
    e.target.reset();
  }

  return (
    <Modal titre="Importer les UE et leurs matières" onFermer={enCours ? () => {} : onFermer} largeur={600}>
      <form className="formulaire" onSubmit={importer}>
        <p className="note-secondaire" style={{ marginTop: 0 }}>
          Une ligne par matière, avec les colonnes <strong>Code UE</strong>, <strong>Intitulé UE</strong>, <strong>Crédits</strong>,
          {' '}<strong>Code matière</strong>, <strong>Matière</strong> et <strong>Coefficient</strong>. Les UE déjà présentes dans le semestre sont complétées, pas dupliquées.
        </p>
        <div className="champ">
          <label htmlFor="is-sem">Semestre</label>
          <select id="is-sem" value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="is-fichier">Fichier Excel ou CSV</label>
          <input id="is-fichier" name="fichierStructure" type="file" accept=".xlsx,.xls,.csv" required />
        </div>
        {resultat && (
          <div className={resultat.erreurs.length ? 'message-erreur' : 'message-succes'}>
            {resultat.uesCreees} UE et {resultat.matieresCreees} matière{resultat.matieresCreees > 1 ? 's' : ''} créée{resultat.matieresCreees > 1 ? 's' : ''}.
            {resultat.erreurs.length > 0 && <> {resultat.erreurs.length} problème{resultat.erreurs.length > 1 ? 's' : ''} : {resultat.erreurs.slice(0, 5).join(' ; ')}.</>}
          </div>
        )}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer} disabled={enCours}>Fermer</button>
          <button type="submit" className="primaire" disabled={enCours || !semestreId}><IconUpload width={16} height={16} /> {enCours ? 'Import…' : 'Importer'}</button>
        </div>
      </form>
    </Modal>
  );
}
