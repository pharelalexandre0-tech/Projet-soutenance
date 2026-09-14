import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TransitionOuverture from '../components/TransitionOuverture';
import { IconMail, IconLock } from '../components/icons';
import logoIcon from '../assets/logo-icon.png';

// Huitième passe : carte à deux panneaux avec bord incurvé (référence
// donnée par l'utilisateur), sur le dégradé bleu déjà en place. Pas de
// bascule "créer un compte" — EduSphere n'a pas d'inscription libre, les
// comptes sont créés par l'Académie ou le Superadmin — donc le panneau de
// bienvenue reste statique, purement identitaire.
function PanneauBienvenue() {
  return (
    <div className="panneau-bienvenue">
      <span className="motif-bienvenue" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </span>
      <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
      <h1 className="marque-nom">EduSphere</h1>
      <p className="bienvenue-texte">
        Classes, notes, absences, finances et bulletins — l'espace de
        gestion académique de votre établissement.
      </p>
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
        <div className="carte-acces">
          <PanneauBienvenue />
          <div className="panneau-formulaire-acces">
            <p className="acces-eyebrow">Étape 2</p>
            <h2>Vérification</h2>
            <p className="connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail — saisis-le pour continuer.</p>
            <form className="formulaire-connexion" onSubmit={validerCode}>
              <div className="champ">
                <label>Code de vérification</label>
                <div className="champ-icone">
                  <IconLock aria-hidden="true" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    required
                  />
                </div>
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
      </div>
    );
  }

  return (
    <div className="page-connexion">
      <div className="carte-acces">
        <PanneauBienvenue />
        <div className="panneau-formulaire-acces">
          <p className="acces-eyebrow">Bon retour</p>
          <h2>Se connecter</h2>
          <form className="formulaire-connexion" onSubmit={onSubmit}>
            <div className="champ">
              <label>Adresse e-mail</label>
              <div className="champ-icone">
                <IconMail aria-hidden="true" />
                <input
                  type="email"
                  placeholder="vous@etablissement.ga"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="champ">
              <label>Mot de passe</label>
              <div className="champ-icone">
                <IconLock aria-hidden="true" />
                <input
                  type="password"
                  placeholder="Votre mot de passe"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </div>
            </div>
            {erreur && <div className="connexion-erreur">{erreur}</div>}
            <button className="bouton-connexion" type="submit" disabled={enCours}>
              {enCours ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
