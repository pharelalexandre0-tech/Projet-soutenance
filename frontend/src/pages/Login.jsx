import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TransitionOuverture from '../components/TransitionOuverture';
import { IconMail, IconLock, IconLogout, IconPencil, IconCalendarAlert, IconBanknote, IconDocument } from '../components/icons';
import logoIcon from '../assets/logo-icon.png';

// Neuvième passe : deux cartes qui se chevauchent plutôt qu'une seule carte
// coupée en deux (référence donnée par l'utilisateur) — la carte blanche du
// formulaire est posée par-dessus la carte bleue, avec des formes
// organiques en fond au lieu d'un simple bord incurvé. Toujours pas de
// bascule "créer un compte", et pas de "se souvenir de moi" / "mot de
// passe oublié" — aucun des deux n'existe côté backend, une case à cocher
// qui ne fait rien n'a pas sa place ici.
//
// Dixième retouche : un paragraphe de description ne suffisait pas à
// donner un vrai sentiment de produit conçu — remplacé par une liste de
// fonctions concrètes avec icône, le réflexe habituel d'un écran de
// connexion professionnel pour donner de la substance au panneau de
// marque sans ajouter d'effet décoratif.
const FONCTIONS = [
  { icone: IconPencil, libelle: 'Notes & bulletins' },
  { icone: IconCalendarAlert, libelle: 'Suivi des absences' },
  { icone: IconBanknote, libelle: 'Gestion financière' },
  { icone: IconDocument, libelle: 'Emplois du temps' },
];

function CarteBienvenue() {
  return (
    <div className="carte-bienvenue-blob">
      <span className="blob blob-1" aria-hidden="true" />
      <span className="blob blob-2" aria-hidden="true" />
      <span className="blob blob-3" aria-hidden="true" />
      <div className="bienvenue-contenu">
        <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
        <h1 className="marque-nom">EduSphere</h1>
        <p className="bienvenue-texte">L'espace de gestion académique de votre établissement.</p>
        <ul className="liste-fonctions">
          {FONCTIONS.map(({ icone: Icone, libelle }) => (
            <li key={libelle}>
              <span className="liste-fonctions-icone"><Icone aria-hidden="true" /></span>
              {libelle}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Champ({ label, icone: Icone, children }) {
  return (
    <div className="champ">
      <label>{label}</label>
      <div className="champ-icone">
        <Icone aria-hidden="true" />
        <span className="champ-separateur" aria-hidden="true" />
        {children}
      </div>
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
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <p className="acces-eyebrow">Étape 2</p>
            <h2>Vérification</h2>
            <p className="connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail — saisis-le pour continuer.</p>
            <form className="formulaire-connexion" onSubmit={validerCode}>
              <Champ label="Code de vérification" icone={IconLock}>
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
              </Champ>
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
      <div className="composition-acces">
        <CarteBienvenue />
        <div className="carte-formulaire-acces">
          <p className="acces-eyebrow">Bon retour</p>
          <h2>Se connecter</h2>
          <form className="formulaire-connexion" onSubmit={onSubmit}>
            <Champ label="Adresse e-mail" icone={IconMail}>
              <input
                type="email"
                placeholder="vous@etablissement.ga"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Champ>
            <Champ label="Mot de passe" icone={IconLock}>
              <input
                type="password"
                placeholder="Votre mot de passe"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
              />
            </Champ>
            {erreur && <div className="connexion-erreur">{erreur}</div>}
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
