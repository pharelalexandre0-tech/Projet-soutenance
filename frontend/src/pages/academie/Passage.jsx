import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';

const note = (n) => (n == null ? '-' : String(Math.round(n * 100) / 100).replace('.', ','));
const DECISIONS = { passage: 'Passage', redoublement: 'Redoublement', sortie: 'Sortie' };

// Fin d'année : chaque étudiant d'une classe passe en année supérieure,
// redouble ou quitte l'établissement. Proposition calculée (tous les
// semestres de l'année validés = passage), modifiable, puis appliquée.
export default function Passage() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [donnees, setDonnees] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [superieure, setSuperieure] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [toast, setToast] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => { client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {}); }, []);
  const charger = () => {
    if (!classeId) { setDonnees(null); return; }
    client.get(`/passage/${classeId}`).then((r) => {
      setDonnees(r.data);
      setDecisions(Object.fromEntries(r.data.lignes.map((l) => [l.eleveId, l.proposition])));
      setErreur('');
    }).catch((e) => setErreur(messageErreur(e, 'proposition indisponible')));
  };
  useEffect(charger, [classeId]);

  async function appliquer() {
    const affectations = donnees.lignes.map((l) => ({ eleveId: l.eleveId, decision: decisions[l.eleveId], moyenneAnnuelle: l.moyenneAnnuelle }));
    const r = await client.post(`/passage/${classeId}`, { affectations, anneeScolaire: donnees.anneeScolaire, classeSuperieureId: superieure || null });
    setConfirmation(false);
    setToast({ message: `${r.data.passes} étudiant(s) passé(s) en classe supérieure, parcours enregistré`, type: 'succes' });
    charger();
  }

  const compte = (d) => Object.values(decisions).filter((x) => x === d).length;
  return (
    <>
      <section className="carte">
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="p-classe">Classe de départ</label>
            <select id="p-classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          {donnees && (
            <div className="champ"><label htmlFor="p-sup">Classe d’arrivée des admis</label>
              <select id="p-sup" value={superieure} onChange={(e) => setSuperieure(e.target.value)}>
                <option value="">Choisir la classe supérieure</option>
                {donnees.classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
              </select>
            </div>
          )}
        </div>
      </section>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {!classeId && <div className="vide">Choisissez la classe dont l’année se termine.</div>}
      {donnees && (
        <section className="carte">
          <div className="entete-carte">
            <h2>Année {donnees.anneeScolaire} <span className="entete-carte-compteur">{donnees.lignes.length}</span></h2>
            <div className="actions-entete">
              <span className="note-secondaire">{compte('passage')} passage · {compte('redoublement')} redoublement · {compte('sortie')} sortie</span>
              <button type="button" className="primaire" disabled={!donnees.lignes.length || (compte('passage') > 0 && !superieure)} onClick={() => setConfirmation(true)}>Valider les passages</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Matricule</th><th>Nom et prénom</th>{donnees.semestres.map((s) => <th key={s.id}>{s.libelle}</th>)}<th>Moyenne annuelle</th><th>Proposition</th><th>Décision</th></tr></thead>
              <tbody>
                {donnees.lignes.map((l) => (
                  <tr key={l.eleveId}>
                    <td className="mono">{l.matricule}</td>
                    <td className="cellule-nom">{l.nom} {l.prenom}</td>
                    {l.resultats.map((r) => (
                      <td key={r.semestreId}>{r.evalue ? <span className={`badge ${r.admis ? 'vert' : 'or'}`}>{note(r.moyenne)} {r.admis ? (r.decisionJury === 'admis_jury' ? 'jury' : 'validé') : 'rattrapage'}</span> : <span className="note-secondaire">Non évalué</span>}</td>
                    ))}
                    <td className="cellule-nombre">{note(l.moyenneAnnuelle)}</td>
                    <td>{DECISIONS[l.proposition]}</td>
                    <td>
                      <select value={decisions[l.eleveId]} onChange={(e) => setDecisions({ ...decisions, [l.eleveId]: e.target.value })} aria-label={`Décision pour ${l.prenom} ${l.nom}`}>
                        {Object.entries(DECISIONS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {donnees.lignes.length === 0 && <tr><td colSpan={5 + donnees.semestres.length} className="vide">Aucun étudiant dans cette classe.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {donnees?.historique?.length > 0 && (
        <section className="carte">
          <h2>Parcours déjà enregistrés depuis cette classe</h2>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Année</th><th>Décision</th><th>Classe d’arrivée</th><th>Moyenne</th><th>Par</th></tr></thead>
              <tbody>{donnees.historique.map((h) => <tr key={h.id}><td>{new Date(h.createdAt).toLocaleDateString('fr-FR')}</td><td>{h.anneeScolaire}</td><td>{DECISIONS[h.decision]}</td><td>{h.classeArrivee || ''}</td><td className="cellule-nombre">{note(h.moyenneAnnuelle)}</td><td>{h.decideParNom}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {confirmation && (
        <ConfirmModal titre="Valider les passages" boutonConfirmer="Valider" boutonEnCours="Enregistrement…" onConfirmer={appliquer} onAnnuler={() => setConfirmation(false)}>
          {compte('passage')} étudiant(s) rejoindront la classe supérieure choisie, {compte('redoublement')} restent dans leur classe, {compte('sortie')} quittent l’établissement. Le parcours de chacun est enregistré, les notes déjà acquises sont conservées.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
