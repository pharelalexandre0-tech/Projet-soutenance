import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconUsers, IconCircleAlert, IconClock, IconWallet, IconSearch, IconSend, IconRocket } from '../../components/icons';

const STYLE_STATUT = { impaye: 'rouge', partiel: 'or', du: 'gris', solde: 'vert', sans_frais: 'gris' };
const LIBELLE_STATUT = { impaye: 'Impayé', partiel: 'Partiel', du: 'Dû', solde: 'À jour', sans_frais: 'Sans frais' };
const FILTRES = [
  { id: '', libelle: 'Tous' },
  { id: 'impaye', libelle: 'Impayés' },
  { id: 'partiel', libelle: 'Partiels' },
  { id: 'du', libelle: 'Dus' },
  { id: 'solde', libelle: 'À jour' },
];

function fcfa(montant) {
  return `${Math.round(montant || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

// Diagramme d'activité 9 : vérification quotidienne -> vue d'ensemble par
// niveau puis par classe -> relance -> escalade si besoin.
export default function Impayes() {
  const [niveaux, setNiveaux] = useState(null);
  const [dernierResultat, setDernierResultat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [enRelance, setEnRelance] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');
  const [classeId, setClasseId] = useState('');
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/finance/impayes/par-classe').then((res) => setNiveaux(res.data.niveaux)).catch(() => setNiveaux([]));
  }
  useEffect(charger, []);

  async function verifier() {
    setEnCours(true);
    try {
      const res = await client.post('/finance/impayes/verifier');
      setDernierResultat(res.data);
      charger();
    } catch (err) {
      setToast({ message: messageErreur(err, 'la vérification a échoué'), type: 'erreur' });
    } finally {
      setEnCours(false);
    }
  }

  async function relancer(eleve) {
    if (!eleve.fraisARelancerId) return;
    setEnRelance(eleve.id);
    try {
      await client.post(`/finance/impayes/${eleve.fraisARelancerId}/relance`);
      setToast({ message: `Relance envoyée pour ${eleve.prenom} ${eleve.nom}.`, type: 'succes' });
    } catch (err) {
      setToast({ message: messageErreur(err, "échec de l'envoi de la relance"), type: 'erreur' });
    } finally {
      setEnRelance(null);
    }
  }

  const tous = (niveaux || []).flatMap((n) => n.classes.flatMap((c) => c.eleves));
  const compte = (s) => tous.filter((e) => e.statutGlobal === s).length;
  const resteTotal = tous.reduce((s, e) => s + (e.resteDu > 0 ? e.resteDu : 0), 0);
  const r = recherche.trim().toLowerCase();
  const correspond = (e) => (!statut || e.statutGlobal === statut) && (!r || `${e.prenom} ${e.nom} ${e.nom} ${e.prenom}`.toLowerCase().includes(r));
  const filtreActif = !!(r || statut);
  const groupes = (niveaux || []).flatMap((n) => n.classes
    .filter((c) => !classeId || String(c.id) === classeId)
    .map((c) => ({ niveau: n.niveau, classe: c, eleves: c.eleves.filter(correspond) }))
    .filter((g) => !filtreActif || g.eleves.length > 0));
  const nbAffiches = groupes.reduce((s, g) => s + g.eleves.length, 0);
  const classes = (niveaux || []).flatMap((n) => n.classes.map((c) => ({ ...c, niveau: n.niveau })));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Élèves suivis</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{niveaux ? tous.length : '…'}</div>
        </div>
        <div className={`stat-tile ${compte('impaye') ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Impayés</span><span className="puce-icone petite"><IconCircleAlert /></span></div>
          <div className="valeur">{niveaux ? compte('impaye') : '…'}</div>
        </div>
        <div className={`stat-tile ${compte('partiel') ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Paiements partiels</span><span className="puce-icone petite"><IconClock /></span></div>
          <div className="valeur">{niveaux ? compte('partiel') : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Reste à recouvrer</span><span className="puce-icone petite"><IconWallet /></span></div>
          <div className="valeur valeur-montant">{niveaux ? fcfa(resteTotal) : '…'}</div>
        </div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Vue d'ensemble par niveau et par classe <span className="entete-carte-compteur">{nbAffiches} élève{nbAffiches > 1 ? 's' : ''}</span></h2>
          <button className="secondaire" onClick={verifier} disabled={enCours}>
            <IconRocket /> {enCours ? 'Vérification…' : 'Vérifier les échéances'}
          </button>
        </div>
        {dernierResultat && (
          <div className="message-succes" style={{ marginBottom: 16 }}>
            Vérification terminée : {dernierResultat.nombreMarquesImpayes} frais passé(s) en impayé. Elle tourne aussi automatiquement chaque jour.
          </div>
        )}
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un élève" />
          </label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Filtrer par classe" className="filtre-select">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
          <div className="filtres-puces" role="group" aria-label="Filtrer par statut">
            {FILTRES.map((f) => (
              <button key={f.id} type="button" className={statut === f.id ? 'actif' : ''} onClick={() => setStatut(f.id)}>{f.libelle}</button>
            ))}
          </div>
        </div>

        <div className="table-scroll defilement-visible">
          <table className="table-impayes">
            <thead>
              <tr>
                <th>Élève</th>
                <th className="chiffre">Total dû</th>
                <th className="chiffre">Déjà réglé</th>
                <th className="chiffre">Reste dû</th>
                <th>Statut</th>
                <th className="cellule-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map(({ niveau, classe, eleves }) => (
                <Fragment key={classe.id}>
                  <tr className="ligne-groupe">
                    <td colSpan={6}>
                      <span className="ligne-groupe-niveau">{niveau}</span>
                      <strong>{classe.nom}</strong>
                      <span className="entete-carte-compteur">{classe.eleves.length} élève{classe.eleves.length > 1 ? 's' : ''}</span>
                      {classe.eleves.length === 0 && <span className="note-secondaire">Aucun élève dans cette classe</span>}
                    </td>
                  </tr>
                  {eleves.map((eleve) => (
                    <tr key={eleve.id}>
                      <td className="cellule-nom">{eleve.nom} {eleve.prenom}</td>
                      <td className="chiffre">{eleve.totalDu ? fcfa(eleve.totalDu) : <span className="note-secondaire">Aucun frais</span>}</td>
                      <td className="chiffre note-secondaire">{eleve.totalDu ? fcfa(eleve.totalRegle) : ''}</td>
                      <td className={`chiffre ${eleve.resteDu > 0 ? 'reste-du' : 'ton-reussite'}`}>{eleve.totalDu ? (eleve.resteDu > 0 ? fcfa(eleve.resteDu) : 'Soldé') : ''}</td>
                      <td><span className={`badge ${STYLE_STATUT[eleve.statutGlobal]}`}>{LIBELLE_STATUT[eleve.statutGlobal]}</span></td>
                      <td className="cellule-actions">
                        {eleve.fraisARelancerId ? (
                          <button className="bouton-icone-texte" disabled={enRelance === eleve.id} onClick={() => relancer(eleve)}>
                            <IconSend /> {enRelance === eleve.id ? 'Envoi…' : 'Relancer'}
                          </button>
                        ) : <span className="note-secondaire">Aucune</span>}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {niveaux && groupes.length === 0 && (
                <tr><td colSpan={6} className="vide">{tous.length === 0 && !classes.length ? 'Aucune classe enregistrée.' : 'Aucun élève ne correspond à cette recherche.'}</td></tr>
              )}
              {!niveaux && <tr><td colSpan={6} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
