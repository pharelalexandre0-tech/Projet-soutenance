import { useEffect, useState } from 'react';
import client from '../../api/client';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { useNational, pct, nombre, note, dateFr, BadgeAgrement, EtatChargement, tonReussite } from './commun';
import { IconSearch, IconBuilding, IconChevronRight } from '../../components/icons';

// Établissements sous tutelle : registre, fiche, historique des décisions et
// prise de décision d'agrément.
export default function Etablissements() {
  const { donnees, erreur, recharger } = useNational();
  const [filtres, setFiltres] = useState({ q: '', province: '', statut: '' });
  const [ouvert, setOuvert] = useState(null);
  const [toast, setToast] = useState(null);
  if (!donnees) return <EtatChargement erreur={erreur} />;

  const q = filtres.q.trim().toLowerCase();
  const liste = donnees.etablissements.filter((e) => (!q || `${e.nom} ${e.sigle} ${e.ville}`.toLowerCase().includes(q))
    && (!filtres.province || e.province === filtres.province) && (!filtres.statut || e.agrementStatut === filtres.statut));

  return (
    <section className="carte">
      <div className="entete-carte"><h2>Registre des établissements <span className="entete-carte-compteur">{liste.length}</span></h2></div>
      <div className="barre-outils">
        <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Nom, sigle ou ville…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher un établissement" /></label>
        <select className="filtre-select" value={filtres.province} onChange={(e) => setFiltres({ ...filtres, province: e.target.value })} aria-label="Province">
          <option value="">Toutes les provinces</option>
          {donnees.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filtre-select" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })} aria-label="Agrément">
          <option value="">Tous les agréments</option>
          {donnees.statutsAgrement.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table className="table-ministere">
          <thead><tr><th>Établissement</th><th>Province</th><th>Type</th><th>Agrément</th><th>N° d’arrêté</th><th>Expire le</th><th>Étudiants</th><th>Réussite</th><th>Moyenne</th><th aria-label="Fiche" /></tr></thead>
          <tbody>
            {liste.map((e) => (
              <tr key={e.id} className="ligne-cliquable" onClick={() => setOuvert(e.id)}>
                <td className="cellule-nom">{e.nom}</td>
                <td>{e.province || <span className="note-secondaire">Non renseignée</span>}</td>
                <td>{e.libelleType}</td>
                <td><BadgeAgrement statut={e.agrementStatut} libelle={e.libelleAgrement} /></td>
                <td className="mono">{e.agrementNumero || ''}</td>
                <td>{dateFr(e.agrementExpiration)}</td>
                <td className="cellule-nombre">{nombre(e.effectif)}</td>
                <td className="cellule-nombre" style={{ color: tonReussite(e.tauxReussite), fontWeight: 700 }}>{pct(e.tauxReussite)}</td>
                <td className="cellule-nombre">{note(e.moyenne)}</td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {liste.length === 0 && <tr><td colSpan={10} className="vide">Aucun établissement ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
      {ouvert && (
        <FicheEtablissement
          id={ouvert}
          referentiel={donnees}
          onFermer={() => setOuvert(null)}
          onDecision={(message) => { setToast({ message, type: 'succes' }); recharger(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </section>
  );
}

function FicheEtablissement({ id, referentiel, onFermer, onDecision }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const charger = () => client.get(`/ministere/etablissements/${id}`).then((r) => {
    setFiche(r.data);
    const e = r.data.etablissement;
    setForm({ statut: e.agrementStatut, numero: e.agrementNumero || '', dateEffet: new Date().toISOString().slice(0, 10), dateExpiration: e.agrementExpiration || '', motif: '', typeEtablissement: e.typeEtablissement, province: e.province || '' });
  }).catch((err) => setErreur(messageErreur(err, 'fiche indisponible')));
  useEffect(() => { charger(); }, [id]);

  async function decider(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post(`/ministere/etablissements/${id}/agrement`, form);
      onDecision('Décision enregistrée et notifiée à l’établissement');
      await charger();
    } catch (err) {
      setErreur(messageErreur(err, 'décision non enregistrée'));
    } finally {
      setEnCours(false);
    }
  }

  const e = fiche?.etablissement;
  return (
    <Tiroir titre={e?.nom || 'Établissement'} sousTitre={e ? `${e.ville}${e.province ? `, ${e.province}` : ''} · ${e.libelleType}` : ''} icone={<span className="tuile-fonctionnalite"><IconBuilding /></span>} onFermer={onFermer}>
      {!fiche && !erreur && <div className="chargement">Chargement…</div>}
      {erreur && !fiche && <div className="message-erreur">{erreur}</div>}
      {e && (
        <>
          <section className="tiroir-section">
            <dl className="registre-chiffres">
              <div><dt>Agrément</dt><dd><BadgeAgrement statut={e.agrementStatut} libelle={e.libelleAgrement} /></dd></div>
              <div><dt>Étudiants</dt><dd>{nombre(e.effectif)}</dd></div>
              <div><dt>Enseignants</dt><dd>{nombre(e.enseignants)}</dd></div>
              <div><dt>Réussite</dt><dd style={{ color: tonReussite(e.tauxReussite) }}>{pct(e.tauxReussite)}</dd></div>
              <div><dt>Moyenne</dt><dd>{note(e.moyenne)}</dd></div>
              <div><dt>À risque élevé</dt><dd className={e.risqueEleve ? 'ton-rouge' : ''}>{nombre(e.risqueEleve)}</dd></div>
              <div><dt>Absences non justifiées</dt><dd>{nombre(e.absencesNonJustifiees)}</dd></div>
              <div><dt>Documents certifiés</dt><dd>{nombre(e.documentsEmis)}</dd></div>
            </dl>
          </section>
          {e.parNiveau.length > 0 && (
            <section className="tiroir-section">
              <h3>Résultats par niveau</h3>
              <div className="table-scroll">
                <table><thead><tr><th>Niveau</th><th>Évalués</th><th>Admis</th><th>Réussite</th><th>Moyenne</th></tr></thead>
                  <tbody>{e.parNiveau.map((n) => <tr key={n.niveau}><td>{n.niveau}</td><td className="cellule-nombre">{n.evalues}</td><td className="cellule-nombre">{n.admis}</td><td className="cellule-nombre">{pct(n.tauxReussite)}</td><td className="cellule-nombre">{note(n.moyenne)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
          <section className="tiroir-section">
            <h3>Décision d’agrément</h3>
            <form className="formulaire" onSubmit={decider}>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="ag-statut">Décision</label>
                  <select id="ag-statut" value={form.statut} onChange={(ev) => setForm({ ...form, statut: ev.target.value })}>
                    {referentiel.statutsAgrement.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                  </select>
                </div>
                <div className="champ"><label htmlFor="ag-numero">N° de l’arrêté</label><input id="ag-numero" value={form.numero} onChange={(ev) => setForm({ ...form, numero: ev.target.value })} placeholder="Arrêté n°…/MESR/2026" /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="ag-effet">Date d’effet</label><input id="ag-effet" type="date" value={form.dateEffet} onChange={(ev) => setForm({ ...form, dateEffet: ev.target.value })} /></div>
                <div className="champ"><label htmlFor="ag-exp">Expire le (facultatif)</label><input id="ag-exp" type="date" value={form.dateExpiration} onChange={(ev) => setForm({ ...form, dateExpiration: ev.target.value })} /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="ag-type">Type d’établissement</label>
                  <select id="ag-type" value={form.typeEtablissement} onChange={(ev) => setForm({ ...form, typeEtablissement: ev.target.value })}>
                    {referentiel.types.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                  </select>
                </div>
                <div className="champ"><label htmlFor="ag-province">Province</label>
                  <select id="ag-province" value={form.province} onChange={(ev) => setForm({ ...form, province: ev.target.value })}>
                    <option value="">Non renseignée</option>
                    {referentiel.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="champ"><label htmlFor="ag-motif">Motif (notifié à l’établissement)</label><textarea id="ag-motif" rows={3} value={form.motif} onChange={(ev) => setForm({ ...form, motif: ev.target.value })} placeholder="Ex. dossier complet, inspection pédagogique favorable" /></div>
              {erreur && <div className="message-erreur">{erreur}</div>}
              <button type="submit" className="primaire" disabled={enCours || form.motif.trim().length < 10}>{enCours ? 'Enregistrement…' : 'Enregistrer la décision'}</button>
            </form>
          </section>
          <section className="tiroir-section">
            <h3>Historique des décisions</h3>
            {fiche.decisions.length === 0 && <p className="note-secondaire">Aucune décision enregistrée.</p>}
            <ol className="liste-activite">
              {fiche.decisions.map((d) => (
                <li key={d.id}>
                  <span className="liste-activite-icone"><IconBuilding /></span>
                  <div>
                    <span><strong>{referentiel.statutsAgrement.find((s) => s.valeur === d.statut)?.libelle}</strong>{d.numero ? `, ${d.numero}` : ''}</span>
                    <small>{dateFr(d.dateEffet)} · {d.decideParNom} · {d.motif}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="tiroir-section">
            <h3>Circulaires reçues</h3>
            {fiche.accuses.length === 0 && <p className="note-secondaire">Aucune circulaire ouverte par l’établissement.</p>}
            <ul className="liste-sessions">
              {fiche.accuses.map((a) => (
                <li key={a.id}>
                  <div><strong>{a.Circulaire?.reference} · {a.Circulaire?.titre}</strong><span>Lue le {dateFr(a.lueLe)}</span></div>
                  {a.accuseLe ? <span className="badge vert">Accusé de réception</span> : <span className="badge or">Lue, sans accusé</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Tiroir>
  );
}
