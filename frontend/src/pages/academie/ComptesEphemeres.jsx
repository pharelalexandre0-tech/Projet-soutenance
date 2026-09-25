import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  IconPlus, IconPencil, IconCalendarAlert, IconKey, IconUsers, IconCheck, IconCircleCheck, IconClock,
  IconMail, IconClose, IconSend, IconDocument, IconTrash,
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

const COLONNES = 'minmax(0, 1.3fr) minmax(0, 1.6fr) 150px 130px auto';

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
    return a.saisieEnvoyeeLe ? 'tous présents' : null;
  }
  return a.saisies > 0 ? `${a.saisies} note${a.saisies > 1 ? 's' : ''}` : null;
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

  // Le temps restant de chaque accès se met à jour tout seul.
  useEffect(() => {
    const minuteur = setInterval(() => setTic((t) => t + 1), 30 * 1000);
    return () => clearInterval(minuteur);
  }, []);

  const liste = acces || [];
  const ouverts = liste.filter((a) => a.statut === 'actif' && new Date(a.dateExpiration) > new Date());
  const saisiesRecues = liste.filter((a) => a.saisieEnvoyeeLe || a.saisies > 0).length;
  const affiches = liste.filter((a) => {
    const ouvert = a.statut === 'actif' && new Date(a.dateExpiration) > new Date();
    if (filtre === 'ouverts') return ouvert;
    if (filtre === 'termines') return !ouvert;
    return true;
  });
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

  async function fermer() {
    await client.patch(`/comptes-ephemeres/gestion/${aFermer.id}/revoquer`);
    setAFermer(null);
    setToast({ message: "Accès fermé : le lien ne fonctionne plus.", type: 'succes' });
    charger();
  }

  async function supprimerProfesseur() {
    await client.delete(`/professeurs/${professeurASupprimer.id}`);
    setProfesseurASupprimer(null);
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

      <div className="grille-principale">
        <div className="carte">
          <div className="entete-carte">
            <h2>Accès temporaires</h2>
            <button className="primaire" onClick={() => setCreation({})} disabled={professeurs.length === 0}>
              <IconPlus /> Nouvel accès
            </button>
          </div>
          <div className="barre-outils">
            <div className="filtres-puces" role="group" aria-label="Filtrer les accès">
              {FILTRES.map((f) => (
                <button key={f.id} className={filtre === f.id ? 'actif' : ''} onClick={() => setFiltre(f.id)}>{f.libelle}</button>
              ))}
            </div>
          </div>
          {professeurs.length === 0 && (
            <div className="vide">Ajoute d'abord un professeur (panneau de droite) pour pouvoir lui ouvrir un accès.</div>
          )}
          {!acces && <div className="chargement">Chargement…</div>}
          {acces && professeurs.length > 0 && affiches.length === 0 && (
            <div className="vide">
              {filtre === 'ouverts' ? 'Aucun accès ouvert en ce moment.' : 'Aucun accès dans cette liste.'}
            </div>
          )}
          {affiches.length > 0 && (
            <div className="liste-donnees">
              <div className="entete-donnees" style={{ gridTemplateColumns: COLONNES }}>
                <span>Professeur</span><span>Mission</span><span>Validité</span><span>Statut</span><span />
              </div>
              {affiches.map((a) => {
                const statut = statutAcces(a);
                const restant = statut.ouvert ? tempsRestant(a.dateExpiration) : null;
                return (
                  <div key={a.id} className="ligne-donnees" style={{ gridTemplateColumns: COLONNES }}>
                    <div className="cellule-principale">
                      <span className="avatar-initiales">{initiales(a.professeur)}</span>
                      <div className="textes">
                        <strong>{a.professeur ? `${a.professeur.prenom} ${a.professeur.nom}` : 'Professeur retiré'}</strong>
                        <small>{a.professeur?.email}</small>
                      </div>
                    </div>
                    <div className="cellule-mission">
                      <span className={`badge sans-point ${a.tache === 'saisie_absences' ? 'or' : 'bleu'}`}>
                        {a.tache === 'saisie_absences' ? 'Appel' : 'Notes'}
                      </span>
                      <span>
                        {a.classe?.nom}
                        {a.matiere ? ` · ${a.matiere.intitule}` : ''}
                        {a.tache !== 'saisie_absences' ? ` · ${a.categorie === 'examen' ? 'Examen' : 'CC'}${a.evaluation ? `, ${a.evaluation}` : ''}` : ''}
                      </span>
                    </div>
                    <div className="cellule-secondaire">
                      {restant ? <strong className="temps-restant"><IconClock />{restant}</strong> : null}
                      <small className="note-secondaire" style={{ display: 'block' }}>
                        {statut.ouvert ? `jusqu'au ${dateCourte(a.dateExpiration)}` : a.saisieEnvoyeeLe ? `reçue le ${dateCourte(a.saisieEnvoyeeLe)}` : `créé le ${dateCourte(a.dateCreation)}`}
                      </small>
                    </div>
                    <span>
                      <span className={`badge ${statut.badge}`}>{statut.texte}</span>
                      {detailSaisie(a) && <small className="note-secondaire" style={{ display: 'block', marginTop: 4 }}>{detailSaisie(a)}</small>}
                    </span>
                    <div className="actions-ligne">
                      {statut.ouvert && (
                        <>
                          <button className="bouton-icone-texte" onClick={() => copierLien(a)} title="Copier le lien"><IconDocument /> Copier</button>
                          <button className="bouton-icone-texte" onClick={() => renvoyer(a)} disabled={renvoiEnCours === a.id} title="Renvoyer l'e-mail">
                            <IconMail /> {renvoiEnCours === a.id ? 'Envoi…' : 'Renvoyer'}
                          </button>
                          <button className="bouton-icone-texte danger" onClick={() => setAFermer(a)} title="Fermer l'accès"><IconClose /> Fermer</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="carte">
          <div className="entete-carte">
            <h2>Professeurs</h2>
            <button className="secondaire" onClick={() => setAjoutProfesseur(true)}><IconPlus /> Ajouter</button>
          </div>
          {professeurs.length === 0 && <div className="vide">Aucun professeur enregistré.</div>}
          {professeurs.length > 0 && (
            <ul className="liste-professeurs">
              {professeurs.map((p) => (
                <li key={p.id}>
                  <span className="avatar-initiales">{initiales(p)}</span>
                  <div className="textes">
                    <strong>{p.prenom} {p.nom}</strong>
                    <small>{p.matiere || 'Matière non renseignée'} · {p.email}</small>
                    <small>{accesParProfesseur.get(p.id) || 0} accès délivré{(accesParProfesseur.get(p.id) || 0) > 1 ? 's' : ''}</small>
                  </div>
                  <div className="actions-ligne">
                    <button className="bouton-icone-texte" onClick={() => setCreation({ professeurId: String(p.id) })} title={`Ouvrir un accès à ${p.prenom} ${p.nom}`}>
                      <IconKey /> Accès
                    </button>
                    <button className="bouton-icone-texte danger" onClick={() => setProfesseurASupprimer(p)} title="Retirer ce professeur" aria-label={`Retirer ${p.prenom} ${p.nom}`}>
                      <IconTrash />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
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
