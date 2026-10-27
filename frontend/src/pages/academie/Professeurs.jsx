import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconSearch, IconPlus, IconChevronRight, IconUsers, IconTrash } from '../../components/icons';

const STATUTS = { permanent: ['Permanent', 'bleu'], vacataire: ['Vacataire', 'or'] };
const TYPES_LIEN = { saisie_notes: 'Saisie des notes', saisie_absences: 'Appel', cahier_de_textes: 'Cahier de textes' };
const ETATS_LIEN = { actif: ['Actif', 'vert'], revoque: ['Révoqué', 'gris'], expire: ['Expiré', 'gris'] };
const VIDE = { nom: '', prenom: '', email: '', telephone: '', statut: '', grade: '', matiere: '' };

// Professeurs de l'établissement : leur fiche, leur statut et les
// enseignements qui leur sont confiés (matière, classe, volume horaire).
export default function Professeurs() {
  const [professeurs, setProfesseurs] = useState(null);
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const [creation, setCreation] = useState(false);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/professeurs').then((r) => setProfesseurs(r.data.professeurs)).catch(() => setProfesseurs((p) => p || []));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['professeurs', 'comptes-ephemeres'] });

  const filtre = q.trim().toLowerCase();
  const liste = (professeurs || []).filter((p) => (!statut || p.statut === statut)
    && (!filtre || `${p.nom} ${p.prenom} ${p.email} ${p.matiere || ''} ${p.affectations.map((a) => a.matiere).join(' ')}`.toLowerCase().includes(filtre)));
  const sansEnseignement = (professeurs || []).filter((p) => p.affectations.length === 0).length;
  const notifier = (message, type = 'succes') => setToast({ message, type });

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Professeurs</span></div><div className="valeur">{professeurs ? professeurs.length : '…'}</div></div>
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Permanents</span></div><div className="valeur">{(professeurs || []).filter((p) => p.statut === 'permanent').length}</div></div>
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Vacataires</span></div><div className="valeur">{(professeurs || []).filter((p) => p.statut === 'vacataire').length}</div></div>
        <div className={`stat-tile ${sansEnseignement ? 'tile-or' : ''}`}><div className="stat-tile-haut"><span className="libelle">Sans enseignement</span></div><div className="valeur">{sansEnseignement}</div></div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Professeurs <span className="entete-carte-compteur">{liste.length}</span></h2>
          <button type="button" className="primaire" onClick={() => setCreation(true)}><IconPlus /> Ajouter un professeur</button>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche"><IconSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail ou matière…" aria-label="Rechercher un professeur" /></label>
          <select className="filtre-select" value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="permanent">Permanents</option>
            <option value="vacataire">Vacataires</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Nom</th><th>Prénom</th><th>E-mail</th><th>Téléphone</th><th>Statut</th><th className="chiffre">Matières</th><th className="chiffre">Classes</th><th className="chiffre">Liens actifs</th><th aria-label="Ouvrir" /></tr></thead>
            <tbody>
              {liste.map((p) => (
                <tr key={p.id} className="ligne-cliquable" onClick={() => setOuvert(p.id)}>
                  <td className="cellule-nom">{p.nom}</td>
                  <td>{p.prenom}</td>
                  <td>{p.email}</td>
                  <td>{p.telephone || ''}</td>
                  <td>{p.statut ? <span className={`badge ${STATUTS[p.statut][1]}`}>{STATUTS[p.statut][0]}</span> : <span className="note-secondaire">Non précisé</span>}</td>
                  <td className="chiffre">{p.nbMatieres}</td>
                  <td className="chiffre">{p.nbClasses}</td>
                  <td className="chiffre">{p.liensActifs}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {professeurs && liste.length === 0 && (
                <tr><td colSpan={9} className="vide">{professeurs.length ? 'Aucun professeur ne correspond à la recherche.' : 'Aucun professeur enregistré. Ajoutez-en un pour lui confier des enseignements.'}</td></tr>
              )}
              {!professeurs && <tr><td colSpan={9} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {creation && (
        <FormulaireProfesseur
          titre="Ajouter un professeur"
          onFermer={() => setCreation(false)}
          onEnregistrer={async (form) => {
            const r = await client.post('/professeurs', { ...form, statut: form.statut || null });
            setCreation(false);
            charger();
            setOuvert(r.data.professeur.id);
            notifier('Professeur ajouté');
          }}
        />
      )}
      {ouvert && <FicheProfesseur id={ouvert} onFermer={() => setOuvert(null)} onMaj={charger} notifier={notifier} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireProfesseur({ titre, initial = VIDE, onFermer, onEnregistrer }) {
  const [form, setForm] = useState({ ...VIDE, ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ''])) });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm({ ...form, [cle]: e.target.value }) });

  async function valider(e) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await onEnregistrer(form);
    } catch (err) {
      setErreur(messageErreur(err, 'enregistrement impossible'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={titre} onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={valider}>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="pf-nom">Nom</label><input id="pf-nom" required {...champ('nom')} /></div>
          <div className="champ"><label htmlFor="pf-prenom">Prénom</label><input id="pf-prenom" required {...champ('prenom')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="pf-email">E-mail</label><input id="pf-email" type="email" required {...champ('email')} /></div>
          <div className="champ"><label htmlFor="pf-tel">Téléphone</label><input id="pf-tel" type="tel" placeholder="+241 …" {...champ('telephone')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="pf-statut">Statut</label>
            <select id="pf-statut" {...champ('statut')}>
              <option value="">Non précisé</option>
              <option value="permanent">Permanent</option>
              <option value="vacataire">Vacataire</option>
            </select>
          </div>
          <div className="champ"><label htmlFor="pf-grade">Grade ou titre</label><input id="pf-grade" placeholder="Ex. Maître-assistant, Docteur" {...champ('grade')} /></div>
        </div>
        <div className="champ"><label htmlFor="pf-spec">Spécialité</label><input id="pf-spec" placeholder="Ex. Informatique, Mathématiques" {...champ('matiere')} /></div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FicheProfesseur({ id, onFermer, onMaj, notifier }) {
  const [vue, setVue] = useState(null);
  const [options, setOptions] = useState(null);
  const [erreur, setErreur] = useState('');
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [ajout, setAjout] = useState({ matiereId: '', classeId: '', volumeHoraire: '' });

  const charger = () => client.get(`/professeurs/${id}`).then((r) => setVue(r.data)).catch((e) => setErreur(messageErreur(e, 'fiche indisponible')));
  useEffect(() => {
    charger();
    client.get('/professeurs/options').then((r) => setOptions(r.data)).catch(() => setOptions({ matieres: [], classes: [] }));
  }, [id]);

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    try {
      setVue((await client.post(`/professeurs/${id}/affectations`, ajout)).data);
      setAjout({ matiereId: '', classeId: '', volumeHoraire: '' });
      onMaj();
      notifier('Enseignement confié');
    } catch (err) {
      setErreur(messageErreur(err, 'ajout impossible'));
    }
  }

  async function retirer(a) {
    setErreur('');
    try {
      setVue((await client.delete(`/professeurs/${id}/affectations/${a.id}`)).data);
      onMaj();
    } catch (err) {
      setErreur(messageErreur(err, 'retrait impossible'));
    }
  }

  const p = vue?.professeur;
  return (
    <Tiroir
      titre={p ? `${p.prenom} ${p.nom}` : 'Professeur'}
      sousTitre={p ? [p.statut && STATUTS[p.statut][0], p.grade, p.matiere].filter(Boolean).join(' · ') : ''}
      icone={<span className="tuile-fonctionnalite"><IconUsers /></span>}
      onFermer={onFermer}
      pied={p && (
        <>
          <button type="button" className="secondaire danger" onClick={() => setSuppression(true)}><IconTrash /> Retirer de l’établissement</button>
          <button type="button" className="primaire" onClick={() => setEdition(true)}>Modifier la fiche</button>
        </>
      )}
    >
      {erreur && <div className="message-erreur">{erreur}</div>}
      {!vue && !erreur && <div className="chargement">Chargement…</div>}
      {p && (
        <>
          <section className="tiroir-section">
            <h3>Coordonnées</h3>
            <dl className="fiche-coordonnees">
              <div><dt>E-mail</dt><dd>{p.email}</dd></div>
              <div><dt>Téléphone</dt><dd>{p.telephone || 'Non renseigné'}</dd></div>
              <div><dt>Statut</dt><dd>{p.statut ? STATUTS[p.statut][0] : 'Non précisé'}</dd></div>
              <div><dt>Grade</dt><dd>{p.grade || 'Non renseigné'}</dd></div>
            </dl>
          </section>

          <section className="tiroir-section">
            <h3>Enseignements confiés <span className="entete-carte-compteur">{vue.affectations.length}</span></h3>
            {vue.affectations.length === 0 && <p className="note-secondaire">Aucun enseignement pour l’instant.</p>}
            <ul className="liste-enseignements">
              {vue.affectations.map((a) => (
                <li key={a.id}>
                  <span className="enseignement-texte">
                    <strong>{a.matiere}{a.code ? ` (${a.code})` : ''}</strong>
                    <small>{[a.classe, a.ue, a.semestre, a.volumeHoraire ? `${a.volumeHoraire} h` : null].filter(Boolean).join(' · ')}</small>
                  </span>
                  <button type="button" className="bouton-icone" aria-label={`Retirer ${a.matiere}`} title="Retirer" onClick={() => retirer(a)}><IconTrash /></button>
                </li>
              ))}
            </ul>
            <form className="ajout-enseignement" onSubmit={ajouter}>
              <div className="champ">
                <label htmlFor="af-matiere">Matière</label>
                <select id="af-matiere" required value={ajout.matiereId} onChange={(e) => setAjout({ ...ajout, matiereId: e.target.value })}>
                  <option value="">Choisir une matière</option>
                  {(options?.matieres || []).map((m) => <option key={m.id} value={m.id}>{m.intitule} · {m.semestre}</option>)}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="af-classe">Classe</label>
                <select id="af-classe" value={ajout.classeId} onChange={(e) => setAjout({ ...ajout, classeId: e.target.value })}>
                  <option value="">Toutes les classes</option>
                  {(options?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="af-volume">Heures</label>
                <input id="af-volume" type="number" min="1" max="600" inputMode="numeric" value={ajout.volumeHoraire} onChange={(e) => setAjout({ ...ajout, volumeHoraire: e.target.value })} />
              </div>
              <button type="submit" className="secondaire" disabled={!ajout.matiereId}><IconPlus /> Confier</button>
            </form>
            {options && options.matieres.length === 0 && <p className="note-secondaire">Créez d’abord des matières dans « Unités d’enseignement ».</p>}
          </section>

          <section className="tiroir-section">
            <h3>Liens d’accès récents</h3>
            {vue.liens.length === 0 && <p className="note-secondaire">Aucun lien envoyé à ce professeur. Les liens se créent dans « Comptes éphémères ».</p>}
            <ul className="liste-enseignements">
              {vue.liens.map((l) => (
                <li key={l.id}>
                  <span className="enseignement-texte">
                    <strong>{TYPES_LIEN[l.type] || l.type}{l.matiere ? ` · ${l.matiere}` : ''}</strong>
                    <small>Envoyé le {new Date(l.creeLe).toLocaleDateString('fr-FR')}{l.envoyeLe ? ` · saisie rendue le ${new Date(l.envoyeLe).toLocaleDateString('fr-FR')}` : ''}</small>
                  </span>
                  <span className={`badge ${(ETATS_LIEN[l.statut] || ETATS_LIEN.expire)[1]}`}>{(ETATS_LIEN[l.statut] || ETATS_LIEN.expire)[0]}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {edition && p && (
        <FormulaireProfesseur
          titre="Modifier la fiche"
          initial={p}
          onFermer={() => setEdition(false)}
          onEnregistrer={async (form) => {
            await client.put(`/professeurs/${id}`, { ...form, statut: form.statut || null });
            setEdition(false);
            await charger();
            onMaj();
            notifier('Fiche enregistrée');
          }}
        />
      )}
      {suppression && p && (
        <ConfirmModal
          titre="Retirer ce professeur"
          boutonConfirmer="Retirer"
          boutonEnCours="Retrait…"
          onConfirmer={async () => { await client.delete(`/professeurs/${id}`); setSuppression(false); onMaj(); onFermer(); notifier('Professeur retiré'); }}
          onAnnuler={() => setSuppression(false)}
        >
          {p.prenom} {p.nom} et ses enseignements seront retirés de l’établissement. Les notes déjà saisies sont conservées.
        </ConfirmModal>
      )}
    </Tiroir>
  );
}
