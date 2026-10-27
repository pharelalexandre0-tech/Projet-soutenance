import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { saisieNoteValide } from '../../utils/seuils';
import { IconMessage, IconChevronRight } from '../../components/icons';

const STATUTS = { en_attente: ['En attente', 'or'], acceptee: ['Acceptée', 'vert'], rejetee: ['Rejetée', 'rouge'] };
const note = (n) => (n == null ? '-' : String(n).replace('.', ','));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Réclamations de notes des étudiants : instruction, réponse motivée et
// correction de la note (même contrôles que toute saisie).
export default function Reclamations() {
  const [donnees, setDonnees] = useState(null);
  const [statut, setStatut] = useState('en_attente');
  const [ouverte, setOuverte] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/reclamations${statut ? `?statut=${statut}` : ''}`).then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || { reclamations: [], enAttente: 0 }));
  useEffect(() => { charger(); }, [statut]);
  useActualisation(charger, { domaines: ['reclamations', 'notes'] });

  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Réclamations de notes {donnees?.enAttente > 0 && <span className="badge or">{donnees.enAttente} à traiter</span>}</h2>
        <div className="onglets-secondaires compact" role="tablist">
          {[['en_attente', 'À traiter'], ['acceptee', 'Acceptées'], ['rejetee', 'Rejetées'], ['', 'Toutes']].map(([v, l]) => (
            <button key={v || 'toutes'} type="button" className={statut === v ? 'actif' : ''} onClick={() => setStatut(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Déposée le</th><th>Étudiant</th><th>Matricule</th><th>Matière</th><th>Note contestée</th><th>Valeur</th><th>Statut</th><th aria-label="Ouvrir" /></tr></thead>
          <tbody>
            {(donnees?.reclamations || []).map((r) => (
              <tr key={r.id} className="ligne-cliquable" onClick={() => setOuverte(r)}>
                <td>{dateFr(r.createdAt)}</td>
                <td className="cellule-nom">{r.eleve?.prenom} {r.eleve?.nom}{r.deposeeParParent ? ' (parent)' : ''}</td>
                <td className="mono">{r.eleve?.matricule}</td>
                <td>{r.matiere?.intitule}</td>
                <td>{r.categorie === 'cc' ? 'Contrôle continu' : 'Examen'}</td>
                <td className="cellule-nombre">{note(r.ancienneValeur)}{r.nouvelleValeur != null ? ` → ${note(r.nouvelleValeur)}` : ''}</td>
                <td><span className={`badge ${STATUTS[r.statut][1]}`}>{STATUTS[r.statut][0]}</span></td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {donnees && donnees.reclamations.length === 0 && <tr><td colSpan={8} className="vide">Aucune réclamation.</td></tr>}
            {!donnees && <tr><td colSpan={8} className="chargement">Chargement…</td></tr>}
          </tbody>
        </table>
      </div>
      {ouverte && (
        <TraitementReclamation
          reclamation={ouverte}
          onFermer={() => setOuverte(null)}
          onTraitee={(r) => { setOuverte(null); setToast({ message: `Réclamation ${r.statut === 'acceptee' ? 'acceptée' : 'rejetée'}, étudiant notifié`, type: 'succes' }); charger(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </section>
  );
}

function TraitementReclamation({ reclamation: r, onFermer, onTraitee }) {
  const [reponse, setReponse] = useState('');
  const [nouvelle, setNouvelle] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function decider(decision) {
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post(`/reclamations/${r.id}/traiter`, { decision, reponse, nouvelleValeur: decision === 'acceptee' ? nouvelle : undefined });
      onTraitee(res.data.reclamation);
    } catch (e) {
      setErreur(messageErreur(e, 'traitement impossible'));
      setEnCours(false);
    }
  }

  const enAttente = r.statut === 'en_attente';
  return (
    <Tiroir
      titre={`${r.eleve?.prenom} ${r.eleve?.nom}`}
      sousTitre={`${r.matiere?.intitule} · ${r.categorie === 'cc' ? 'contrôle continu' : 'examen'} · note ${note(r.ancienneValeur)}/20`}
      icone={<span className="tuile-fonctionnalite"><IconMessage /></span>}
      onFermer={onFermer}
      pied={enAttente && (
        <>
          <button type="button" className="secondaire danger" disabled={enCours || reponse.trim().length < 10} onClick={() => decider('rejetee')}>Rejeter</button>
          <button type="button" className="primaire" disabled={enCours || reponse.trim().length < 10 || (nouvelle !== '' && !saisieNoteValide(nouvelle))} onClick={() => decider('acceptee')}>Accepter{nouvelle ? ' et corriger' : ''}</button>
        </>
      )}
    >
      <section className="tiroir-section">
        <h3>Motif de l’étudiant</h3>
        <p className="texte-circulaire">{r.motif}</p>
        <p className="note-secondaire">Déposée le {dateFr(r.createdAt)}{r.deposeeParParent ? ' par le parent' : ''}</p>
      </section>
      {enAttente ? (
        <section className="tiroir-section">
          <div className="formulaire">
            <div className="champ"><label htmlFor="r-note">Note corrigée (si la réclamation est fondée)</label>
              <input id="r-note" value={nouvelle} inputMode="decimal" onChange={(e) => { if (e.target.value === '' || saisieNoteValide(e.target.value)) setNouvelle(e.target.value); }} placeholder={`Actuellement ${note(r.ancienneValeur)}`} />
            </div>
            <div className="champ"><label htmlFor="r-rep">Réponse à l’étudiant</label><textarea id="r-rep" rows={4} value={reponse} onChange={(e) => setReponse(e.target.value)} /></div>
            {erreur && <div className="message-erreur">{erreur}</div>}
          </div>
        </section>
      ) : (
        <section className="tiroir-section">
          <h3>Réponse</h3>
          <p>{r.reponse}</p>
          <p className="note-secondaire">{STATUTS[r.statut][0]} le {dateFr(r.traiteeLe)} par {r.traiteeParNom}{r.nouvelleValeur != null ? `, note portée à ${note(r.nouvelleValeur)}/20` : ''}</p>
        </section>
      )}
    </Tiroir>
  );
}
