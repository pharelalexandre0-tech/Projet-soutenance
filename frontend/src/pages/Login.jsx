import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TransitionOuverture from '../components/TransitionOuverture';
import logoIcon from '../assets/logo-icon.png';

// Troisième refonte : ni le portrait "lettre officielle" (eyebrow + filet),
// ni le panneau scindé en deux — une carte simple, arrondie, sans bordure
// visible, posée sur le dégradé. La marque parle d'elle-même (pastille +
// nom), pas de vocabulaire de document administratif emprunté au bulletin.
function EnTeteCarte() {
  return (
    <div className="carte-connexion-entete">
      <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
      <h1 className="marque-nom">EduSphere</h1>
      <p className="carte-connexion-soustitre">Connexion à votre espace</p>
    </div>
  );
}

// Diagramme 3 : saisie identifiants -> demanderConnexion -> alt [valides]/[invalides].
export default function Login() {
  const { profil, seConnecter, verifierDoubleFacteur } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  // Double authentification (compte Étudiant) : le formulaire de mot de
  // passe cède la place à celui du code reçu par e-mail.
  const [attenteCode, setAttenteCode] = useState(null); // { utilisateurId } | null
  const [code, setCode] = useState('');

  if (ouverture) return <TransitionOuverture />;
  if (profil) return <Navigate to="/" replace />;

  function ouvrirSession() {
    setOuverture(true);
    setTimeout(() => navigate('/'), 1500);
  }

  async function connecter(mailUtilise, motDePasseUtilise) {
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await seConnecter(mailUtilise, motDePasseUtilise);
      if (resultat.doubleFacteurRequis) {
        setAttenteCode({ utilisateurId: resultat.utilisateurId });
        setEnCours(false);
        return;
      }
      ouvrirSession();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "identifiants incorrects");
      setEnCours(false);
    }
  }

  async function validerCode(e) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await verifierDoubleFacteur(attenteCode.utilisateurId, code);
      ouvrirSession();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'code incorrect');
      setEnCours(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    connecter(email, motDePasse);
  }

  if (attenteCode) {
    return (
      <div className="page-connexion">
        <div className="carte-connexion">
          <EnTeteCarte />
          <p className="carte-connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail — saisis-le pour continuer.</p>
          <form className="formulaire" onSubmit={validerCode}>
            <div className="champ">
              <label>Code de vérification</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
              />
            </div>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <button className="primaire" type="submit" disabled={enCours || code.length !== 6}>
              {enCours ? 'Vérification…' : 'Valider'}
            </button>
            <button
              type="button"
              className="secondaire"
              onClick={() => { setAttenteCode(null); setCode(''); setErreur(''); }}
            >
              Retour
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page-connexion">
      <div className="carte-connexion">
        <EnTeteCarte />
        <form className="formulaire" onSubmit={onSubmit}>
          <div className="champ">
            <label>Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="champ">
            <label>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
