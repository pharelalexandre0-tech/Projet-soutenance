import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TransitionOuverture from '../components/TransitionOuverture';
import logoIcon from '../assets/logo-icon.png';

// Cinquième passe : la version sans panneau lisait trop nu. On garde le
// principe (pas de bloc opaque posé dessus) mais on donne au dégradé du
// relief — un semis de nœuds reliés (l'"écosystème" du nom), pas une
// illustration décorative gratuite — et le formulaire vit dans un panneau
// de verre dépoli plutôt qu'à même le fond.
function ReseauFond() {
  const noeuds = [
    [90, 120], [220, 60], [340, 160], [180, 230], [60, 320],
    [280, 340], [420, 260], [500, 120], [610, 220], [560, 360],
    [700, 340], [760, 160], [820, 420], [380, 460], [160, 460],
  ];
  const liens = [
    [0, 1], [1, 2], [1, 3], [0, 3], [0, 4], [3, 5], [2, 6], [6, 7],
    [6, 9], [7, 8], [8, 9], [8, 11], [9, 10], [10, 11], [10, 12],
    [5, 13], [3, 14], [5, 14],
  ];
  return (
    <svg className="reseau-fond" viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {liens.map(([a, b], i) => (
        <line key={i} x1={noeuds[a][0]} y1={noeuds[a][1]} x2={noeuds[b][0]} y2={noeuds[b][1]} />
      ))}
      {noeuds.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.5} />
      ))}
    </svg>
  );
}

function EnTeteMarque() {
  return (
    <div className="marque-connexion">
      <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
      <h1 className="marque-nom">EduSphere</h1>
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
        <ReseauFond />
        <div className="contenu-connexion">
          <EnTeteMarque />
          <p className="connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail — saisis-le pour continuer.</p>
          <form className="formulaire-connexion" onSubmit={validerCode}>
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
            {erreur && <div className="connexion-erreur">{erreur}</div>}
            <button className="bouton-connexion" type="submit" disabled={enCours || code.length !== 6}>
              {enCours ? 'Vérification…' : 'Valider'}
            </button>
            <button
              type="button"
              className="connexion-retour"
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
      <ReseauFond />
      <div className="contenu-connexion">
        <EnTeteMarque />
        <form className="formulaire-connexion" onSubmit={onSubmit}>
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
          {erreur && <div className="connexion-erreur">{erreur}</div>}
          <button className="bouton-connexion" type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
