import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconPlus, IconSearch } from '../../components/icons';
import { CYCLES, STATUTS_HABILITATION, dateCourte } from './commun';

const VIDE = { etablissementId: '', cycle: 'licence', domaine: '', mention: '', specialite: '', numeroArrete: '', dateDebut: new Date().toISOString().slice(0, 10), dateFin: '', statut: 'habilitee', observations: '' };

// Offres de formation habilitées par le Ministère (licence, master,
// doctorat), pour tous les établissements ou pour un seul (fiche).
export default function Habilitations({ etablissement = null }) {
  const [habilitations, setHabilitations] = useState(null);
  const [etablissements, setEtablissements] = useState([]);
  const [filtres, setFiltres] = useState({ q: '', cycle: '', statut: '' });
  const [edition, setEdition] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/ministere/habilitations${etablissement ? `?etablissementId=${etablissement.id}` : ''}`)
    .then((r) => setHabilitations(r.data.habilitations)).catch(() => setHabilitations((h) => h || []));
  useEffect(() => {
    charger();
    if (!etablissement) client.get('/ministere/registre').then((r) => setEtablissements(r.data.etablissements)).catch(() => {});
  }, [etablissement?.id]);
  useActualisation(charger, { domaines: ['ministere'] });

  const q = filtres.q.trim().toLowerCase();
  const liste = (habilitations || []).filter((h) => (!filtres.cycle || h.cycle === filtres.cycle) && (!filtres.statut || h.statut === filtres.statut)
    && (!q || `${h.domaine} ${h.mention} ${h.specialite || ''} ${h.numeroArrete || ''} ${h.Etablissement?.nom || ''}`.toLowerCase().includes(q)));
  const compter = (c) => (habilitations || []).filter((h) => h.cycle === c && h.statut !== 'retiree').length;

  return (
    <>
      {!etablissement && (
        <div className="stats-grid">
          {Object.entries(CYCLES).map(([c, l]) => (
            <div key={c} className="stat-tile"><div className="stat-tile-haut"><span className="libelle">{l}s habilitées</span></div><div className="valeur">{compter(c)}</div></div>
          ))}
          <div className="stat-tile tile-or"><div className="stat-tile-haut"><span className="libelle">En renouvellement</span></div><div className="valeur">{(habilitations || []).filter((h) => h.statut === 'en_renouvellement').length}</div></div>
        </div>
      )}
      <section className="carte">
        <div className="entete-carte">
          <h2>{etablissement ? 'Formations habilitées' : 'Habilitation des formations'} <span className="entete-carte-compteur">{liste.length}</span></h2>
          <button type="button" className="primaire" onClick={() => setEdition({ ...VIDE, etablissementId: etablissement?.id || '' })}><IconPlus /> Habiliter une formation</button>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Domaine, mention, arrêté…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher une formation" /></label>
          <select className="filtre-select" value={filtres.cycle} onChange={(e) => setFiltres({ ...filtres, cycle: e.target.value })} aria-label="Cycle">
            <option value="">Tous les cycles</option>
            {Object.entries(CYCLES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
          <select className="filtre-select" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })} aria-label="Statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS_HABILITATION).map(([s, [l]]) => <option key={s} value={s}>{l}</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table className="table-ministere">
            <thead>
              <tr>
                {!etablissement && <th>Établissement</th>}
                <th>Cycle</th><th>Domaine</th><th>Mention</th><th>Spécialité</th><th>N° de l’arrêté</th><th>Du</th><th>Au</th><th>Statut</th><th aria-label="Modifier" />
              </tr>
            </thead>
            <tbody>
              {liste.map((h) => (
                <tr key={h.id}>
                  {!etablissement && <td className="cellule-nom">{h.Etablissement?.nom}</td>}
                  <td>{CYCLES[h.cycle]}</td>
                  <td>{h.domaine}</td>
                  <td className="cellule-nom">{h.mention}</td>
                  <td>{h.specialite || ''}</td>
                  <td className="mono">{h.numeroArrete || ''}</td>
                  <td>{dateCourte(h.dateDebut)}</td>
                  <td>{dateCourte(h.dateFin)}</td>
                  <td><span className={`badge ${STATUTS_HABILITATION[h.statut][1]}`}>{STATUTS_HABILITATION[h.statut][0]}</span></td>
                  <td><button type="button" className="secondaire petit" onClick={() => setEdition({ ...VIDE, ...h, dateFin: h.dateFin || '', specialite: h.specialite || '', numeroArrete: h.numeroArrete || '', observations: h.observations || '' })}>Modifier</button></td>
                </tr>
              ))}
              {habilitations && liste.length === 0 && <tr><td colSpan={10} className="vide">Aucune formation habilitée{etablissement ? ' pour cet établissement' : ''}.</td></tr>}
              {!habilitations && <tr><td colSpan={10} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {edition && (
        <FormulaireHabilitation
          initial={edition}
          etablissements={etablissement ? [etablissement] : etablissements}
          onFermer={() => setEdition(null)}
          onEnregistre={(m) => { setEdition(null); charger(); setToast({ message: m, type: 'succes' }); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireHabilitation({ initial, etablissements, onFermer, onEnregistre }) {
  const [form, setForm] = useState(initial);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const champ = (cle) => ({ value: form[cle] ?? '', onChange: (e) => setForm({ ...form, [cle]: e.target.value }) });

  async function valider(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      if (form.id) await client.put(`/ministere/habilitations/${form.id}`, form);
      else await client.post('/ministere/habilitations', form);
      onEnregistre(form.id ? 'Habilitation mise à jour, établissement prévenu' : 'Formation habilitée, établissement prévenu');
    } catch (err) {
      setErreur(messageErreur(err, 'enregistrement impossible'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={form.id ? 'Modifier l’habilitation' : 'Habiliter une formation'} onFermer={onFermer} largeur={620}>
      <form className="formulaire" onSubmit={valider}>
        {!form.id && (
          <div className="champ"><label htmlFor="hb-etab">Établissement</label>
            <select id="hb-etab" required {...champ('etablissementId')}>
              <option value="">Choisir un établissement</option>
              {etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
        )}
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="hb-cycle">Cycle</label>
            <select id="hb-cycle" {...champ('cycle')}>{Object.entries(CYCLES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
          </div>
          <div className="champ"><label htmlFor="hb-domaine">Domaine</label><input id="hb-domaine" required placeholder="Ex. Sciences et technologies" {...champ('domaine')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="hb-mention">Mention</label><input id="hb-mention" required placeholder="Ex. Informatique" {...champ('mention')} /></div>
          <div className="champ"><label htmlFor="hb-spec">Spécialité (facultatif)</label><input id="hb-spec" placeholder="Ex. Génie logiciel" {...champ('specialite')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="hb-arrete">N° de l’arrêté</label><input id="hb-arrete" placeholder="Ex. 0042/MESR/2026" {...champ('numeroArrete')} /></div>
          <div className="champ"><label htmlFor="hb-statut">Statut</label>
            <select id="hb-statut" {...champ('statut')}>{Object.entries(STATUTS_HABILITATION).map(([s, [l]]) => <option key={s} value={s}>{l}</option>)}</select>
          </div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="hb-debut">Habilitée à compter du</label><input id="hb-debut" type="date" required {...champ('dateDebut')} /></div>
          <div className="champ"><label htmlFor="hb-fin">Jusqu’au (facultatif)</label><input id="hb-fin" type="date" {...champ('dateFin')} /></div>
        </div>
        <div className="champ"><label htmlFor="hb-obs">Observations</label><textarea id="hb-obs" rows={3} {...champ('observations')} /></div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}
