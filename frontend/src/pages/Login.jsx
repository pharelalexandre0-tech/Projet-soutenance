import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import TransitionOuverture from '../components/TransitionOuverture';
import { IconMail, IconLock, IconLogout, IconGraduationCap, IconBook, IconBuilding, IconPencil, IconAlertTriangle } from '../components/icons';
import { messageErreur } from '../utils/erreurs';
import logoIcon from '../assets/logo-icon.png';

// Neuvième passe : deux cartes qui se chevauchent plutôt qu'une seule carte
// coupée en deux (référence donnée par l'utilisateur) — la carte blanche du
// formulaire est posée par-dessus la carte bleue, avec des formes
// organiques en fond au lieu d'un simple bord incurvé. Toujours pas de
// bascule "créer un compte" ni de "se souvenir de moi" — aucun des deux
// n'existe côté backend, une case à cocher qui ne fait rien n'a pas sa
// place ici. "Mot de passe oublié" existe bien, lui (ReinitialiserMotDePasse.jsx).
function CarteBienvenue() {
  return (
    <div className="carte-bienvenue-blob">
      <span className="blob blob-1" aria-hidden="true" />
      <span className="blob blob-2" aria-hidden="true" />
      <span className="blob blob-3" aria-hidden="true" />
      <span className="blob blob-4" aria-hidden="true" />
      <span className="particule particule-1" aria-hidden="true"><IconGraduationCap /></span>
      <span className="particule particule-2" aria-hidden="true"><IconBook /></span>
      <span className="particule particule-3" aria-hidden="true"><IconBuilding /></span>
      <span className="particule particule-4" aria-hidden="true"><IconPencil /></span>
      <span className="particule particule-5" aria-hidden="true"><IconGraduationCap /></span>
      <div className="bienvenue-contenu">
        <div className="marque-groupe">
          <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
          <h1 className="marque-nom">EduSphere</h1>
        </div>
        <p className="bienvenue-texte">
          Bienvenue sur EduSphere, l'espace numérique qui réunit toute
          la vie de votre établissement.
        </p>
      </div>
    </div>
  );
}

