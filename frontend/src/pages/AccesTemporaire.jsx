import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';

// Diagramme 4 : le Professeur ouvre le lien reçu -> verifierJeton ->
// session temporaire ouverte, limitée à la portée définie -> formulaire de
// saisie (notes ou absences selon la tâche du lien) -> compte révoqué
// automatiquement.
export default function AccesTemporaire() {
  const { jeton } = useParams();
  const [session, setSession] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    client
      .get(`/comptes-ephemeres/${jeton}`)
      .then((res) => setSession(res.data))
      .catch((err) => setErreur(err.response?.data?.erreur || 'lien invalide'));
  }, [jeton]);

  if (erreur && !session) {
    return (
      <div className="page-connexion">
        <div className="carte-connexion">
          <h1>Accès temporaire</h1>
          <p className="message-erreur">{erreur}</p>
        </div>
      </div>
    );
  }

  if (!session) return <div className="chargement">Chargement…</div>;

  if (envoye) {
    return (
      <div className="page-connexion">
        <div className="carte-connexion">
          <h1>{session.tache === 'saisie_absences' ? 'Appel enregistré' : 'Moyennes enregistrées'}</h1>
          <p className="message-succes">
            {session.tache === 'saisie_absences'
              ? "L'appel a bien été enregistré."
              : 'Les moyennes ont bien été enregistrées.'}{' '}
            Ce lien d'accès temporaire est maintenant révoqué.
          </p>
        </div>
      </div>
    );
  }

  return session.tache === 'saisie_absences'
    ? <FormulaireAppel jeton={jeton} session={session} onEnvoye={() => setEnvoye(true)} />
    : <FormulaireNotes jeton={jeton} session={session} onEnvoye={() => setEnvoye(true)} />;
}

function FormulaireNotes({ jeton, session, onEnvoye }) {
  const [notes, setNotes] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    const liste = Object.entries(notes)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([eleveId, valeur]) => ({ eleveId: Number(eleveId), valeur: Number(valeur) }));

    if (liste.length === 0) {
      setErreur('saisis au moins une note');
      setEnCours(false);
      return;
    }

    try {
      await client.post(`/comptes-ephemeres/${jeton}/notes`, { notes: liste });
      onEnvoye();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "lien expiré, demande un nouvel accès");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page-connexion">
      <div className="carte-connexion" style={{ maxWidth: 520 }}>
        <h1>Saisie des moyennes — accès temporaire</h1>
        <p className="sous-titre">
          {session.professeur.prenom} {session.professeur.nom} — {session.portee.classe} —{' '}
          {session.portee.ue} / {session.portee.matiere} — Moyenne {session.portee.categorie === 'examen' ? "d'examen" : 'de CC'}
          {session.portee.evaluation ? ` (${session.portee.evaluation})` : ''}
        </p>
        <form className="formulaire" onSubmit={onSubmit}>
          {session.eleves.map((eleve) => (
            <div className="ligne-champs" key={eleve.id}>
              <div className="champ" style={{ flex: 2 }}>
                <label>{eleve.prenom} {eleve.nom}</label>
              </div>
              <div className="champ">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  placeholder="/ 20"
                  onChange={(e) => setNotes((prev) => ({ ...prev, [eleve.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Enregistrer les notes'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Même principe que l'appel de l'Académie (Absences.jsx) : un clic par
// élève fait défiler présent -> absent -> retard.
function FormulaireAppel({ jeton, session, onEnvoye }) {
  const [statuts, setStatuts] = useState({});
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  function cycler(eleveId) {
    const suivant = { present: 'absence', absence: 'retard', retard: 'present' };
    const actuel = statuts[eleveId] || 'present';
    setStatuts({ ...statuts, [eleveId]: suivant[actuel] });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    const absentEleveIds = Object.entries(statuts).filter(([, s]) => s === 'absence').map(([id]) => Number(id));
    const retardEleveIds = Object.entries(statuts).filter(([, s]) => s === 'retard').map(([id]) => Number(id));

    try {
      await client.post(`/comptes-ephemeres/${jeton}/absences`, { date, absentEleveIds, retardEleveIds });
      onEnvoye();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "lien expiré, demande un nouvel accès");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page-connexion">
      <div className="carte-connexion" style={{ maxWidth: 520 }}>
        <h1>Faire l'appel — accès temporaire</h1>
        <p className="sous-titre">
          {session.professeur.prenom} {session.professeur.nom} — {session.portee.classe} — {new Date(date).toLocaleDateString('fr-FR')}
        </p>
        <form className="formulaire" onSubmit={onSubmit}>
          <p className="note-secondaire" style={{ marginTop: -4 }}>Clique un élève pour faire défiler présent → absent → retard.</p>
          <div className="liste-notifications">
            {session.eleves.map((eleve, i) => {
              const statut = statuts[eleve.id] || 'present';
              const fond = statut === 'absence' ? 'var(--erreur-fond)' : statut === 'retard' ? 'var(--alerte-fond)' : undefined;
              return (
                <button
                  type="button"
                  key={eleve.id}
                  className="notification-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: fond, width: '100%', textAlign: 'left', border: 'none' }}
                  onClick={() => cycler(eleve.id)}
                >
                  <span style={{ fontFamily: 'var(--police-mono)', color: 'var(--texte-clair)', width: 24 }}>{i + 1}.</span>
                  <span>{eleve.prenom} {eleve.nom}</span>
                  {statut === 'absence' && <span className="badge rouge" style={{ marginLeft: 'auto' }}>absent</span>}
                  {statut === 'retard' && <span className="badge or" style={{ marginLeft: 'auto' }}>retard</span>}
                </button>
              );
            })}
            {session.eleves.length === 0 && <div className="vide">Aucun élève dans cette classe</div>}
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : "Enregistrer l'appel"}
          </button>
        </form>
      </div>
    </div>
  );
}
