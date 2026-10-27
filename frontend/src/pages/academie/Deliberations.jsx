import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import BoutonDocument from '../../components/BoutonDocument';
import ConfirmModal from '../../components/ConfirmModal';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconDownload, IconLock } from '../../components/icons';

const note = (n) => (n == null ? '-' : String(Math.round(n * 100) / 100).replace('.', ','));
const LIBELLES = { admis: 'Admis(e)', admis_jury: 'Admis(e) par le jury', rattrapage: 'Rattrapage' };

// Délibération du jury d'une classe pour un semestre : séance, décisions
// (le jury peut admettre un étudiant en rattrapage, motif obligatoire),
// clôture qui verrouille les notes, procès-verbal certifié.
export default function Deliberations() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [choix, setChoix] = useState({ classeId: '', semestreId: '' });
  const [donnees, setDonnees] = useState(null);
  const [seance, setSeance] = useState({ dateSeance: '', president: '', membres: '', observations: '' });
  const [decisions, setDecisions] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [motifReouverture, setMotifReouverture] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {});
    client.get('/semestres').then((r) => { setSemestres(r.data.semestres); setChoix((c) => (c.semestreId ? c : { ...c, semestreId: String(r.data.semestres[0]?.id || '') })); }).catch(() => {});
  }, []);

  function appliquer(d) {
    setDonnees(d);
    setSeance({ dateSeance: d.deliberation.dateSeance || new Date().toISOString().slice(0, 10), president: d.deliberation.president || '', membres: d.deliberation.membres || '', observations: d.deliberation.observations || '' });
    setDecisions(Object.fromEntries(d.lignes.map((l) => [l.eleveId, { decision: l.decision, motif: l.motif }])));
  }
  const charger = () => {
    if (!choix.classeId || !choix.semestreId) { setDonnees(null); return undefined; }
    return client.get(`/deliberations/${choix.classeId}/${choix.semestreId}`).then((r) => appliquer(r.data)).catch((e) => setErreur(messageErreur(e, 'jury indisponible')));
  };
  useEffect(() => { setErreur(''); charger(); }, [choix.classeId, choix.semestreId]);
  useActualisation(() => { if (!enCours) charger(); }, { domaines: ['deliberations', 'notes'], delai: 1500 });

  const close = donnees?.deliberation.statut === 'close';
  const base = `/deliberations/${choix.classeId}/${choix.semestreId}`;

  async function enregistrer() {
    setEnCours(true);
    setErreur('');
    try {
      const corps = { ...seance, decisions: Object.entries(decisions).map(([eleveId, d]) => ({ eleveId: Number(eleveId), ...d })) };
      appliquer((await client.put(base, corps)).data);
      setToast({ message: 'Séance du jury enregistrée', type: 'succes' });
    } catch (e) {
      setErreur(messageErreur(e, 'enregistrement impossible'));
    } finally {
      setEnCours(false);
    }
  }

  async function clore() {
    const corps = { ...seance, decisions: Object.entries(decisions).map(([eleveId, d]) => ({ eleveId: Number(eleveId), ...d })) };
    await client.put(base, corps);
    appliquer((await client.post(`${base}/clore`)).data);
    setConfirmation(null);
    setToast({ message: 'Délibération close : notes verrouillées, étudiants notifiés', type: 'succes' });
  }

  async function rouvrir() {
    appliquer((await client.post(`${base}/rouvrir`, { motif: motifReouverture })).data);
    setConfirmation(null);
    setMotifReouverture('');
    setToast({ message: 'Délibération rouverte', type: 'succes' });
  }

  return (
    <>
      <section className="carte">
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="d-classe">Classe</label>
            <select id="d-classe" value={choix.classeId} onChange={(e) => setChoix({ ...choix, classeId: e.target.value })}>
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="champ"><label htmlFor="d-sem">Semestre</label>
            <select id="d-sem" value={choix.semestreId} onChange={(e) => setChoix({ ...choix, semestreId: e.target.value })}>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
            </select>
          </div>
        </div>
      </section>

      {!choix.classeId && <div className="vide">Choisissez la classe dont le jury délibère.</div>}
      {erreur && <div className="message-erreur" style={{ marginBottom: 20 }}>{erreur}</div>}

      {donnees && (
        <>
          <div className="stats-grid">
            <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Étudiants évalués</span></div><div className="valeur">{donnees.stats.evalues}</div></div>
            <div className="stat-tile tile-vert"><div className="stat-tile-haut"><span className="libelle">Admis</span></div><div className="valeur">{donnees.stats.admis}</div><small className="stat-tile-note">dont {donnees.stats.parJury} par décision du jury</small></div>
            <div className="stat-tile tile-or"><div className="stat-tile-haut"><span className="libelle">Rattrapage</span></div><div className="valeur">{donnees.stats.rattrapage}</div></div>
            <div className={`stat-tile ${close ? 'tile-vert' : ''}`}><div className="stat-tile-haut"><span className="libelle">Séance</span></div><div className="valeur valeur-montant">{close ? 'Close' : 'Ouverte'}</div><small className="stat-tile-note">{close ? `le ${new Date(donnees.deliberation.closeLe).toLocaleDateString('fr-FR')} par ${donnees.deliberation.closeParNom}` : 'décisions modifiables'}</small></div>
          </div>

          <section className="carte">
            <div className="entete-carte">
              <h2>Séance du jury</h2>
              <div className="actions-entete">
                {!donnees.deliberation.nouvelle && (
                  <BoutonDocument className="secondaire" chemin={`/api${base}/pv`}><IconDownload width={16} height={16} /> Procès-verbal (PDF)</BoutonDocument>
                )}
                {close
                  ? <button type="button" className="secondaire" onClick={() => setConfirmation('rouvrir')}>Rouvrir la délibération</button>
                  : <>
                      <button type="button" className="secondaire" onClick={enregistrer} disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
                      <button type="button" className="primaire" onClick={() => setConfirmation('clore')} disabled={!seance.president.trim()}><IconLock /> Clore la délibération</button>
                    </>}
              </div>
            </div>
            <div className="ligne-champs">
              <div className="champ"><label htmlFor="d-date">Date de la séance</label><input id="d-date" type="date" value={seance.dateSeance} disabled={close} onChange={(e) => setSeance({ ...seance, dateSeance: e.target.value })} /></div>
              <div className="champ"><label htmlFor="d-pres">Président du jury</label><input id="d-pres" value={seance.president} disabled={close} onChange={(e) => setSeance({ ...seance, president: e.target.value })} placeholder="Nom et titre" /></div>
              <div className="champ" style={{ flex: 2 }}><label htmlFor="d-membres">Membres du jury</label><input id="d-membres" value={seance.membres} disabled={close} onChange={(e) => setSeance({ ...seance, membres: e.target.value })} placeholder="Séparés par des virgules" /></div>
            </div>
            <div className="champ" style={{ marginTop: 14 }}><label htmlFor="d-obs">Observations</label><textarea id="d-obs" rows={2} value={seance.observations} disabled={close} onChange={(e) => setSeance({ ...seance, observations: e.target.value })} /></div>
          </section>

          <section className="carte">
            <div className="entete-carte"><h2>Décisions <span className="entete-carte-compteur">{donnees.lignes.length}</span></h2>{close && <span className="badge vert"><IconLock width={13} height={13} /> Notes verrouillées</span>}</div>
            <div className="table-scroll">
              <table className="table-jury">
                <thead><tr><th>Matricule</th><th>Nom et prénom</th><th>Moyenne</th><th>Crédits</th><th>UE non validées</th><th>Décision calculée</th><th>Décision du jury</th><th>Motif</th></tr></thead>
                <tbody>
                  {donnees.lignes.map((l) => {
                    const d = decisions[l.eleveId] || {};
                    return (
                      <tr key={l.eleveId}>
                        <td className="mono">{l.matricule}</td>
                        <td className="cellule-nom">{l.nom} {l.prenom}</td>
                        <td className="cellule-nombre">{l.evalue ? note(l.moyenne) : '-'}</td>
                        <td className="cellule-nombre">{l.evalue ? `${l.creditsValides}/${l.creditsTotal}` : '-'}</td>
                        <td>{l.uesNonValidees.join(', ')}</td>
                        <td>{l.evalue ? <span className={`badge ${l.decisionCalculee === 'admis' ? 'vert' : 'or'}`}>{LIBELLES[l.decisionCalculee]}</span> : <span className="note-secondaire">Non évalué</span>}</td>
                        <td>
                          {!l.evalue || l.decisionCalculee === 'admis' || close
                            ? (l.evalue ? <strong>{LIBELLES[d.decision || l.decision]}</strong> : '')
                            : (
                              <select value={d.decision} onChange={(e) => setDecisions({ ...decisions, [l.eleveId]: { ...d, decision: e.target.value } })} aria-label={`Décision du jury pour ${l.prenom} ${l.nom}`}>
                                <option value="rattrapage">Rattrapage</option>
                                <option value="admis_jury">Admis(e) par le jury</option>
                              </select>
                            )}
                        </td>
                        <td>
                          {d.decision === 'admis_jury' && !close
                            ? <input value={d.motif || ''} onChange={(e) => setDecisions({ ...decisions, [l.eleveId]: { ...d, motif: e.target.value } })} placeholder="Motif obligatoire" aria-label="Motif" />
                            : <span className="note-secondaire">{d.motif || ''}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {confirmation === 'clore' && (
        <ConfirmModal titre="Clore la délibération" boutonConfirmer="Clore et verrouiller" boutonEnCours="Clôture…" onConfirmer={clore} onAnnuler={() => setConfirmation(null)}>
          Les décisions deviennent définitives, les notes de la classe pour ce semestre sont verrouillées et les étudiants sont prévenus. Les bulletins reprennent la décision du jury.
        </ConfirmModal>
      )}
      {confirmation === 'rouvrir' && (
        <Modal titre="Rouvrir la délibération" onFermer={() => setConfirmation(null)} largeur={460}>
          <div className="formulaire">
            <p className="confirmation-texte">Les notes redeviennent modifiables. La réouverture est inscrite au journal d’audit et au procès-verbal.</p>
            <div className="champ"><label htmlFor="d-motif">Motif de la réouverture</label><textarea id="d-motif" rows={3} value={motifReouverture} onChange={(e) => setMotifReouverture(e.target.value)} /></div>
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setConfirmation(null)}>Annuler</button>
              <button type="button" className="primaire" disabled={motifReouverture.trim().length < 10} onClick={() => rouvrir().catch((e) => setToast({ message: messageErreur(e, 'réouverture impossible'), type: 'erreur' }))}>Rouvrir</button>
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
