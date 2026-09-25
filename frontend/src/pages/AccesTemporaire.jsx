import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import Modal from '../components/Modal';
import logoIcon from '../assets/logo-icon.png';
import { IconClock, IconCircleCheck, IconCircleAlert, IconPencil, IconCalendarAlert, IconSend } from '../components/icons';

// Diagramme 4 : le Professeur ouvre le lien reçu -> verifierJeton ->
// session temporaire ouverte, limitée à la portée définie -> formulaire de
// saisie (notes ou absences selon la tâche du lien) -> compte révoqué
// automatiquement.
export default function AccesTemporaire() {
  const { jeton } = useParams();
  const [session, setSession] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(null); // récapitulatif affiché une fois la saisie envoyée
  const [, setTic] = useState(0);

  useEffect(() => {
    client
      .get(`/comptes-ephemeres/${jeton}`)
      .then((res) => setSession(res.data))
      .catch((err) => setErreur(err.response?.data?.erreur || 'lien invalide'));
  }, [jeton]);

  useEffect(() => {
    const minuteur = setInterval(() => setTic((t) => t + 1), 20 * 1000);
    return () => clearInterval(minuteur);
  }, []);

  if (erreur && !session) return <EcranLienFerme message={erreur} />;
  if (!session) {
    return (
      <div className="page-acces">
        <div className="acces-etat"><div className="chargement">Vérification du lien…</div></div>
      </div>
    );
  }

  const expire = new Date(session.dateExpiration) <= new Date();
  const appel = session.tache === 'saisie_absences';

  if (envoi) {
    return (
      <PageAcces session={session}>
        <div className="acces-etat">
          <div className="acces-etat-carte">
            <span className="resultat-icone ok"><IconCircleCheck /></span>
            <h1>{appel ? "Merci, l'appel est enregistré" : 'Merci, les notes sont enregistrées'}</h1>
            <p>{envoi}</p>
            <p className="acces-etat-note">Ce lien est maintenant fermé. Vous pouvez fermer cette page.</p>
          </div>
        </div>
      </PageAcces>
    );
  }

  if (expire) {
    return <EcranLienFerme message="lien expiré, demande un nouvel accès" session={session} />;
  }

  return (
    <PageAcces session={session} minuteur>
      <main className="acces-contenu">
        <section className="acces-mission">
          <span className="acces-mission-icone">{appel ? <IconCalendarAlert /> : <IconPencil />}</span>
          <div className="acces-mission-texte">
            <span className="acces-surtitre">{appel ? "Faire l'appel" : 'Saisie des notes'}</span>
            <h1>Bonjour {session.professeur.prenom} {session.professeur.nom}</h1>
            <p>
              {appel
                ? "Indiquez les élèves absents ou en retard pour la séance d'aujourd'hui. Les autres sont comptés présents."
                : 'Saisissez la moyenne de chaque élève sur 20. Le lien se ferme dès que vous envoyez la saisie.'}
            </p>
          </div>
          <dl className="acces-portee">
            <div><dt>Classe</dt><dd>{session.portee.classe}</dd></div>
            {appel ? (
              <div><dt>Date</dt><dd>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</dd></div>
            ) : (
              <>
                <div><dt>Matière</dt><dd>{session.portee.matiere}{session.portee.ue ? <small>{session.portee.ue}</small> : null}</dd></div>
                <div><dt>Type de note</dt><dd>{session.portee.categorie === 'examen' ? 'Examen' : 'Contrôle continu'}</dd></div>
                {session.portee.evaluation && <div><dt>Évaluation</dt><dd>{session.portee.evaluation}</dd></div>}
              </>
            )}
            <div><dt>Élèves</dt><dd>{session.eleves.length}</dd></div>
          </dl>
        </section>

        {appel
          ? <FormulaireAppel jeton={jeton} session={session} onEnvoye={setEnvoi} />
          : <FormulaireNotes jeton={jeton} session={session} onEnvoye={setEnvoi} />}
      </main>
    </PageAcces>
  );
}

