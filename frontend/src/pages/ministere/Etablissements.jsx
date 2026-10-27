import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { useNational, pct, nombre, note, dateFr, dateCourte, BadgeAgrement, EtatChargement, tonReussite, Telechargements } from './commun';
import { IconSearch, IconBuilding, IconChevronRight, IconArrowLeft } from '../../components/icons';
import Habilitations from './Habilitations';
import Inspections from './Inspections';

const FILTRES_AGREMENT = [
  { cle: '', libelle: 'Tous', test: () => true },
  { cle: 'agree', libelle: 'Agréés', test: (e) => e.agrementStatut === 'agree' },
  { cle: 'provisoire', libelle: 'Provisoires', test: (e) => e.agrementStatut === 'provisoire' },
  { cle: 'en_instruction', libelle: 'En instruction', test: (e) => e.agrementStatut === 'en_instruction' },
  { cle: 'sanction', libelle: 'Suspendus ou retirés', test: (e) => ['suspendu', 'retire'].includes(e.agrementStatut) },
];

// Registre national des établissements sous tutelle, puis la fiche de
// chacun (synthèse, agrément, formations, inspections, correspondance).
export default function Etablissements() {
  const { donnees: referentiel, erreur } = useNational();
  const [registre, setRegistre] = useState(null);
  const [filtres, setFiltres] = useState({ q: '', province: '', type: '', agrement: '' });
  const [ouvert, setOuvert] = useState(null);

  const charger = () => client.get('/ministere/registre').then((r) => setRegistre(r.data.etablissements)).catch(() => setRegistre((x) => x || []));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true, delai: 1500 });

  if (!referentiel || !registre) return <EtatChargement erreur={erreur} />;
  if (ouvert) return <FicheEtablissement id={ouvert} referentiel={referentiel} onRetour={() => { setOuvert(null); charger(); }} />;

  const q = filtres.q.trim().toLowerCase();
  const filtreAgrement = FILTRES_AGREMENT.find((f) => f.cle === filtres.agrement);
  const liste = registre.filter((e) => (!q || `${e.nom} ${e.sigle} ${e.ville} ${e.agrementNumero || ''}`.toLowerCase().includes(q))
    && (!filtres.province || e.province === filtres.province) && (!filtres.type || e.typeEtablissement === filtres.type) && filtreAgrement.test(e));

  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Registre national des établissements <span className="entete-carte-compteur">{liste.length}</span></h2>
        <Telechargements chemin="/api/ministere/registre" libelle="Télécharger le registre" />
      </div>
      <div className="filtres-puces" role="group" aria-label="Situation d’agrément">
        {FILTRES_AGREMENT.map((f) => (
          <button key={f.cle} type="button" aria-pressed={filtres.agrement === f.cle} className={filtres.agrement === f.cle ? 'actif' : ''} onClick={() => setFiltres({ ...filtres, agrement: f.cle })}>
            {f.libelle} <span>{registre.filter(f.test).length}</span>
          </button>
        ))}
      </div>
      <div className="barre-outils">
        <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Nom, sigle, ville ou arrêté…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher un établissement" /></label>
        <select className="filtre-select" value={filtres.province} onChange={(e) => setFiltres({ ...filtres, province: e.target.value })} aria-label="Province">
          <option value="">Toutes les provinces</option>
          {referentiel.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filtre-select" value={filtres.type} onChange={(e) => setFiltres({ ...filtres, type: e.target.value })} aria-label="Type">
          <option value="">Tous les types</option>
          {referentiel.types.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table className="table-ministere">
          <thead>
            <tr><th className="chiffre">N°</th><th>Établissement</th><th>Sigle</th><th>Province</th><th>Type</th><th>Agrément</th><th>N° de l’arrêté</th><th>Expire le</th><th className="chiffre">Formations</th><th>Dernière inspection</th><th className="chiffre">Recomm. ouvertes</th><th aria-label="Fiche" /></tr>
          </thead>
          <tbody>
            {liste.map((e) => (
              <tr key={e.id} className="ligne-cliquable" onClick={() => setOuvert(e.id)}>
                <td className="chiffre">{registre.indexOf(e) + 1}</td>
                <td className="cellule-nom">{e.nom}</td>
                <td>{e.sigle || ''}</td>
                <td>{e.province || <span className="note-secondaire">Non renseignée</span>}</td>
                <td>{e.libelleType}</td>
                <td><BadgeAgrement statut={e.agrementStatut} libelle={e.libelleAgrement} /></td>
                <td className="mono">{e.agrementNumero || ''}</td>
                <td>{dateCourte(e.agrementExpiration)}</td>
                <td className="chiffre">{e.formationsHabilitees}</td>
                <td>{dateCourte(e.derniereInspection) || <span className="note-secondaire">Aucune</span>}</td>
                <td className="chiffre">{e.recommandationsOuvertes ? <span className="texte-alerte">{e.recommandationsOuvertes}</span> : 0}</td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {liste.length === 0 && <tr><td colSpan={12} className="vide">Aucun établissement ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ONGLETS_FICHE = [
  ['synthese', 'Synthèse'], ['agrement', 'Agrément'], ['formations', 'Formations habilitées'], ['inspections', 'Inspections'], ['correspondance', 'Correspondance'],
];

function FicheEtablissement({ id, referentiel, onRetour }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');
  const [onglet, setOnglet] = useState('synthese');
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/ministere/etablissements/${id}`).then((r) => setFiche(r.data)).catch((err) => setErreur(messageErreur(err, 'fiche indisponible')));
  useEffect(() => { charger(); }, [id]);

  const e = fiche?.etablissement;
  return (
    <>
      <div className="retour-liste"><button type="button" className="bouton-texte" onClick={onRetour}><IconArrowLeft /> Registre national</button></div>
      {!fiche && (erreur ? <div className="message-erreur">{erreur}</div> : <div className="chargement">Chargement…</div>)}
      {e && (
        <>
          <section className="identite-ecole">
            <div className="identite-ecole-principal">
              <span className="vignette-logo grand"><IconBuilding /></span>
              <div className="identite-ecole-textes">
                <BadgeAgrement statut={e.agrementStatut} libelle={e.libelleAgrement} />
                <h2>{e.nom}</h2>
                <p>{[e.sigle, e.libelleType, `${e.ville}${e.province ? `, ${e.province}` : ''}`].filter(Boolean).join(' · ')}</p>
                {e.agrementNumero && <p className="identite-ecole-contact">Arrêté {e.agrementNumero}{e.agrementExpiration ? `, valable jusqu’au ${dateFr(e.agrementExpiration)}` : ''}</p>}
              </div>
            </div>
            <dl className="identite-ecole-chiffres">
              <div><dt>Étudiants</dt><dd>{nombre(e.effectif)}</dd></div>
              <div><dt>Enseignants</dt><dd>{nombre(e.enseignants)}</dd></div>
              <div><dt>Réussite</dt><dd style={{ color: tonReussite(e.tauxReussite) }}>{pct(e.tauxReussite)}</dd></div>
              <div><dt>Moyenne</dt><dd>{note(e.moyenne)}</dd></div>
            </dl>
          </section>

          <div className="onglets-secondaires" role="tablist">
            {ONGLETS_FICHE.map(([cle, libelle]) => (
              <button key={cle} type="button" role="tab" aria-selected={onglet === cle} className={onglet === cle ? 'actif' : ''} onClick={() => setOnglet(cle)}>{libelle}</button>
            ))}
          </div>

          {onglet === 'synthese' && <Synthese e={e} />}
          {onglet === 'agrement' && (
            <DecisionAgrement e={e} decisions={fiche.decisions} referentiel={referentiel} onDecision={(m) => { setToast({ message: m, type: 'succes' }); charger(); }} />
          )}
          {onglet === 'formations' && <Habilitations etablissement={e} />}
          {onglet === 'inspections' && <Inspections etablissement={e} />}
          {onglet === 'correspondance' && <Correspondance accuses={fiche.accuses} />}
        </>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function Synthese({ e }) {
  return (
    <div className="grille-deux">
      <section className="carte">
        <div className="entete-carte"><h2>Indicateurs</h2></div>
        <dl className="registre-chiffres">
          <div><dt>Classes</dt><dd>{nombre(e.classes)}</dd></div>
          <div><dt>Étudiants évalués</dt><dd>{nombre(e.evalues)}</dd></div>
          <div><dt>Admis</dt><dd>{nombre(e.admis)}</dd></div>
          <div><dt>À risque élevé de décrochage</dt><dd className={e.risqueEleve ? 'ton-rouge' : ''}>{nombre(e.risqueEleve)}</dd></div>
          <div><dt>Absences non justifiées</dt><dd>{nombre(e.absencesNonJustifiees)}</dd></div>
          <div><dt>Retards</dt><dd>{nombre(e.retards)}</dd></div>
          <div><dt>Documents certifiés émis</dt><dd>{nombre(e.documentsEmis)}</dd></div>
          <div><dt>Vérifications de documents</dt><dd>{nombre(e.documentsVerifies)}</dd></div>
        </dl>
      </section>
      <section className="carte">
        <div className="entete-carte"><h2>Résultats par niveau</h2></div>
        {e.parNiveau.length === 0 ? <div className="vide">Aucun résultat transmis.</div> : (
          <div className="table-scroll">
            <table className="table-ministere">
              <thead><tr><th>Niveau</th><th className="chiffre">Évalués</th><th className="chiffre">Admis</th><th className="chiffre">Réussite</th><th className="chiffre">Moyenne</th></tr></thead>
              <tbody>{e.parNiveau.map((n) => <tr key={n.niveau}><td className="cellule-nom">{n.niveau}</td><td className="chiffre">{n.evalues}</td><td className="chiffre">{n.admis}</td><td className="chiffre" style={{ color: tonReussite(n.tauxReussite), fontWeight: 700 }}>{pct(n.tauxReussite)}</td><td className="chiffre">{note(n.moyenne)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DecisionAgrement({ e, decisions, referentiel, onDecision }) {
  const [form, setForm] = useState({
    statut: e.agrementStatut, numero: e.agrementNumero || '', dateEffet: new Date().toISOString().slice(0, 10), dateExpiration: e.agrementExpiration || '',
    motif: '', typeEtablissement: e.typeEtablissement, province: e.province || '',
  });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const champ = (cle) => ({ value: form[cle], onChange: (ev) => setForm({ ...form, [cle]: ev.target.value }) });

  async function decider(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post(`/ministere/etablissements/${e.id}/agrement`, form);
      setForm({ ...form, motif: '' });
      onDecision('Décision enregistrée et notifiée à l’établissement');
    } catch (err) {
      setErreur(messageErreur(err, 'décision non enregistrée'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grille-deux">
      <section className="carte">
        <div className="entete-carte"><h2>Nouvelle décision d’agrément</h2></div>
        <form className="formulaire" onSubmit={decider}>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="ag-statut">Décision</label>
              <select id="ag-statut" {...champ('statut')}>{referentiel.statutsAgrement.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}</select>
            </div>
            <div className="champ"><label htmlFor="ag-numero">N° de l’arrêté</label><input id="ag-numero" placeholder="Arrêté n°…/MESR/2026" {...champ('numero')} /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="ag-effet">Date d’effet</label><input id="ag-effet" type="date" {...champ('dateEffet')} /></div>
            <div className="champ"><label htmlFor="ag-exp">Expire le (facultatif)</label><input id="ag-exp" type="date" {...champ('dateExpiration')} /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="ag-type">Type d’établissement</label>
              <select id="ag-type" {...champ('typeEtablissement')}>{referentiel.types.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}</select>
            </div>
            <div className="champ"><label htmlFor="ag-province">Province</label>
              <select id="ag-province" {...champ('province')}>
                <option value="">Non renseignée</option>
                {referentiel.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="champ"><label htmlFor="ag-motif">Motif (notifié à l’établissement)</label><textarea id="ag-motif" rows={4} placeholder="Ex. dossier complet, inspection pédagogique favorable" {...champ('motif')} /></div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button type="submit" className="primaire" disabled={enCours || form.motif.trim().length < 10}>{enCours ? 'Enregistrement…' : 'Enregistrer la décision'}</button>
        </form>
      </section>
      <section className="carte">
        <div className="entete-carte"><h2>Historique des décisions <span className="entete-carte-compteur">{decisions.length}</span></h2></div>
        {decisions.length === 0 && <div className="vide">Aucune décision enregistrée.</div>}
        <ol className="historique-decisions">
          {decisions.map((d) => (
            <li key={d.id}>
              <span className="historique-date">{dateCourte(d.dateEffet)}</span>
              <div>
                <strong>{referentiel.statutsAgrement.find((s) => s.valeur === d.statut)?.libelle}{d.numero ? `, arrêté ${d.numero}` : ''}</strong>
                <p>{d.motif}</p>
                <small>{d.decideParNom}{d.dateExpiration ? ` · valable jusqu’au ${dateCourte(d.dateExpiration)}` : ''}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Correspondance({ accuses }) {
  return (
    <section className="carte">
      <div className="entete-carte"><h2>Circulaires ouvertes par l’établissement <span className="entete-carte-compteur">{accuses.length}</span></h2></div>
      <div className="table-scroll">
        <table className="table-ministere">
          <thead><tr><th>Référence</th><th>Titre</th><th>Publiée le</th><th>Lue le</th><th>Accusé de réception</th></tr></thead>
          <tbody>
            {accuses.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.Circulaire?.reference}</td>
                <td className="cellule-nom">{a.Circulaire?.titre}</td>
                <td>{dateCourte(a.Circulaire?.publieeLe)}</td>
                <td>{dateCourte(a.lueLe)}</td>
                <td>{a.accuseLe ? <span className="badge vert">Le {dateCourte(a.accuseLe)}</span> : <span className="badge or">En attente</span>}</td>
              </tr>
            ))}
            {accuses.length === 0 && <tr><td colSpan={5} className="vide">Aucune circulaire ouverte par l’établissement.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
