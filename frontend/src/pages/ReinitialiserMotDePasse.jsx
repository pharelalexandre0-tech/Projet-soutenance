import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { IconLock } from '../components/icons';

// Page ouverte depuis le lien reçu par e-mail (demandé sur Login via
// "Mot de passe oublié ?") — même esprit que AccesTemporaire.jsx : le jeton
// dans l'URL fait foi, pas de session requise pour l'atteindre.
export default function ReinitialiserMotDePasse() {
  const { jeton } = useParams();
  const navigate = useNavigate();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [reussi, setReussi] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur('');
    if (motDePasse !== confirmation) {
      setErreur('les deux mots de passe ne correspondent pas');
      return;
    }
    setEnCours(true);
    try {
      await client.post('/auth/reinitialiser-mot-de-passe', { token: jeton, motDePasse });
      setReussi(true);
      setTimeout(() => navigate('/connexion'), 2500);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'lien invalide ou expiré');
    } finally {
      setEnCours(false);
    }
  }

  if (reussi) {
    return (
      <div className="page-connexion">
        <div className="carte-connexion">
          <h1>Mot de passe mis à jour</h1>
          <p className="message-succes">Redirection vers la connexion…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-connexion">
      <div className="carte-connexion">
        <h1>Nouveau mot de passe</h1>
        <form className="formulaire" onSubmit={onSubmit}>
          <div className="champ">
            <label>Nouveau mot de passe</label>
            <div className="champ-icone">
              <IconLock aria-hidden="true" />
              <input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} minLength={6} required />
            </div>
          </div>
          <div className="champ">
            <label>Confirmer le mot de passe</label>
            <div className="champ-icone">
              <IconLock aria-hidden="true" />
              <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={6} required />
            </div>
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>
            {enCours ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
