import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconEdit, IconPlus, IconTrash } from '../../components/icons';

const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const CREDITS = { licence: 180, master: 120, doctorat: 180 };
const VIDE = { cycle: 'licence', domaine: '', mention: '', parcours: '', creditsRequis: '180' };

// Formations (maquettes) de l'école : chaque classe et chaque UE peuvent s'y
// rattacher. Une UE sans formation reste commune à toutes les classes.
export default function Formations() {
  const [formations, setFormations] = useState(null);
  const [edition, setEdition] = useState(null); // formulaire ouvert
  const [aSupprimer, setASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/formations').then((r) => setFormations(r.data.formations)).catch(() => setFormations([]));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['formations', 'classes', 'unites-enseignement'] });

  async function supprimer() {
    try {
      await client.delete(`/formations/${aSupprimer.id}`);
      setToast({ message: `Formation « ${aSupprimer.mention} » supprimée. Ses classes et ses UE sont conservées.`, type: 'succes' });
      charger();
    } catch (e) {
      setToast({ message: messageErreur(e, 'suppression impossible'), type: 'erreur' });
    } finally {
      setASupprimer(null);
    }
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Formations <span className="entete-carte-compteur">{formations?.length ?? 0}</span></h2>
        <button type="button" className="secondaire" onClick={() => setEdition(VIDE)}><IconPlus width={16} height={16} /> Nouvelle formation</button>
      </div>
      <p className="note-secondaire">Une formation réunit ses classes et ses UE. Une UE sans formation reste commune à toutes les classes de l’établissement.</p>
      {formations && formations.length === 0 && <div className="vide">Aucune formation pour le moment : toutes les UE sont communes.</div>}
      {formations && formations.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Cycle</th><th>Domaine</th><th>Mention</th><th>Parcours</th><th className="cellule-nombre">Crédits requis</th><th className="cellule-nombre">Crédits au programme</th><th className="cellule-nombre">UE</th><th className="cellule-nombre">Classes</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {formations.map((f) => (
                <tr key={f.id}>
                  <td>{CYCLES[f.cycle]}</td><td>{f.domaine || ''}</td><td className="cellule-nom">{f.mention}</td><td>{f.parcours || ''}</td>
                  <td className="cellule-nombre">{f.creditsRequis}</td>
                  <td className="cellule-nombre">{(f.UniteEnseignements || []).reduce((s, u) => s + u.credits, 0)}</td>
                  <td className="cellule-nombre">{f.UniteEnseignements?.length ?? 0}</td>
                  <td className="cellule-nombre">{f.Classes?.length ?? 0}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="bouton-icone" aria-label={`Modifier ${f.mention}`} onClick={() => setEdition({ id: f.id, cycle: f.cycle, domaine: f.domaine || '', mention: f.mention, parcours: f.parcours || '', creditsRequis: String(f.creditsRequis) })}><IconEdit width={16} height={16} /></button>
                    <button type="button" className="bouton-icone" aria-label={`Supprimer ${f.mention}`} onClick={() => setASupprimer(f)}><IconTrash width={16} height={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edition && <FormulaireFormation initial={edition} onFermer={() => setEdition(null)} onEnregistre={(m) => { setEdition(null); setToast({ message: m, type: 'succes' }); charger(); }} />}
      {aSupprimer && (
        <ConfirmModal titre={`Supprimer « ${aSupprimer.mention} » ?`} boutonConfirmer="Supprimer la formation" onConfirmer={supprimer} onAnnuler={() => setASupprimer(null)}>
          Les classes et les UE de cette formation sont conservées, et ses UE redeviennent communes à toutes les classes. Aucune note n’est supprimée.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function FormulaireFormation({ initial, onFermer, onEnregistre }) {
  const [form, setForm] = useState(initial);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      if (form.id) await client.put(`/formations/${form.id}`, form);
      else await client.post('/formations', form);
      onEnregistre(form.id ? 'Formation modifiée.' : 'Formation créée.');
    } catch (err) {
      setErreur(messageErreur(err, 'enregistrement impossible'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={form.id ? 'Modifier la formation' : 'Nouvelle formation'} onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="f-cycle">Cycle</label>
            <select id="f-cycle" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value, creditsRequis: String(CREDITS[e.target.value]) })}>
              {Object.entries(CYCLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="f-credits">Crédits requis</label>
            <input id="f-credits" type="number" min="1" max="600" value={form.creditsRequis} onChange={maj('creditsRequis')} required />
          </div>
        </div>
        <div className="champ">
          <label htmlFor="f-domaine">Domaine</label>
          <input id="f-domaine" placeholder="ex. Sciences et technologies" value={form.domaine} onChange={maj('domaine')} />
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="f-mention">Mention</label>
            <input id="f-mention" placeholder="ex. Informatique" value={form.mention} onChange={maj('mention')} required />
          </div>
          <div className="champ">
            <label htmlFor="f-parcours">Parcours</label>
            <input id="f-parcours" placeholder="ex. Génie logiciel" value={form.parcours} onChange={maj('parcours')} />
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
