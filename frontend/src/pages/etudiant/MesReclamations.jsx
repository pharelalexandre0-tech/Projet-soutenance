import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconPlus } from '../../components/icons';

const STATUTS = { en_attente: ['En cours d’examen', 'or'], acceptee: ['Acceptée', 'vert'], rejetee: ['Rejetée', 'rouge'] };
const note = (n) => (n == null ? '-' : String(n).replace('.', ','));

// Réclamations de notes de l'étudiant (ou de son parent) : dépôt motivé,
// suivi et réponse de l'établissement.
export default function MesReclamations() {
  const [donnees, setDonnees] = useState(null);
  const [form, setForm] = useState(null);
  const [erreur, setErreur] = useState('');
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/reclamations/moi').then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || { reclamations: [], matieres: [] }));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['reclamations', 'notes'] });

  async function deposer(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/reclamations', { matiereId: Number(form.matiereId), categorie: form.categorie, motif: form.motif });
      setForm(null);
      setToast({ message: 'Réclamation envoyée au service de la scolarité', type: 'succes' });
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'envoi impossible'));
    }
  }

  const matieres = donnees?.matieres || [];
  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Réclamations de notes</h2>
        <button type="button" className="primaire" disabled={!matieres.length} onClick={() => setForm({ matiereId: String(matieres[0]?.id || ''), categorie: 'examen', motif: '' })}><IconPlus /> Nouvelle réclamation</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Déposée le</th><th>Matière</th><th>Note</th><th>Statut</th><th>Réponse de l’établissement</th></tr></thead>
          <tbody>
            {(donnees?.reclamations || []).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="cellule-nom">{r.matiere?.intitule} ({r.categorie === 'cc' ? 'CC' : 'examen'})</td>
                <td className="cellule-nombre">{note(r.ancienneValeur)}{r.nouvelleValeur != null ? ` → ${note(r.nouvelleValeur)}` : ''}</td>
                <td><span className={`badge ${STATUTS[r.statut][1]}`}>{STATUTS[r.statut][0]}</span></td>
                <td className="cellule-texte">{r.reponse || <span className="note-secondaire">En attente de réponse</span>}</td>
              </tr>
            ))}
            {donnees && donnees.reclamations.length === 0 && <tr><td colSpan={5} className="vide">Aucune réclamation. Si une note vous semble erronée, déposez une réclamation motivée.</td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal titre="Nouvelle réclamation" onFermer={() => setForm(null)} largeur={520}>
          <form className="formulaire" onSubmit={deposer}>
            <div className="champ"><label htmlFor="rc-mat">Matière</label>
              <select id="rc-mat" value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })}>
                {matieres.map((m) => <option key={`${m.id}-${m.session}`} value={m.id}>{m.intitule} (CC {note(m.moyenneCC)}, examen {note(m.moyenneExamen)})</option>)}
              </select>
            </div>
            <div className="champ"><label htmlFor="rc-cat">Note contestée</label>
              <select id="rc-cat" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                <option value="examen">Examen</option>
                <option value="cc">Contrôle continu</option>
              </select>
            </div>
            <div className="champ"><label htmlFor="rc-motif">Motif</label><textarea id="rc-motif" rows={5} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Expliquez précisément ce qui vous semble erroné (exercice non compté, erreur de report...)" /></div>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setForm(null)}>Annuler</button>
              <button type="submit" className="primaire" disabled={form.motif.trim().length < 15}>Envoyer</button>
            </div>
          </form>
        </Modal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </section>
  );
}
