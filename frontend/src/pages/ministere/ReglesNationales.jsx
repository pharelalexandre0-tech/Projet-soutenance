import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { ChampsRegles } from '../superadmin/ParametrageEcole';

const fr = (n) => (n === null || n === undefined ? '-' : String(n).replace('.', ','));
const resume = (r) => `seuil ${fr(r.seuilValidation)}, éliminatoire ${fr(r.noteEliminatoire)}, compensation ${r.compensationActive ? `dès ${fr(r.noteMinCompensation)}` : 'non'}, dette ${r.passageDetteActif ? `dès ${fr(r.creditsMinPassagePct)} %` : 'non'}`;

// Ministère : référentiel national des règles LMD. Chaque publication crée une
// version ; les établissements l'appliquent en un clic depuis leurs paramètres.
export default function ReglesNationales() {
  const [donnees, setDonnees] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmation, setConfirmation] = useState(false);
  const [toast, setToast] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => client.get('/ministere/regles-nationales').then((r) => {
    setDonnees(r.data);
    const a = r.data.actuelle;
    setForm((f) => f || {
      seuilValidation: String(a?.seuilValidation ?? 10), noteEliminatoire: String(a?.noteEliminatoire ?? 7),
      compensationActive: Boolean(a?.compensationActive), noteMinCompensation: a?.noteMinCompensation ?? '',
      passageDetteActif: Boolean(a?.passageDetteActif), creditsMinPassagePct: a?.creditsMinPassagePct ?? '',
      texteReference: '', commentaire: '',
    });
  }).catch(() => setDonnees({ actuelle: null, historique: [], etablissements: [] }));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['ministere', 'etablissement'] });

  async function publier() {
    setErreur('');
    try {
      await client.post('/ministere/regles-nationales', form);
      setToast({ message: 'Nouvelle version publiée : les établissements peuvent l’appliquer depuis leurs paramètres.', type: 'succes' });
      setForm({ ...form, texteReference: '', commentaire: '' });
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'publication impossible'));
    } finally {
      setConfirmation(false);
    }
  }

  if (!donnees || !form) return <div className="chargement">Chargement…</div>;
  const conformes = donnees.etablissements.filter((e) => e.conforme).length;
  return (
    <>
      <section className="carte">
        <div className="entete-carte"><h2>Référentiel en vigueur</h2></div>
        {donnees.actuelle ? (
          <dl className="usage-quotas">
            <div><dt>Version</dt><dd>{donnees.actuelle.version}</dd><small>{new Date(donnees.actuelle.createdAt).toLocaleDateString('fr-FR')}</small></div>
            <div><dt>Texte de référence</dt><dd style={{ fontSize: 17 }}>{donnees.actuelle.texteReference}</dd><small>{resume(donnees.actuelle)}</small></div>
            <div><dt>Établissements qui l’appliquent</dt><dd>{conformes} / {donnees.etablissements.length}</dd></div>
          </dl>
        ) : <div className="vide">Aucun référentiel national publié : chaque établissement applique ses propres règles.</div>}
      </section>

      <section className="carte">
        <h2>Publier une nouvelle version</h2>
        <form className="formulaire" onSubmit={(e) => { e.preventDefault(); setConfirmation(true); }} style={{ maxWidth: 760 }}>
          <div className="champ"><label htmlFor="rn-texte">Texte de référence</label><input id="rn-texte" placeholder="ex. Arrêté n° … du … fixant les modalités d’évaluation" value={form.texteReference} onChange={(e) => setForm({ ...form, texteReference: e.target.value })} required /></div>
          <ChampsRegles valeur={form} onChange={(v) => setForm({ ...form, ...v })} />
          <div className="champ"><label htmlFor="rn-com">Commentaire (facultatif)</label><textarea id="rn-com" rows={2} value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} /></div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button type="submit" className="primaire">Publier</button>
        </form>
      </section>

      <section className="carte">
        <h2>Situation des établissements <span className="entete-carte-compteur">{donnees.etablissements.length}</span></h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Établissement</th><th>Ville</th><th>Règles appliquées</th><th>Référentiel</th></tr></thead>
          <tbody>{donnees.etablissements.map((e) => (
            <tr key={e.id}><td className="cellule-nom">{e.nom}</td><td>{e.ville}</td><td>{resume(e.regles)}</td>
              <td>{e.conforme === null ? <span className="note-secondaire">Aucun</span> : <span className={`badge ${e.conforme ? 'vert' : 'or'}`}>{e.conforme ? 'Appliqué' : 'Règles propres'}</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </section>

      {donnees.historique.length > 0 && (
        <section className="carte">
          <h2>Historique des versions</h2>
          <div className="table-scroll"><table>
            <thead><tr><th className="cellule-nombre">Version</th><th>Date</th><th>Texte de référence</th><th>Règles</th><th>Publié par</th></tr></thead>
            <tbody>{donnees.historique.map((h) => <tr key={h.id}><td className="cellule-nombre">{h.version}</td><td>{new Date(h.createdAt).toLocaleDateString('fr-FR')}</td><td>{h.texteReference}</td><td>{resume(h)}</td><td>{h.publieParNom}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}

      {confirmation && (
        <ConfirmModal titre="Publier ces règles nationales ?" boutonConfirmer="Publier" onConfirmer={publier} onAnnuler={() => setConfirmation(false)}>
          Une nouvelle version du référentiel sera publiée ({form.texteReference}). Chaque établissement pourra l’appliquer depuis ses paramètres ; ses règles actuelles ne changent pas sans son accord.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
