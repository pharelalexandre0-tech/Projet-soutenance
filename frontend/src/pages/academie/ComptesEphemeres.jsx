import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import DetailCompteRendu from '../../components/DetailCompteRendu';
import { messageErreur } from '../../utils/erreurs';
import {
  IconPlus, IconPencil, IconCalendarAlert, IconKey, IconUsers, IconCheck, IconCircleCheck, IconClock,
  IconMail, IconClose, IconSend, IconDocument, IconTrash, IconEye, IconSearch, IconChevronRight, IconCopy,
} from '../../components/icons';

const DUREES = [
  { minutes: 30, libelle: '30 min' },
  { minutes: 60, libelle: '1 h' },
  { minutes: 120, libelle: '2 h' },
  { minutes: 240, libelle: '4 h' },
  { minutes: 1440, libelle: '1 jour' },
  { minutes: 4320, libelle: '3 jours' },
];

const FILTRES = [
  { id: 'ouverts', libelle: 'Ouverts' },
  { id: 'termines', libelle: 'Terminés' },
  { id: '', libelle: 'Tous' },
];

function initiales(p) {
  return `${p?.prenom?.[0] ?? ''}${p?.nom?.[0] ?? ''}`.toUpperCase();
}

function tempsRestant(date) {
  const minutes = Math.round((new Date(date) - Date.now()) / 60000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `encore ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `encore ${heures} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `encore ${Math.round(heures / 24)} jours`;
}

function dateCourte(date) {
  return new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statutAcces(a) {
  if (a.statut === 'actif') return { badge: 'vert', texte: 'Ouvert', ouvert: true };
  if (a.statut === 'expire') return { badge: 'or', texte: 'Expiré' };
  if (a.saisieEnvoyeeLe || a.saisies > 0) return { badge: 'bleu', texte: 'Saisie reçue' };
  return { badge: 'gris', texte: 'Fermé' };
}

function detailSaisie(a) {
  if (a.tache === 'saisie_absences') {
    if (a.saisies > 0) return `${a.saisies} absence${a.saisies > 1 ? 's' : ''} ou retard${a.saisies > 1 ? 's' : ''}`;
    return a.saisieEnvoyeeLe ? 'Tous présents' : null;
  }
  return a.saisies > 0 ? `${a.saisies} note${a.saisies > 1 ? 's' : ''}` : null;
}

function nomProfesseur(a) {
  return a.professeur ? `${a.professeur.prenom} ${a.professeur.nom}` : 'Professeur retiré';
}

function libelleEvaluation(a) {
  if (a.tache === 'saisie_absences') return null;
  return `${a.categorie === 'examen' ? 'Examen' : 'Contrôle continu'}${a.evaluation ? `, ${a.evaluation}` : ''}`;
}

// Une seule information pour la colonne « Validité » : le temps restant
// d'un accès ouvert, sinon la date qui l'a clos.
function validite(a, statut) {
  if (statut.ouvert) return tempsRestant(a.dateExpiration) || 'Expire maintenant';
  if (a.saisieEnvoyeeLe) return `Reçue le ${dateCourte(a.saisieEnvoyeeLe)}`;
  if (a.statut === 'expire') return `Expiré le ${dateCourte(a.dateExpiration)}`;
  return `Créé le ${dateCourte(a.dateCreation)}`;
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// Diagramme 4 : l'Académie ouvre au professeur un accès temporaire (portée
// précise + durée) ; il reçoit un lien par e-mail, sans compte permanent.
// La page suit aussi tous les accès délivrés : ouverts, terminés, expirés.
export default function ComptesEphemeres() {
  const [acces, setAcces] = useState(null);
  const [professeurs, setProfesseurs] = useState([]);
  const [filtre, setFiltre] = useState('ouverts');
  const [creation, setCreation] = useState(null); // null | { professeurId? }
  const [ajoutProfesseur, setAjoutProfesseur] = useState(false);
  const [aFermer, setAFermer] = useState(null);
  const [professeurASupprimer, setProfesseurASupprimer] = useState(null);
  const [renvoiEnCours, setRenvoiEnCours] = useState(null);
  const [compteRendu, setCompteRendu] = useState(null);
  const [accesOuvertId, setAccesOuvertId] = useState(null);
  const [professeurOuvertId, setProfesseurOuvertId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [rechercheProfesseur, setRechercheProfesseur] = useState('');
  const [toast, setToast] = useState(null);
  const [, setTic] = useState(0);

  function charger() {
    client.get('/comptes-ephemeres').then((res) => setAcces(res.data.comptes)).catch((err) => {
      setAcces([]);
      setToast({ message: messageErreur(err, 'impossible de charger les accès'), type: 'erreur' });
    });
    client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs));
  }
  useEffect(charger, []);
  useActualisation(charger);

  // Le temps restant de chaque accès se met à jour tout seul.
  useEffect(() => {
    const minuteur = setInterval(() => setTic((t) => t + 1), 30 * 1000);
    return () => clearInterval(minuteur);
  }, []);

  const liste = acces || [];
  const ouverts = liste.filter((a) => a.statut === 'actif' && new Date(a.dateExpiration) > new Date());
  const saisiesRecues = liste.filter((a) => a.saisieEnvoyeeLe || a.saisies > 0).length;
  const rechercheNette = recherche.trim().toLowerCase();
  const affiches = liste.filter((a) => {
    const ouvert = a.statut === 'actif' && new Date(a.dateExpiration) > new Date();
    if (filtre === 'ouverts' && !ouvert) return false;
    if (filtre === 'termines' && ouvert) return false;
    return !rechercheNette || `${nomProfesseur(a)} ${a.classe?.nom || ''} ${a.matiere?.intitule || ''}`.toLowerCase().includes(rechercheNette);
  });
  const rechercheProfNette = rechercheProfesseur.trim().toLowerCase();
  const professeursAffiches = professeurs
    .filter((p) => !rechercheProfNette || `${p.prenom} ${p.nom} ${p.matiere || ''} ${p.email || ''}`.toLowerCase().includes(rechercheProfNette))
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
  const accesOuvert = liste.find((a) => a.id === accesOuvertId) || null;
  const professeurOuvert = professeurs.find((p) => p.id === professeurOuvertId) || null;
  const accesParProfesseur = useMemo(() => {
    const compte = new Map();
    liste.forEach((a) => { if (a.professeur) compte.set(a.professeur.id, (compte.get(a.professeur.id) || 0) + 1); });
    return compte;
  }, [liste]);

  async function copierLien(a) {
    const ok = await copier(a.lien);
    setToast(ok ? { message: 'Lien copié.', type: 'succes' } : { message: 'Copie impossible : sélectionne le lien à la main.', type: 'erreur' });
  }

  async function renvoyer(a) {
    setRenvoiEnCours(a.id);
    try {
      const res = await client.post(`/comptes-ephemeres/gestion/${a.id}/renvoyer`);
      setToast(res.data.email.envoye
        ? { message: `Lien renvoyé à ${res.data.email.destinataire}.`, type: 'succes' }
        : { message: "L'e-mail n'a pas pu partir : copie le lien et transmets-le toi-même.", type: 'erreur' });
    } catch (err) {
      setToast({ message: messageErreur(err, "impossible de renvoyer l'e-mail"), type: 'erreur' });
      charger();
    } finally {
      setRenvoiEnCours(null);
    }
  }

  async function voirSaisie(a) {
    try {
      const res = await client.get(`/comptes-ephemeres/gestion/${a.id}/compte-rendu`);
      setCompteRendu(res.data.compteRendu);
    } catch (err) {
      setToast({ message: messageErreur(err, 'impossible d’ouvrir cette saisie'), type: 'erreur' });
    }
  }

  async function fermer() {
    await client.patch(`/comptes-ephemeres/gestion/${aFermer.id}/revoquer`);
    setAFermer(null);
    setToast({ message: "Accès fermé : le lien ne fonctionne plus.", type: 'succes' });
    charger();
  }

  async function supprimerProfesseur() {
    await client.delete(`/professeurs/${professeurASupprimer.id}`);
    setProfesseurASupprimer(null);
    setProfesseurOuvertId(null);
    setToast({ message: 'Professeur retiré.', type: 'succes' });
    charger();
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Accès ouverts</span><span className="puce-icone petite"><IconKey /></span></div>
          <div className="valeur">{acces ? ouverts.length : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Saisies reçues</span><span className="puce-icone petite"><IconCircleCheck /></span></div>
          <div className="valeur">{acces ? saisiesRecues : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Accès délivrés</span><span className="puce-icone petite"><IconSend /></span></div>
          <div className="valeur">{acces ? liste.length : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Professeurs</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{professeurs.length}</div>
        </div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Accès temporaires <span className="entete-carte-compteur">{affiches.length}</span></h2>
          <div className="actions-carte">
            <button className="primaire" onClick={() => setCreation({})} disabled={professeurs.length === 0}>
              <IconPlus /> Nouvel accès
            </button>
          </div>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un professeur, une classe, une matière…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un accès" />
          </label>
          <div className="filtres-puces" role="group" aria-label="Filtrer les accès">
            {FILTRES.map((f) => (
              <button key={f.id} className={filtre === f.id ? 'actif' : ''} onClick={() => setFiltre(f.id)}>{f.libelle}</button>
            ))}
          </div>
        </div>
        {professeurs.length === 0 && acces && (
          <div className="vide">Ajoute d'abord un professeur (tableau « Professeurs » ci-dessous) pour pouvoir lui ouvrir un accès.</div>
        )}
        {professeurs.length > 0 && (
          <div className="table-scroll">
            <table className="table-acces">
              <thead>
                <tr>
                  <th>Professeur</th>
                  <th>Mission</th>
                  <th>Classe</th>
                  <th>Matière</th>
                  <th>Évaluation</th>
                  <th>Validité</th>
                  <th>Statut</th>
                  <th>Saisie reçue</th>
                  <th aria-label="Ouvrir le détail" />
                </tr>
              </thead>
              <tbody>
                {affiches.map((a) => {
                  const statut = statutAcces(a);
                  return (
                    <tr key={a.id} className="ligne-cliquable" onClick={() => setAccesOuvertId(a.id)}>
                      <td className="cellule-nom">{nomProfesseur(a)}</td>
                      <td>
                        <span className={`badge sans-point ${a.tache === 'saisie_absences' ? 'or' : 'bleu'}`}>
                          {a.tache === 'saisie_absences' ? 'Appel' : 'Notes'}
                        </span>
                      </td>
                      <td>{a.classe?.nom || <span className="note-secondaire">Classe retirée</span>}</td>
                      <td>{a.matiere?.intitule || <span className="note-secondaire">Non précisée</span>}</td>
                      <td>{libelleEvaluation(a) || <span className="note-secondaire">Sans objet</span>}</td>
                      <td>{statut.ouvert ? <span className="temps-restant"><IconClock />{validite(a, statut)}</span> : validite(a, statut)}</td>
                      <td><span className={`badge ${statut.badge}`}>{statut.texte}</span></td>
                      <td>{detailSaisie(a) || <span className="note-secondaire">Aucune</span>}</td>
                      <td className="cellule-chevron"><IconChevronRight /></td>
                    </tr>
                  );
                })}
                {acces && affiches.length === 0 && (
                  <tr><td colSpan={9} className="vide">{filtre === 'ouverts' && !rechercheNette ? 'Aucun accès ouvert en ce moment.' : 'Aucun accès dans cette liste.'}</td></tr>
                )}
                {!acces && <tr><td colSpan={9} className="chargement">Chargement…</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="carte">
        <div className="entete-carte">
          <h2>Professeurs <span className="entete-carte-compteur">{professeurs.length}</span></h2>
          <div className="actions-carte">
            <label className="champ-recherche compact">
              <IconSearch />
              <input type="search" placeholder="Rechercher…" value={rechercheProfesseur} onChange={(e) => setRechercheProfesseur(e.target.value)} aria-label="Rechercher un professeur" />
            </label>
            <button className="secondaire" onClick={() => setAjoutProfesseur(true)}><IconPlus /> Ajouter</button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nom et prénom</th>
                <th>Matière</th>
                <th>E-mail</th>
                <th className="chiffre">Accès délivrés</th>
                <th aria-label="Ouvrir la fiche" />
              </tr>
            </thead>
            <tbody>
              {professeursAffiches.map((p) => (
                <tr key={p.id} className="ligne-cliquable" onClick={() => setProfesseurOuvertId(p.id)}>
                  <td className="cellule-nom">{p.nom} {p.prenom}</td>
                  <td>{p.matiere || <span className="note-secondaire">Non renseignée</span>}</td>
                  <td className="cellule-email">{p.email}</td>
                  <td className="chiffre">{accesParProfesseur.get(p.id) || 0}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {professeursAffiches.length === 0 && (
                <tr><td colSpan={5} className="vide">{professeurs.length === 0 ? 'Aucun professeur enregistré.' : 'Aucun professeur ne correspond.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {accesOuvert && (() => {
        const statut = statutAcces(accesOuvert);
        const aSaisie = accesOuvert.saisieEnvoyeeLe || accesOuvert.saisies > 0;
        return (
          <Tiroir
            titre={nomProfesseur(accesOuvert)}
            sousTitre={`${accesOuvert.tache === 'saisie_absences' ? 'Appel' : 'Saisie des notes'}, ${accesOuvert.classe?.nom || 'classe retirée'}`}
            icone={<span className="avatar-initiales">{initiales(accesOuvert.professeur)}</span>}
            onFermer={() => setAccesOuvertId(null)}
            pied={(
              <>
                {aSaisie && <button className="secondaire" onClick={() => { setAccesOuvertId(null); voirSaisie(accesOuvert); }}><IconEye /> Voir la saisie</button>}
                {statut.ouvert && (
                  <>
                    <button className="secondaire" onClick={() => renvoyer(accesOuvert)} disabled={renvoiEnCours === accesOuvert.id}>
                      <IconMail /> {renvoiEnCours === accesOuvert.id ? 'Envoi…' : "Renvoyer l'e-mail"}
                    </button>
                    <button className="secondaire danger" onClick={() => setAFermer(accesOuvert)}><IconClose /> Fermer l'accès</button>
                  </>
                )}
              </>
            )}
          >
            <section className="tiroir-section">
              <h3 className="tiroir-section-titre">Mission</h3>
              <dl className="fiche-compte">
                <div><dt>Tâche</dt><dd>{accesOuvert.tache === 'saisie_absences' ? "Faire l'appel" : 'Saisir les notes'}</dd></div>
                <div><dt>Classe</dt><dd>{accesOuvert.classe?.nom || 'Classe retirée'}</dd></div>
                {accesOuvert.matiere && <div><dt>Matière</dt><dd>{accesOuvert.matiere.intitule}</dd></div>}
                {libelleEvaluation(accesOuvert) && <div><dt>Évaluation</dt><dd>{libelleEvaluation(accesOuvert)}</dd></div>}
                <div><dt>Professeur</dt><dd>{nomProfesseur(accesOuvert)}</dd></div>
                {accesOuvert.professeur?.email && <div><dt>E-mail</dt><dd>{accesOuvert.professeur.email}</dd></div>}
              </dl>
            </section>
            <section className="tiroir-section">
              <h3 className="tiroir-section-titre">Suivi</h3>
              <dl className="fiche-compte">
                <div><dt>Statut</dt><dd><span className={`badge ${statut.badge}`}>{statut.texte}</span></dd></div>
                <div><dt>Créé le</dt><dd>{dateCourte(accesOuvert.dateCreation)}</dd></div>
                <div><dt>{statut.ouvert ? 'Expire le' : 'Validité prévue'}</dt><dd>{dateCourte(accesOuvert.dateExpiration)}</dd></div>
                {statut.ouvert && <div><dt>Temps restant</dt><dd>{tempsRestant(accesOuvert.dateExpiration) || 'Expire maintenant'}</dd></div>}
                {accesOuvert.saisieEnvoyeeLe && <div><dt>Saisie reçue le</dt><dd>{dateCourte(accesOuvert.saisieEnvoyeeLe)}</dd></div>}
                <div><dt>Contenu reçu</dt><dd>{detailSaisie(accesOuvert) || 'Aucune saisie pour le moment'}</dd></div>
              </dl>
            </section>
            {statut.ouvert && accesOuvert.lien && (
              <section className="tiroir-section">
                <h3 className="tiroir-section-titre">Lien personnel du professeur</h3>
                <p className="lien-acces mono">{accesOuvert.lien}</p>
                <button className="secondaire" onClick={() => copierLien(accesOuvert)}><IconCopy /> Copier le lien</button>
              </section>
            )}
          </Tiroir>
        );
      })()}

      {professeurOuvert && (
        <Tiroir
          titre={`${professeurOuvert.prenom} ${professeurOuvert.nom}`}
          sousTitre={professeurOuvert.matiere || 'Matière non renseignée'}
          icone={<span className="avatar-initiales">{initiales(professeurOuvert)}</span>}
          onFermer={() => setProfesseurOuvertId(null)}
          pied={(
            <>
              <button className="secondaire danger" onClick={() => setProfesseurASupprimer(professeurOuvert)}><IconTrash /> Retirer</button>
              <button className="primaire" onClick={() => { setProfesseurOuvertId(null); setCreation({ professeurId: String(professeurOuvert.id) }); }}>
                <IconKey /> Ouvrir un accès
              </button>
            </>
          )}
        >
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Fiche</h3>
            <dl className="fiche-compte">
              <div><dt>Matière</dt><dd>{professeurOuvert.matiere || 'Non renseignée'}</dd></div>
              <div><dt>E-mail</dt><dd>{professeurOuvert.email}</dd></div>
              <div><dt>Accès délivrés</dt><dd>{accesParProfesseur.get(professeurOuvert.id) || 0}</dd></div>
            </dl>
            <p className="note-secondaire" style={{ margin: '14px 0 0' }}>
              Le professeur n'a pas de compte : chaque accès lui envoie un lien personnel, valable pour une seule mission.
              Il figure aussi dans la paie du personnel (espace Finance).
            </p>
          </section>
        </Tiroir>
      )}

      {creation && (
        <NouvelAcces
          professeurs={professeurs}
          professeurInitial={creation.professeurId}
          onFermer={() => setCreation(null)}
          onCree={charger}
          onCopie={(ok) => setToast(ok ? { message: 'Lien copié.', type: 'succes' } : { message: 'Copie impossible : sélectionne le lien à la main.', type: 'erreur' })}
        />
      )}
      {ajoutProfesseur && (
        <AjoutProfesseur
          onFermer={() => setAjoutProfesseur(false)}
          onAjoute={(p) => { setAjoutProfesseur(false); setToast({ message: `${p.prenom} ${p.nom} ajouté(e) aux professeurs.`, type: 'succes' }); charger(); }}
        />
      )}
      {aFermer && (
        <ConfirmModal
          titre="Fermer cet accès ?"
          boutonConfirmer="Fermer l'accès"
          boutonEnCours="Fermeture…"
          onConfirmer={fermer}
          onAnnuler={() => setAFermer(null)}
        >
          Le lien envoyé à {aFermer.professeur ? `${aFermer.professeur.prenom} ${aFermer.professeur.nom}` : 'ce professeur'} cessera
          immédiatement de fonctionner. Les saisies déjà envoyées sont conservées.
        </ConfirmModal>
      )}
      {professeurASupprimer && (
        <ConfirmModal
          titre="Retirer ce professeur ?"
          boutonConfirmer="Retirer"
          onConfirmer={supprimerProfesseur}
          onAnnuler={() => setProfesseurASupprimer(null)}
        >
          {professeurASupprimer.prenom} {professeurASupprimer.nom} sera retiré(e) de la liste des professeurs. Ses accès
          déjà délivrés ne fonctionneront plus.
        </ConfirmModal>
      )}
      {compteRendu && <DetailCompteRendu compteRendu={compteRendu} onFermer={() => setCompteRendu(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function NouvelAcces({ professeurs, professeurInitial, onFermer, onCree, onCopie }) {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ues, setUes] = useState([]);
  const [form, setForm] = useState({
    tache: 'saisie_notes', professeurId: professeurInitial || '', classeId: '', semestreId: '', ueId: '', matiereId: '',
    categorie: 'cc', evaluationLibelle: '', dureeMinutes: 60,
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    client.get('/classes').then((res) => {
      setClasses(res.data.classes);
      if (res.data.classes.length === 1) setForm((f) => ({ ...f, classeId: String(res.data.classes[0].id) }));
    });
    client.get('/semestres').then((res) => {
      setSemestres(res.data.semestres);
      if (res.data.semestres.length === 1) setForm((f) => ({ ...f, semestreId: String(res.data.semestres[0].id) }));
    });
  }, []);

  // Les UE dépendent du semestre ; en changer vide l'UE et la matière déjà
  // choisies, qui appartenaient à l'ancien semestre.
  useEffect(() => {
    if (form.semestreId) client.get(`/unites-enseignement?semestreId=${form.semestreId}`).then((res) => setUes(res.data.ues));
    else setUes([]);
    setForm((f) => ({ ...f, ueId: '', matiereId: '' }));
  }, [form.semestreId]);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const notes = form.tache === 'saisie_notes';
  const matieres = ues.find((u) => String(u.id) === form.ueId)?.Matieres || [];
  const professeur = professeurs.find((p) => String(p.id) === form.professeurId);

  async function generer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/comptes-ephemeres', {
        tache: form.tache,
        professeurId: Number(form.professeurId),
        classeId: Number(form.classeId),
        ...(notes ? { matiereId: Number(form.matiereId), categorie: form.categorie, evaluationLibelle: form.evaluationLibelle } : {}),
        dureeMinutes: Number(form.dureeMinutes),
      });
      setResultat(res.data);
      onCree();
    } catch (err) {
      setErreur(messageErreur(err, "impossible de créer l'accès"));
    } finally {
      setEnCours(false);
    }
  }

  if (resultat) {
    return (
      <Modal titre="Accès créé" onFermer={onFermer} largeur={560}>
        <div className="resultat-acces-temporaire">
          <span className={`resultat-icone ${resultat.email?.envoye ? 'ok' : 'attention'}`}>
            {resultat.email?.envoye ? <IconCheck /> : <IconMail />}
          </span>
          <h3>{resultat.email?.envoye ? `Lien envoyé à ${professeur?.prenom} ${professeur?.nom}` : "L'accès est prêt, mais l'e-mail n'est pas parti"}</h3>
          <p>
            {resultat.email?.envoye
              ? `Un e-mail est parti vers ${resultat.email.destinataire}. Le lien ci-dessous est une copie, au cas où.`
              : "Le service d'envoi d'e-mail a refusé le message. Copie le lien ci-dessous et transmets-le au professeur (WhatsApp, SMS…)."}
          </p>
        </div>
        <div className="champ" style={{ marginBottom: 12 }}>
          <label>Lien d'accès</label>
          <div className="lien-copiable">
            <input readOnly value={resultat.lien} onFocus={(e) => e.target.select()} />
            <button type="button" className="secondaire" onClick={async () => onCopie(await copier(resultat.lien))}><IconDocument /> Copier</button>
          </div>
        </div>
        <p className="note-secondaire" style={{ margin: '0 0 20px', fontSize: 14 }}>
          Valable jusqu'au {new Date(resultat.compte.dateExpiration).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}, et
          fermé automatiquement dès que le professeur envoie sa saisie.
        </p>
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={() => { setResultat(null); setForm((f) => ({ ...f, professeurId: '', evaluationLibelle: '' })); }}>
            Créer un autre accès
          </button>
          <button type="button" className="primaire" onClick={onFermer}>Terminé</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titre="Nouvel accès temporaire" onFermer={onFermer} largeur={680}>
      <form className="formulaire" onSubmit={generer}>
        <div className="champ">
          <label>Mission du professeur</label>
          <div className="choix-type">
            <button type="button" className={`option-type ${notes ? 'choisie' : ''}`} onClick={() => setForm({ ...form, tache: 'saisie_notes' })} aria-pressed={notes}>
              <span className="tuile-fonctionnalite"><IconPencil /></span>
              <span><strong>Saisir des notes</strong><small>Moyennes de contrôle continu ou d'examen, pour une matière.</small></span>
            </button>
            <button type="button" className={`option-type ${!notes ? 'choisie' : ''}`} onClick={() => setForm({ ...form, tache: 'saisie_absences' })} aria-pressed={!notes}>
              <span className="tuile-fonctionnalite"><IconCalendarAlert /></span>
              <span><strong>Faire l'appel</strong><small>Présences, absences et retards de la classe.</small></span>
            </button>
          </div>
        </div>

        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="a-prof">Professeur</label>
            <select id="a-prof" value={form.professeurId} onChange={maj('professeurId')} required>
              <option value="">Choisir un professeur</option>
              {professeurs.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.matiere ? ` (${p.matiere})` : ''}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="a-classe">Classe</label>
            <select id="a-classe" value={form.classeId} onChange={maj('classeId')} required>
              <option value="">Choisir une classe</option>
              {classes.map((c) => {
                const effectif = c.Eleves?.length ?? 0;
                return (
                  <option key={c.id} value={c.id} disabled={effectif === 0}>
                    {c.nom} ({c.niveau}) · {effectif ? `${effectif} élève${effectif > 1 ? 's' : ''}` : 'aucun élève'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {notes && (
          <>
            <div className="ligne-champs">
              {semestres.length > 1 && (
                <div className="champ">
                  <label htmlFor="a-sem">Semestre</label>
                  <select id="a-sem" value={form.semestreId} onChange={maj('semestreId')} required>
                    <option value="">Choisir un semestre</option>
                    {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                  </select>
                </div>
              )}
              <div className="champ">
                <label htmlFor="a-ue">Unité d'enseignement</label>
                <select id="a-ue" value={form.ueId} onChange={(e) => setForm({ ...form, ueId: e.target.value, matiereId: '' })} required disabled={!form.semestreId}>
                  <option value="">Choisir une UE</option>
                  {ues.map((u) => <option key={u.id} value={u.id}>{u.code} : {u.intitule}</option>)}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="a-matiere">Matière</label>
                <select id="a-matiere" value={form.matiereId} onChange={maj('matiereId')} required disabled={!form.ueId}>
                  <option value="">Choisir une matière</option>
                  {matieres.map((m) => <option key={m.id} value={m.id}>{m.code} : {m.intitule}</option>)}
                </select>
              </div>
            </div>
            <div className="ligne-champs">
              <div className="champ" style={{ maxWidth: 260 }}>
                <label htmlFor="a-cat">Type de note</label>
                <select id="a-cat" value={form.categorie} onChange={maj('categorie')}>
                  <option value="cc">Contrôle continu (CC)</option>
                  <option value="examen">Examen</option>
                </select>
              </div>
              <div className="champ">
                <label htmlFor="a-eval">Intitulé de l'évaluation (facultatif)</label>
                <input id="a-eval" value={form.evaluationLibelle} onChange={maj('evaluationLibelle')} placeholder="Ex. Devoir surveillé 1" />
              </div>
            </div>
          </>
        )}

        <div className="champ">
          <label>Durée de validité du lien</label>
          <div className="cases-choix">
            {DUREES.map((d) => (
              <button
                key={d.minutes}
                type="button"
                className={`case-choix sans-coche ${Number(form.dureeMinutes) === d.minutes ? 'choisie' : ''}`}
                onClick={() => setForm({ ...form, dureeMinutes: d.minutes })}
                aria-pressed={Number(form.dureeMinutes) === d.minutes}
              >
                {d.libelle}
              </button>
            ))}
          </div>
        </div>

        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}><IconSend /> {enCours ? 'Envoi…' : 'Créer et envoyer le lien'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AjoutProfesseur({ onFermer, onAjoute }) {
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', matiere: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  async function ajouter(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/professeurs', form);
      onAjoute(form);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'ajouter ce professeur"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Ajouter un professeur" onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={ajouter} autoComplete="off">
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="p-prenom">Prénom</label><input id="p-prenom" value={form.prenom} onChange={maj('prenom')} required autoFocus /></div>
          <div className="champ"><label htmlFor="p-nom">Nom</label><input id="p-nom" value={form.nom} onChange={maj('nom')} required /></div>
        </div>
        <div className="champ">
          <label htmlFor="p-email">Adresse e-mail</label>
          <input id="p-email" type="email" value={form.email} onChange={maj('email')} required />
          <small className="note-secondaire">Les liens d'accès temporaires sont envoyés à cette adresse.</small>
        </div>
        <div className="champ"><label htmlFor="p-matiere">Matière enseignée (facultatif)</label><input id="p-matiere" value={form.matiere} onChange={maj('matiere')} placeholder="Ex. Mathématiques" /></div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter le professeur'}</button>
        </div>
      </form>
    </Modal>
  );
}
