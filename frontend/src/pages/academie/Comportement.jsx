import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconFlag, IconClipboard, IconTrendingDown, IconMail, IconSearch, IconTrash, IconCheck } from '../../components/icons';

const STYLE_NIVEAU = { faible: 'vert', moyen: 'or', eleve: 'rouge' };
const LIBELLE_NIVEAU = { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' };
const GRAVITES = [
  { valeur: 'mineur', libelle: 'Mineur', exemple: 'Retards répétés, bavardages, oubli de matériel, tenue…' },
  { valeur: 'majeur', libelle: 'Majeur', exemple: 'Violence, insulte, fraude, dégradation, absences répétées…' },
];

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateCourte(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR');
}

// Signalement de comportement : troisième signal du calcul de risque (avec
// les notes et les absences). Chaque incident va au dossier de l'élève
// (journal ci-contre, espace Parents), relance le calcul de son score et,
// si la case est cochée, prévient le parent.
export default function Comportement() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [incidents, setIncidents] = useState(null);
  const [form, setForm] = useState({ classeId: '', eleveId: '', date: aujourdhui(), gravite: 'mineur', description: '', informerParent: true });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);
  const [filtreClasse, setFiltreClasse] = useState('');
  const [recherche, setRecherche] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);
  const [toast, setToast] = useState(null);

  function chargerIncidents() {
    client.get('/incidents').then((res) => setIncidents(res.data.incidents)).catch(() => setIncidents([]));
  }
  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    chargerIncidents();
  }, []);
  useEffect(() => {
    if (form.classeId) client.get(`/eleves?classeId=${form.classeId}`).then((res) => setEleves(res.data.eleves));
    else setEleves([]);
    setForm((f) => ({ ...f, eleveId: '' }));
  }, [form.classeId]);

  const eleve = eleves.find((e) => String(e.id) === form.eleveId);
  const sansParent = !!eleve && !eleve.parent;
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    setResultat(null);
    try {
      const res = await client.post('/incidents', {
        eleveId: Number(form.eleveId), date: form.date, gravite: form.gravite, description: form.description,
        informerParent: form.informerParent && !sansParent,
      });
      setResultat({ ...res.data, eleve: `${eleve.prenom} ${eleve.nom}` });
      setForm((f) => ({ ...f, description: '', gravite: 'mineur' }));
      chargerIncidents();
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer ce signalement"));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    await client.delete(`/incidents/${aSupprimer.id}`);
    setASupprimer(null);
    setToast({ message: 'Signalement retiré, score de risque recalculé.', type: 'succes' });
    chargerIncidents();
  }

  const r = recherche.trim().toLowerCase();
  const affiches = (incidents || [])
    .filter((i) => !filtreClasse || String(i.classe?.id) === filtreClasse)
    .filter((i) => !r || `${i.eleve?.prenom} ${i.eleve?.nom} ${i.description}`.toLowerCase().includes(r));
  const majeurs = (incidents || []).filter((i) => i.gravite === 'majeur').length;

  return (
    <>
      <div className="grille-signalement">
        <section className="carte">
          <div className="entete-carte"><h2>Signaler un incident</h2></div>
          <form className="formulaire" onSubmit={enregistrer}>
            <div className="ligne-champs">
              <div className="champ">
                <label htmlFor="inc-classe">Classe</label>
                <select id="inc-classe" value={form.classeId} onChange={maj('classeId')} required>
                  <option value="">Choisir une classe</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="inc-eleve">Élève</label>
                <select id="inc-eleve" value={form.eleveId} onChange={maj('eleveId')} required disabled={!form.classeId}>
                  <option value="">Choisir un élève</option>
                  {eleves.map((el) => <option key={el.id} value={el.id}>{el.nom} {el.prenom}</option>)}
                </select>
              </div>
            </div>
            <div className="champ champ-date">
              <label htmlFor="inc-date">Date des faits</label>
              <input id="inc-date" type="date" value={form.date} max={aujourdhui()} onChange={maj('date')} required />
            </div>
            <div className="champ">
              <label>Gravité</label>
              <div className="choix-type">
                {GRAVITES.map((g) => (
                  <button
                    key={g.valeur} type="button" aria-pressed={form.gravite === g.valeur}
                    className={`option-type ${form.gravite === g.valeur ? 'choisie' : ''}`}
                    onClick={() => setForm({ ...form, gravite: g.valeur })}
                  >
                    <span className={`pastille-gravite ${g.valeur}`} />
                    <span><strong>{g.libelle}</strong><small>{g.exemple}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="champ">
              <label htmlFor="inc-desc">Description des faits</label>
              <textarea
                id="inc-desc" rows={3} maxLength={250} value={form.description} onChange={maj('description')} required
                placeholder="Ex. Absent sans justificatif aux trois cours de lundi, deuxième fois ce mois-ci."
              />
              <small className="compteur-caracteres">{form.description.length} / 250</small>
            </div>
            <label className={`case-a-cocher ${sansParent ? 'desactivee' : ''}`}>
              <input
                type="checkbox" checked={form.informerParent && !sansParent} disabled={sansParent}
                onChange={(e) => setForm({ ...form, informerParent: e.target.checked })}
              />
              {sansParent ? "Informer le parent : aucun parent n'est rattaché à cet élève" : 'Informer le parent par notification et e-mail'}
            </label>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <button className="primaire" type="submit" disabled={enCours}><IconFlag /> {enCours ? 'Enregistrement…' : 'Enregistrer le signalement'}</button>
          </form>

          {resultat && (
            <div className="resultat-signalement">
              <strong><IconCheck /> Signalement enregistré pour {resultat.eleve}</strong>
              <ul>
                <li>Ajouté à son dossier et au journal des incidents.</li>
                <li>
                  Score de risque de décrochage recalculé : <b>{resultat.risque.scoreRisque}/100</b>{' '}
                  <span className={`badge ${STYLE_NIVEAU[resultat.risque.niveauRisque]}`}>{LIBELLE_NIVEAU[resultat.risque.niveauRisque]}</span>
                </li>
                <li>
                  {resultat.parent.informe
                    ? (resultat.parent.envoye ? `Parent prévenu par e-mail (${resultat.parent.email}) et par notification.` : "Parent prévenu par notification ; l'e-mail n'a pas pu partir.")
                    : resultat.parent.rattache ? 'Parent non prévenu (case décochée).' : "Aucun parent rattaché : personne n'a été prévenu."}
                </li>
              </ul>
            </div>
          )}

          <div className="parcours-signalement">
            <h3>Où va ce signalement ?</h3>
            <ul>
              <li>
                <span className="parcours-icone"><IconClipboard /></span>
                <span><strong>Dossier de l'élève</strong>Consigné dans le journal ci-contre et visible par le parent dans son espace, rubrique Comportement.</span>
              </li>
              <li>
                <span className="parcours-icone"><IconTrendingDown /></span>
                <span><strong>Suivi du décrochage</strong>Le score de risque de l'élève est recalculé immédiatement (onglet Alertes décrochage).</span>
              </li>
              <li>
                <span className="parcours-icone"><IconMail /></span>
                <span><strong>Famille</strong>Le parent reçoit une notification et un e-mail, si la case est cochée.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="carte">
          <div className="entete-carte">
            <h2>Journal des incidents <span className="entete-carte-compteur">{incidents ? incidents.length : '…'}</span></h2>
            {majeurs > 0 && <span className="badge rouge">{majeurs} majeur{majeurs > 1 ? 's' : ''}</span>}
          </div>
          <div className="barre-outils">
            <label className="champ-recherche">
              <IconSearch />
              <input type="search" placeholder="Rechercher un élève, un motif…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un incident" />
            </label>
            <select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value)} aria-label="Filtrer par classe" className="filtre-select">
              <option value="">Toutes les classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="table-scroll">
            <table className="table-incidents">
              <thead><tr><th>Date</th><th>Élève</th><th>Classe</th><th>Gravité</th><th>Motif</th><th>Parent</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {affiches.map((i) => (
                  <tr key={i.id}>
                    <td>{dateCourte(i.date)}</td>
                    <td className="cellule-nom">{i.eleve?.nom} {i.eleve?.prenom}</td>
                    <td>{i.classe?.nom}</td>
                    <td><span className={`badge ${i.gravite === 'majeur' ? 'rouge' : 'or'}`}>{i.gravite === 'majeur' ? 'Majeur' : 'Mineur'}</span></td>
                    <td className="cellule-motif" title={i.description}>{i.description}</td>
                    <td>{i.parentInformeLe ? <span className="badge vert sans-point">Prévenu</span> : <span className="note-secondaire">Non</span>}</td>
                    <td className="cellule-actions">
                      <button type="button" className="bouton-icone-texte danger" onClick={() => setASupprimer(i)} aria-label="Retirer ce signalement" title="Retirer ce signalement">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
                {incidents && affiches.length === 0 && (
                  <tr><td colSpan={7} className="vide">{incidents.length === 0 ? 'Aucun incident signalé pour le moment.' : 'Aucun incident ne correspond.'}</td></tr>
                )}
                {!incidents && <tr><td colSpan={7} className="chargement">Chargement…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {aSupprimer && (
        <ConfirmModal titre="Retirer ce signalement ?" boutonConfirmer="Retirer" onAnnuler={() => setASupprimer(null)} onConfirmer={supprimer}>
          L'incident du {dateCourte(aSupprimer.date)} concernant {aSupprimer.eleve?.prenom} {aSupprimer.eleve?.nom} sera retiré de son
          dossier et son score de risque recalculé. Un parent déjà prévenu ne reçoit pas de nouveau message.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
