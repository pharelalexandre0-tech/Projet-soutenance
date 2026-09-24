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
        <h1>Saisie des moyennes (accès temporaire)</h1>
        <p className="sous-titre">
          {session.professeur.prenom} {session.professeur.nom}, {session.portee.classe},{' '}
          {session.portee.ue} / {session.portee.matiere}, Moyenne {session.portee.categorie === 'examen' ? "d'examen" : 'de CC'}
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

const OPTIONS_STATUT = [
  { valeur: 'present', libelle: 'Présent' },
  { valeur: 'absence', libelle: 'Absent' },
  { valeur: 'retard', libelle: 'Retard' },
];

function FormulaireAppel({ jeton, session, onEnvoye }) {
  const [statuts, setStatuts] = useState({});
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  function definir(eleveId, statut) {
    setStatuts({ ...statuts, [eleveId]: statut });
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
        <h1>Faire l'appel (accès temporaire)</h1>
        <p className="sous-titre">
          {session.professeur.prenom} {session.professeur.nom}, {session.portee.classe}, {new Date(date).toLocaleDateString('fr-FR')}
        </p>
        <form className="formulaire" onSubmit={onSubmit}>
          <p className="note-secondaire" style={{ marginTop: -4 }}>
            Coche le statut de chaque élève (présent par défaut).
          </p>
          <div className="liste-appel">
            {session.eleves.map((eleve, i) => {
              const statut = statuts[eleve.id] || 'present';
              return (
                <div className="ligne-appel" key={eleve.id}>
                  <span className="ligne-appel-nom">
                    <span style={{ fontFamily: 'var(--police-mono)', color: 'var(--texte-clair)', marginRight: 8 }}>{i + 1}.</span>
                    {eleve.prenom} {eleve.nom}
                  </span>
                  <div className="ligne-appel-options">
                    {OPTIONS_STATUT.map((opt) => (
                      <button
                        type="button"
                        key={opt.valeur}
                        className={`case-statut ${opt.valeur}${statut === opt.valeur ? ' actif' : ''}`}
                        aria-pressed={statut === opt.valeur}
                        onClick={() => definir(eleve.id, opt.valeur)}
                      >
                        {opt.libelle}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {session.eleves.length === 0 && <div className="vide">Aucun élève dans cette classe</div>}
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours || session.eleves.length === 0}>
            {enCours ? 'Enregistrement…' : "Enregistrer l'appel"}
          </button>
        </form>
      </div>
    </div>
  );
}
