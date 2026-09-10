import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';

// Diagramme 4 : le Professeur ouvre le lien reçu -> verifierJeton ->
// session temporaire ouverte, limitée à la portée définie -> formulaire de
// saisie des notes -> enregistrerNotes -> compte révoqué automatiquement.
export default function AccesTemporaire() {
  const { jeton } = useParams();
  const [session, setSession] = useState(null);
  const [erreur, setErreur] = useState('');
  const [notes, setNotes] = useState({});
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    client
      .get(`/comptes-ephemeres/${jeton}`)
      .then((res) => setSession(res.data))
      .catch((err) => setErreur(err.response?.data?.erreur || 'lien invalide'));
  }, [jeton]);

  function changerNote(eleveId, valeur) {
    setNotes((prev) => ({ ...prev, [eleveId]: valeur }));
  }

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
      setEnvoye(true);
    } catch (err) {
      setErreur(err.response?.data?.erreur || "lien expiré, demande un nouvel accès");
    } finally {
      setEnCours(false);
    }
  }

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
          <h1>Moyennes enregistrées</h1>
          <p className="message-succes">
            Les moyennes ont bien été enregistrées. Ce lien d'accès temporaire est maintenant révoqué.
          </p>
        </div>
      </div>
    );
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
                  onChange={(e) => changerNote(eleve.id, e.target.value)}
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