// `erreur` (optionnel) : ne dit jamais laquelle des deux valeurs est en
// cause — "identifiants incorrects" reste volontairement générique côté
// backend, révéler que c'est l'e-mail ou le mot de passe spécifiquement
// permettrait à quelqu'un de deviner quels comptes existent. On flague
// donc les deux champs à la fois, jamais un seul.
function Champ({ label, icone: Icone, erreur, children }) {
  return (
    <div className="champ">
      <label>{label}</label>
      <div className={erreur ? 'champ-icone champ-icone--erreur' : 'champ-icone'}>
        <Icone aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

function AlerteErreur({ children }) {
  return (
    <div className="connexion-erreur" role="alert">
      <IconAlertTriangle aria-hidden="true" />
      <span>{children}</span>
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
  // "Mot de passe oublié" : mini-formulaire à la place du formulaire de
  // connexion, pas une page séparée — évite un aller-retour complet pour
  // une action qui ne quitte jamais vraiment l'écran de connexion.
  const [motDePasseOublieOuvert, setMotDePasseOublieOuvert] = useState(false);
  const [emailOubli, setEmailOubli] = useState('');
  const [messageOubli, setMessageOubli] = useState('');
  const [erreurOubli, setErreurOubli] = useState(false);
  const [enCoursOubli, setEnCoursOubli] = useState(false);

  if (ouverture) return <TransitionOuverture />;
  if (profil) return <Navigate to="/" replace />;

  function ouvrirSession() {
    setOuverture(true);
    // 2.3s restait trop rapide — la barre de progression elle-même ne
    // remplissait que 0.65s, le reste n'était que la marque qui s'écrit.
    // Le remplissage porte maintenant la durée (1.7s), pas du temps mort
    // en plus. Doit rester synchronisé avec .transition-ouverture en CSS.
    setTimeout(() => navigate('/'), 3500);
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
      setErreur(messageErreur(err, 'identifiants incorrects'));
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
      setErreur(messageErreur(err, 'code incorrect'));
      setEnCours(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    connecter(email, motDePasse);
  }

  async function demanderReinitialisation(e) {
    e.preventDefault();
    setEnCoursOubli(true);
    try {
      const res = await client.post('/auth/mot-de-passe-oublie', { email: emailOubli });
      // Message volontairement identique côté backend, compte trouvé ou
      // non — sinon ce formulaire devient un moyen de vérifier quelles
      // adresses ont un compte ici.
      setErreurOubli(false);
      setMessageOubli(res.data.message);
    } catch (err) {
      setErreurOubli(true);
      setMessageOubli(messageErreur(err, "impossible d'envoyer l'e-mail pour le moment"));
    } finally {
      setEnCoursOubli(false);
    }
  }

  if (motDePasseOublieOuvert) {
    return (
      <div className="page-connexion">
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <p className="acces-eyebrow">Mot de passe oublié</p>
            <h2>Réinitialiser l'accès</h2>
            <p className="connexion-aide">Saisis ton e-mail. Si un compte existe, un lien de réinitialisation t'est envoyé.</p>
            <form className="formulaire-connexion" onSubmit={demanderReinitialisation}>
              <Champ label="Adresse e-mail" icone={IconMail}>
                <input
                  type="email"
                  placeholder="vous@etablissement.ga"
                  value={emailOubli}
                  onChange={(e) => setEmailOubli(e.target.value)}
                  autoFocus
                  required
                />
              </Champ>
              {messageOubli && (erreurOubli
                ? <AlerteErreur>{messageOubli}</AlerteErreur>
                : <div className="message-succes">{messageOubli}</div>)}
              <button className="bouton-connexion" type="submit" disabled={enCoursOubli}>
                {enCoursOubli ? 'Envoi…' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                className="connexion-retour"
                onClick={() => { setMotDePasseOublieOuvert(false); setMessageOubli(''); setErreurOubli(false); setEmailOubli(''); }}
              >
                Retour
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (attenteCode) {
    return (
      <div className="page-connexion">
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <p className="acces-eyebrow">Étape 2</p>
            <h2>Vérification</h2>
            <p className="connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail. Saisis-le pour continuer.</p>
            <form className="formulaire-connexion" onSubmit={validerCode}>
              <Champ label="Code de vérification" icone={IconLock} erreur={Boolean(erreur)}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErreur(''); }}
                  autoFocus
                  required
                />
              </Champ>
              {erreur && <AlerteErreur>{erreur}</AlerteErreur>}
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
      <div className="composition-acces">
        <CarteBienvenue />
        <div className="carte-formulaire-acces">
          <p className="acces-eyebrow">Bon retour</p>
          <h2>Se connecter</h2>
          <form className="formulaire-connexion" onSubmit={onSubmit}>
            <Champ label="Adresse e-mail" icone={IconMail} erreur={Boolean(erreur)}>
              <input
                type="email"
                placeholder="vous@etablissement.ga"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErreur(''); }}
                required
              />
            </Champ>
            <Champ label="Mot de passe" icone={IconLock} erreur={Boolean(erreur)}>
              <input
                type="password"
                placeholder="Votre mot de passe"
                value={motDePasse}
                onChange={(e) => { setMotDePasse(e.target.value); setErreur(''); }}
                required
              />
            </Champ>
            <button
              type="button"
              className="connexion-mot-de-passe-oublie"
              onClick={() => { setMotDePasseOublieOuvert(true); setEmailOubli(email); }}
            >
              Mot de passe oublié ?
            </button>
            {erreur && <AlerteErreur>{erreur}</AlerteErreur>}
            <button className="bouton-connexion" type="submit" disabled={enCours}>
              <IconLogout className="bouton-connexion-icone" aria-hidden="true" />
              {enCours ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