function tempsRestant(date) {
  const minutes = Math.max(0, Math.round((new Date(date) - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `${heures} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `${Math.round(heures / 24)} jours`;
}

function PageAcces({ session, minuteur = false, children }) {
  const etab = session?.etablissement;
  const restant = minuteur && session ? tempsRestant(session.dateExpiration) : null;
  const bientot = minuteur && session && new Date(session.dateExpiration) - Date.now() < 10 * 60 * 1000;
  return (
    <div className="page-acces">
      <header className="acces-entete">
        <div className="acces-marque">
          <span className="acces-logo"><img src={etab?.logo || logoIcon} alt="" /></span>
          <span className="acces-marque-textes">
            <strong>{etab?.nom || 'EduSphere'}</strong>
            <small>Accès temporaire professeur</small>
          </span>
        </div>
        {restant && (
          <span className={`acces-minuteur ${bientot ? 'bientot' : ''}`} title={`Valable jusqu'au ${new Date(session.dateExpiration).toLocaleString('fr-FR')}`}>
            <IconClock /> Lien valable encore {restant}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}

function EcranLienFerme({ message, session }) {
  const expire = /expir/i.test(message);
  const utilise = /plus actif|déjà été/i.test(message);
  const titre = expire ? 'Ce lien a expiré' : utilise ? "Ce lien n'est plus actif" : 'Lien invalide';
  const texte = expire
    ? "La durée de validité fixée par l'établissement est dépassée."
    : utilise
      ? "La saisie a déjà été envoyée, ou l'établissement a fermé cet accès."
      : "Ce lien est incomplet ou ne correspond à aucun accès. Vérifiez qu'il a été copié en entier.";
  return (
    <PageAcces session={session}>
      <div className="acces-etat">
        <div className="acces-etat-carte">
          <span className="resultat-icone attention"><IconCircleAlert /></span>
          <h1>{titre}</h1>
          <p>{texte}</p>
          <p className="acces-etat-note">Pour obtenir un nouveau lien, contactez le service de scolarité de l'établissement.</p>
        </div>
      </div>
    </PageAcces>
  );
}

function BarreEnvoi({ resume, erreur, enCours, desactive, libelle }) {
  return (
    <div className="acces-barre-envoi">
      <div className="acces-barre-envoi-textes">
        {erreur ? <span className="acces-erreur">{erreur}</span> : <span>{resume}</span>}
      </div>
      <button className="primaire" type="submit" disabled={enCours || desactive}>
        <IconSend /> {enCours ? 'Envoi…' : libelle}
      </button>
    </div>
  );
}

function valeurValide(v) {
  if (v === '' || v === undefined) return true;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 20;
}

function FormulaireNotes({ jeton, session, onEnvoye }) {
  const [notes, setNotes] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const champs = useRef([]);

  const saisies = session.eleves.filter((e) => notes[e.id] !== undefined && notes[e.id] !== '');
  const invalides = session.eleves.filter((e) => !valeurValide(notes[e.id]));
  const manquantes = session.eleves.length - saisies.length;
  const valeurs = saisies.filter((e) => valeurValide(notes[e.id])).map((e) => Number(String(notes[e.id]).replace(',', '.')));
  const moyenne = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;

  function surEntree(e, i) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    champs.current[i + 1]?.focus();
  }

  function demander(e) {
    e.preventDefault();
    setErreur('');
    if (invalides.length) { setErreur('Certaines notes ne sont pas comprises entre 0 et 20.'); return; }
    if (saisies.length === 0) { setErreur('Saisissez au moins une note avant d\'envoyer.'); return; }
    setConfirmation(true);
  }

  async function envoyer() {
    setEnCours(true);
    try {
      await client.post(`/comptes-ephemeres/${jeton}/notes`, {
        notes: saisies.map((e) => ({ eleveId: e.id, valeur: Number(String(notes[e.id]).replace(',', '.')) })),
      });
      onEnvoye(`${saisies.length} moyenne${saisies.length > 1 ? 's' : ''} de ${session.portee.matiere} enregistrée${saisies.length > 1 ? 's' : ''} pour la classe ${session.portee.classe}.`);
    } catch (err) {
      setConfirmation(false);
      setErreur(err.response?.data?.erreur || "l'envoi a échoué, réessayez");
      setEnCours(false);
    }
  }

  return (
    <form className="acces-formulaire" onSubmit={demander} noValidate>
      <section className="carte acces-liste">
        <div className="entete-carte">
          <h2>Moyennes sur 20</h2>
          <span className="entete-carte-compteur">{saisies.length} / {session.eleves.length} saisies</span>
        </div>
        {session.eleves.length === 0 && <div className="vide">Aucun élève dans cette classe.</div>}
        <ol className="acces-eleves">
          {session.eleves.map((eleve, i) => {
            const invalide = !valeurValide(notes[eleve.id]);
            return (
              <li key={eleve.id} className={invalide ? 'invalide' : ''}>
                <span className="acces-numero">{i + 1}</span>
                <label className="acces-eleve" htmlFor={`note-${eleve.id}`}>
                  <strong>{eleve.nom} {eleve.prenom}</strong>
                  {eleve.matricule && <small>{eleve.matricule}</small>}
                </label>
                <div className="acces-note">
                  <input
                    id={`note-${eleve.id}`}
                    ref={(el) => { champs.current[i] = el; }}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="--"
                    value={notes[eleve.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [eleve.id]: e.target.value }))}
                    onKeyDown={(e) => surEntree(e, i)}
                    aria-invalid={invalide}
                  />
                  <span>/ 20</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <BarreEnvoi
        resume={invalides.length
          ? <span className="acces-erreur">{invalides.length} note{invalides.length > 1 ? 's' : ''} hors de l'échelle 0 à 20.</span>
          : saisies.length === 0
          ? 'Astuce : la touche Entrée passe à l\'élève suivant.'
          : `${saisies.length} note${saisies.length > 1 ? 's' : ''} saisie${saisies.length > 1 ? 's' : ''}${moyenne !== null ? `, moyenne de classe ${moyenne.toFixed(2).replace('.', ',')}` : ''}${manquantes ? `, ${manquantes} élève${manquantes > 1 ? 's' : ''} sans note` : ''}.`}
        erreur={erreur}
        enCours={enCours}
        desactive={session.eleves.length === 0}
        libelle="Envoyer les notes"
      />
      {confirmation && (
        <Modal titre="Envoyer les notes ?" onFermer={() => !enCours && setConfirmation(false)} largeur={460}>
          <p className="confirmation-texte">
            {saisies.length} moyenne{saisies.length > 1 ? 's' : ''} {saisies.length > 1 ? 'seront transmises' : 'sera transmise'} à l'établissement.
            {manquantes > 0 && ` ${manquantes} élève${manquantes > 1 ? 's restent' : ' reste'} sans note : il faudra un nouvel accès pour ${manquantes > 1 ? 'les' : 'le'} compléter.`}
            {' '}Une fois l'envoi fait, ce lien se ferme.
          </p>
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={() => setConfirmation(false)} disabled={enCours}>Revoir la saisie</button>
            <button type="button" className="primaire" onClick={envoyer} disabled={enCours}><IconSend /> {enCours ? 'Envoi…' : 'Envoyer'}</button>
          </div>
        </Modal>
      )}
    </form>
  );
}

const OPTIONS_STATUT = [
  { valeur: 'present', libelle: 'Présent' },
  { valeur: 'absence', libelle: 'Absent' },
  { valeur: 'retard', libelle: 'Retard' },
];

function dateDuJour() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function FormulaireAppel({ jeton, session, onEnvoye }) {
  const [statuts, setStatuts] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const compte = (s) => session.eleves.filter((e) => (statuts[e.id] || 'present') === s).length;
  const absents = compte('absence');
  const retards = compte('retard');
  const presents = compte('present');

  function demander(e) {
    e.preventDefault();
    setErreur('');
    setConfirmation(true);
  }

  async function envoyer() {
    setEnCours(true);
    const ids = (s) => Object.entries(statuts).filter(([, v]) => v === s).map(([id]) => Number(id));
    try {
      await client.post(`/comptes-ephemeres/${jeton}/absences`, { date: dateDuJour(), absentEleveIds: ids('absence'), retardEleveIds: ids('retard') });
      onEnvoye(`${presents} présent${presents > 1 ? 's' : ''}, ${absents} absent${absents > 1 ? 's' : ''} et ${retards} retard${retards > 1 ? 's' : ''} enregistrés pour la classe ${session.portee.classe}.`);
    } catch (err) {
      setConfirmation(false);
      setErreur(err.response?.data?.erreur || "l'envoi a échoué, réessayez");
      setEnCours(false);
    }
  }

  return (
    <form className="acces-formulaire" onSubmit={demander}>
      <section className="carte acces-liste">
        <div className="entete-carte">
          <h2>Liste d'appel</h2>
          <div className="acces-compteurs">
            <span className="badge vert">{presents} présent{presents > 1 ? 's' : ''}</span>
            <span className="badge rouge">{absents} absent{absents > 1 ? 's' : ''}</span>
            <span className="badge or">{retards} retard{retards > 1 ? 's' : ''}</span>
          </div>
        </div>
        {session.eleves.length === 0 && <div className="vide">Aucun élève dans cette classe.</div>}
        <ol className="acces-eleves">
          {session.eleves.map((eleve, i) => {
            const statut = statuts[eleve.id] || 'present';
            return (
              <li key={eleve.id} className={`statut-${statut}`}>
                <span className="acces-numero">{i + 1}</span>
                <span className="acces-eleve">
                  <strong>{eleve.nom} {eleve.prenom}</strong>
                  {eleve.matricule && <small>{eleve.matricule}</small>}
                </span>
                <div className="ligne-appel-options" role="group" aria-label={`Statut de ${eleve.prenom} ${eleve.nom}`}>
                  {OPTIONS_STATUT.map((opt) => (
                    <button
                      type="button"
                      key={opt.valeur}
                      className={`case-statut ${opt.valeur}${statut === opt.valeur ? ' actif' : ''}`}
                      aria-pressed={statut === opt.valeur}
                      onClick={() => setStatuts({ ...statuts, [eleve.id]: opt.valeur })}
                    >
                      {opt.libelle}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <BarreEnvoi
        resume={absents + retards === 0 ? 'Tous les élèves sont marqués présents.' : `${absents} absent${absents > 1 ? 's' : ''} et ${retards} retard${retards > 1 ? 's' : ''} à signaler.`}
        erreur={erreur}
        enCours={enCours}
        desactive={session.eleves.length === 0}
        libelle="Envoyer l'appel"
      />
      {confirmation && (
        <Modal titre="Envoyer l'appel ?" onFermer={() => !enCours && setConfirmation(false)} largeur={460}>
          <p className="confirmation-texte">
            {presents} présent{presents > 1 ? 's' : ''}, {absents} absent{absents > 1 ? 's' : ''} et {retards} retard{retards > 1 ? 's' : ''} seront
            transmis à l'établissement. Une fois l'envoi fait, ce lien se ferme.
          </p>
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={() => setConfirmation(false)} disabled={enCours}>Revoir l'appel</button>
            <button type="button" className="primaire" onClick={envoyer} disabled={enCours}><IconSend /> {enCours ? 'Envoi…' : 'Envoyer'}</button>
          </div>
        </Modal>
      )}
    </form>
  );
}
