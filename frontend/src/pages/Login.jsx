import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TransitionOuverture from '../components/TransitionOuverture';
import { IconKey, IconBanknote, IconUsers, IconBuilding } from '../components/icons';
import logoIcon from '../assets/logo-icon.png';

const COMPTES_DEMO = [
  { role: 'superadmin', libelle: 'Superadmin', email: 'superadmin@edusphere.ga', description: 'Gérer les écoles', Icone: IconBuilding },
  { role: 'academie', libelle: 'Académie', email: 'academie@ecole.ga', description: 'Classes, notes, absences', Icone: IconKey },
  { role: 'finance', libelle: 'Finance', email: 'finance@ecole.ga', description: 'Frais & paiements', Icone: IconBanknote },
  { role: 'etudiant', libelle: 'Étudiant', email: 'etudiant1@example.com', description: 'Mon dossier', Icone: IconUsers },
];
const MOT_DE_PASSE_DEMO = 'password123';

// Diagramme 3 : saisie identifiants -> demanderConnexion -> alt [valides]/[invalides].
export default function Login() {
  const { profil, seConnecter } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [compteActif, setCompteActif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [ouverture, setOuverture] = useState(false);

  if (ouverture) return <TransitionOuverture />;
  if (profil) return <Navigate to="/" replace />;

  async function connecter(mailUtilise, motDePasseUtilise) {
    setErreur('');
    setEnCours(true);
    try {
      await seConnecter(mailUtilise, motDePasseUtilise);
      setOuverture(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setErreur(err.response?.data?.erreur || "identifiants incorrects");
      setEnCours(false);
    }
  }

  function choisirCompteDemo(compte) {
    setCompteActif(compte.role);
    setEmail(compte.email);
    setMotDePasse(MOT_DE_PASSE_DEMO);
    connecter(compte.email, MOT_DE_PASSE_DEMO);
  }

  function onSubmit(e) {
    e.preventDefault();
    setCompteActif('');
    connecter(email, motDePasse);
  }

  return (
    <div className="page-connexion">
      <div className="carte-connexion">
        <img className="logo-connexion" src={logoIcon} alt="EduSphere" />
        <h1>EduSphere</h1>
        <p className="sous-titre">L'écosystème éducatif intelligent gabonais</p>
        <form className="formulaire" onSubmit={onSubmit}>
          <div className="champ">
            <label>Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setCompteActif(''); }}
              required
            />
          </div>
          <div className="champ">
            <label>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => { setMotDePasse(e.target.value); setCompteActif(''); }}
              required
            />
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit" disabled={enCours}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="separateur-demo"><span>mode test — accès rapide</span></div>
        <div className="comptes-demo-grille">
          {COMPTES_DEMO.map((compte) => (
            <button
              key={compte.role}
              type="button"
              data-role={compte.role}
              className={`compte-demo-carte ${compteActif === compte.role ? 'actif' : ''}`}
              disabled={enCours}
              onClick={() => choisirCompteDemo(compte)}
            >
              <span className="compte-demo-icone"><compte.Icone width={16} height={16} /></span>
              <span className="compte-demo-texte">
                <strong>{compte.libelle}</strong>
                <small>{compte.description}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="comptes-demo-note">Un clic remplit les identifiants et connecte directement — mot de passe : <code>{MOT_DE_PASSE_DEMO}</code></p>
      </div>
    </div>
  );
}
