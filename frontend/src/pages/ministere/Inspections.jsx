import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import BoutonDocument from '../../components/BoutonDocument';
import { messageErreur } from '../../utils/erreurs';
import { IconPlus, IconSearch, IconChevronRight, IconClipboard, IconDownload, IconTrash } from '../../components/icons';
import { NATURES_INSPECTION, STATUTS_INSPECTION, AVIS, STATUTS_RECO, dateCourte } from './commun';

// Missions d'inspection dans les établissements : programmation, rapport
// (constats, avis, recommandations), suivi des recommandations et rapport
// officiel en PDF certifié.
export default function Inspections({ etablissement = null }) {
  const [inspections, setInspections] = useState(null);
  const [etablissements, setEtablissements] = useState([]);
  const [filtres, setFiltres] = useState({ q: '', statut: '' });
  const [programmation, setProgrammation] = useState(false);
  const [ouverte, setOuverte] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/ministere/inspections${etablissement ? `?etablissementId=${etablissement.id}` : ''}`)
    .then((r) => setInspections(r.data.inspections)).catch(() => setInspections((i) => i || []));
  useEffect(() => {
    charger();
    if (!etablissement) client.get('/ministere/registre').then((r) => setEtablissements(r.data.etablissements)).catch(() => {});
  }, [etablissement?.id]);
  useActualisation(charger, { domaines: ['ministere', 'tutelle'] });

  const q = filtres.q.trim().toLowerCase();
  const liste = (inspections || []).filter((i) => (!filtres.statut || i.statut === filtres.statut)
    && (!q || `${i.reference} ${i.objet} ${i.inspecteurs} ${i.Etablissement?.nom || ''}`.toLowerCase().includes(q)));
  const recos = (inspections || []).flatMap((i) => i.RecommandationInspections || []);
  const notifier = (message) => setToast({ message, type: 'succes' });

  return (
    <>
      {!etablissement && (
        <div className="stats-grid">
          <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Missions programmées</span></div><div className="valeur">{(inspections || []).filter((i) => i.statut === 'programmee').length}</div></div>
          <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Rapports rendus</span></div><div className="valeur">{(inspections || []).filter((i) => ['realisee', 'cloturee'].includes(i.statut)).length}</div></div>
          <div className="stat-tile tile-rouge"><div className="stat-tile-haut"><span className="libelle">Recommandations à mettre en œuvre</span></div><div className="valeur">{recos.filter((r) => r.statut !== 'realisee').length}</div></div>
          <div className="stat-tile tile-vert"><div className="stat-tile-haut"><span className="libelle">Recommandations réalisées</span></div><div className="valeur">{recos.filter((r) => r.statut === 'realisee').length}</div></div>
        </div>
      )}
      <section className="carte">
        <div className="entete-carte">
          <h2>{etablissement ? 'Inspections de l’établissement' : 'Inspections et contrôles'} <span className="entete-carte-compteur">{liste.length}</span></h2>
          <button type="button" className="primaire" onClick={() => setProgrammation(true)}><IconPlus /> Programmer une mission</button>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Référence, objet, inspecteur…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher une mission" /></label>
          <select className="filtre-select" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })} aria-label="Statut">
            <option value="">Toutes les missions</option>
            {Object.entries(STATUTS_INSPECTION).map(([s, [l]]) => <option key={s} value={s}>{l}</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table className="table-ministere">
            <thead>
              <tr>
                <th>Référence</th>{!etablissement && <th>Établissement</th>}<th>Nature</th><th>Objet</th><th>Date prévue</th><th>Statut</th><th>Avis</th><th className="chiffre">Recommandations</th><th aria-label="Ouvrir" />
              </tr>
            </thead>
            <tbody>
              {liste.map((i) => {
                const r = i.RecommandationInspections || [];
                return (
                  <tr key={i.id} className="ligne-cliquable" onClick={() => setOuverte(i.id)}>
                    <td className="mono">{i.reference}</td>
                    {!etablissement && <td className="cellule-nom">{i.Etablissement?.nom}</td>}
                    <td>{NATURES_INSPECTION[i.nature]}</td>
                    <td className="cellule-texte-long">{i.objet}</td>
                    <td>{dateCourte(i.datePrevue)}</td>
                    <td><span className={`badge ${STATUTS_INSPECTION[i.statut][1]}`}>{STATUTS_INSPECTION[i.statut][0]}</span></td>
                    <td>{i.avis ? <span className={`badge ${AVIS[i.avis][1]}`}>{AVIS[i.avis][0]}</span> : ''}</td>
                    <td className="chiffre">{r.length ? `${r.filter((x) => x.statut === 'realisee').length} / ${r.length}` : ''}</td>
                    <td className="cellule-chevron"><IconChevronRight /></td>
                  </tr>
                );
              })}
              {inspections && liste.length === 0 && <tr><td colSpan={9} className="vide">Aucune mission d’inspection.</td></tr>}
              {!inspections && <tr><td colSpan={9} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {programmation && (
        <ProgrammerMission
          etablissements={etablissement ? [etablissement] : etablissements}
          fixe={etablissement?.id}
          onFermer={() => setProgrammation(false)}
          onFait={() => { setProgrammation(false); charger(); notifier('Mission programmée, établissement prévenu'); }}
        />
      )}
      {ouverte && <FicheInspection id={ouverte} inspections={inspections} onFermer={() => setOuverte(null)} onMaj={(m) => { charger(); if (m) notifier(m); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function ProgrammerMission({ etablissements, fixe, onFermer, onFait }) {
  const [form, setForm] = useState({ etablissementId: fixe || '', nature: 'pedagogique', objet: '', inspecteurs: '', datePrevue: '' });
  const [erreur, setErreur] = useState('');
  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm({ ...form, [cle]: e.target.value }) });
  async function valider(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/ministere/inspections', form);
      onFait();
    } catch (err) {
      setErreur(messageErreur(err, 'programmation impossible'));
    }
  }
  return (
    <Modal titre="Programmer une mission d’inspection" onFermer={onFermer} largeur={600}>
      <form className="formulaire" onSubmit={valider}>
        {!fixe && (
          <div className="champ"><label htmlFor="in-etab">Établissement</label>
            <select id="in-etab" required {...champ('etablissementId')}>
              <option value="">Choisir un établissement</option>
              {etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
        )}
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="in-nature">Nature</label>
            <select id="in-nature" {...champ('nature')}>{Object.entries(NATURES_INSPECTION).map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
          </div>
          <div className="champ"><label htmlFor="in-date">Date de la mission</label><input id="in-date" type="date" required {...champ('datePrevue')} /></div>
        </div>
        <div className="champ"><label htmlFor="in-objet">Objet de la mission</label><textarea id="in-objet" rows={3} required placeholder="Ex. contrôle de conformité des maquettes LMD et des conditions d’examen" {...champ('objet')} /></div>
        <div className="champ"><label htmlFor="in-insp">Inspecteurs</label><input id="in-insp" required placeholder="Ex. M. NZE (chef de mission), Mme ELLA" {...champ('inspecteurs')} /></div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire">Programmer</button>
        </div>
      </form>
    </Modal>
  );
}

function FicheInspection({ id, inspections, onFermer, onMaj }) {
  const inspection = (inspections || []).find((i) => i.id === id);
  const [rapport, setRapport] = useState(false);
  const [erreur, setErreur] = useState('');
  if (!inspection) return null;
  const recos = inspection.RecommandationInspections || [];

  async function action(fn, message) {
    setErreur('');
    try {
      await fn();
      onMaj(message);
    } catch (err) {
      setErreur(messageErreur(err, 'action impossible'));
    }
  }

  return (
    <Tiroir
      titre={inspection.reference}
      sousTitre={`${inspection.Etablissement?.nom || ''} · ${NATURES_INSPECTION[inspection.nature]}`}
      icone={<span className="tuile-fonctionnalite"><IconClipboard /></span>}
      onFermer={onFermer}
      pied={(
        <>
          {inspection.statut === 'programmee' && <button type="button" className="secondaire danger" onClick={() => action(() => client.put(`/ministere/inspections/${id}`, { statut: 'annulee' }), 'Mission annulée')}>Annuler la mission</button>}
          {['programmee', 'realisee'].includes(inspection.statut) && <button type="button" className="secondaire" onClick={() => setRapport(true)}>{inspection.statut === 'programmee' ? 'Rendre le rapport' : 'Modifier le rapport'}</button>}
          {inspection.statut === 'realisee' && <button type="button" className="primaire" onClick={() => action(() => client.post(`/ministere/inspections/${id}/cloture`), 'Mission clôturée')}>Clôturer</button>}
          {inspection.dateRealisee && <BoutonDocument className="primaire" chemin={`/api/ministere/inspections/${id}/rapport`}><IconDownload width={16} height={16} /> Rapport PDF</BoutonDocument>}
        </>
      )}
    >
      {erreur && <div className="message-erreur">{erreur}</div>}
      <section className="tiroir-section">
        <dl className="fiche-coordonnees">
          <div><dt>Statut</dt><dd><span className={`badge ${STATUTS_INSPECTION[inspection.statut][1]}`}>{STATUTS_INSPECTION[inspection.statut][0]}</span></dd></div>
          <div><dt>Avis</dt><dd>{inspection.avis ? <span className={`badge ${AVIS[inspection.avis][1]}`}>{AVIS[inspection.avis][0]}</span> : 'Non rendu'}</dd></div>
          <div><dt>Date prévue</dt><dd>{dateCourte(inspection.datePrevue)}</dd></div>
          <div><dt>Réalisée le</dt><dd>{dateCourte(inspection.dateRealisee) || 'Pas encore'}</dd></div>
          <div><dt>Inspecteurs</dt><dd>{inspection.inspecteurs}</dd></div>
          <div><dt>Programmée par</dt><dd>{inspection.creeParNom || ''}</dd></div>
        </dl>
      </section>
      <section className="tiroir-section"><h3>Objet</h3><p className="texte-paragraphe">{inspection.objet}</p></section>
      {inspection.constats && <section className="tiroir-section"><h3>Constats</h3><p className="texte-paragraphe">{inspection.constats}</p></section>}
      {recos.length > 0 && (
        <section className="tiroir-section">
          <h3>Recommandations <span className="entete-carte-compteur">{recos.length}</span></h3>
          <ol className="liste-recommandations">
            {recos.map((r) => (
              <li key={r.id}>
                <div className="reco-entete">
                  <strong>{r.texte}</strong>
                  <select value={r.statut} aria-label="Suivi de la recommandation" disabled={inspection.statut === 'cloturee'}
                    onChange={(e) => action(() => client.put(`/ministere/recommandations/${r.id}`, { statut: e.target.value }), 'Suivi mis à jour')}>
                    {Object.entries(STATUTS_RECO).map(([s, [l]]) => <option key={s} value={s}>{l}</option>)}
                  </select>
                </div>
                <small>{r.echeance ? `Échéance : ${dateCourte(r.echeance)}` : 'Sans échéance'}</small>
                {r.reponse && <p className="reco-reponse"><b>Réponse de l’établissement</b> ({dateCourte(r.reponduLe)}, {r.reponduParNom}) : {r.reponse}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {rapport && <RendreRapport inspection={inspection} onFermer={() => setRapport(false)} onFait={() => { setRapport(false); onMaj('Rapport enregistré, établissement prévenu'); }} />}
    </Tiroir>
  );
}

function RendreRapport({ inspection, onFermer, onFait }) {
  const [form, setForm] = useState({
    dateRealisee: inspection.dateRealisee || inspection.datePrevue, constats: inspection.constats || '', avis: inspection.avis || 'favorable',
    recommandations: (inspection.RecommandationInspections || []).filter((r) => !r.reponse).map((r) => ({ texte: r.texte, echeance: r.echeance || '' })),
  });
  const [erreur, setErreur] = useState('');
  const majReco = (i, cle, v) => setForm({ ...form, recommandations: form.recommandations.map((r, j) => (j === i ? { ...r, [cle]: v } : r)) });

  async function valider(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.put(`/ministere/inspections/${inspection.id}`, form);
      onFait();
    } catch (err) {
      setErreur(messageErreur(err, 'rapport non enregistré'));
    }
  }

  return (
    <Modal titre={`Rapport de la mission ${inspection.reference}`} onFermer={onFermer} largeur={680}>
      <form className="formulaire" onSubmit={valider}>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="rp-date">Réalisée le</label><input id="rp-date" type="date" required value={form.dateRealisee} onChange={(e) => setForm({ ...form, dateRealisee: e.target.value })} /></div>
          <div className="champ"><label htmlFor="rp-avis">Avis de la mission</label>
            <select id="rp-avis" value={form.avis} onChange={(e) => setForm({ ...form, avis: e.target.value })}>{Object.entries(AVIS).map(([a, [l]]) => <option key={a} value={a}>{l}</option>)}</select>
          </div>
        </div>
        <div className="champ"><label htmlFor="rp-constats">Constats</label><textarea id="rp-constats" rows={5} required value={form.constats} onChange={(e) => setForm({ ...form, constats: e.target.value })} /></div>
        <fieldset className="groupe-recommandations">
          <legend>Recommandations à l’établissement</legend>
          {form.recommandations.map((r, i) => (
            <div key={i} className="ligne-recommandation">
              <input aria-label={`Recommandation ${i + 1}`} value={r.texte} placeholder="Recommandation" onChange={(e) => majReco(i, 'texte', e.target.value)} />
              <input aria-label={`Échéance ${i + 1}`} type="date" value={r.echeance} onChange={(e) => majReco(i, 'echeance', e.target.value)} />
              <button type="button" className="bouton-icone" aria-label="Retirer" onClick={() => setForm({ ...form, recommandations: form.recommandations.filter((_, j) => j !== i) })}><IconTrash /></button>
            </div>
          ))}
          <button type="button" className="secondaire petit" onClick={() => setForm({ ...form, recommandations: [...form.recommandations, { texte: '', echeance: '' }] })}><IconPlus /> Ajouter une recommandation</button>
        </fieldset>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire">Enregistrer le rapport</button>
        </div>
      </form>
    </Modal>
  );
}
