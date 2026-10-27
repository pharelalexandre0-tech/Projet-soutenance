import { Link } from 'react-router-dom';
import logoIcon from '../assets/logo-icon.png';
import Tissage from './Tissage';
import { IconArrowLeft } from './icons';

// Gabarit des pages publiques (vérification, confidentialité) : la bande
// tissée de la connexion en haut, la marque, un titre en grand et un pied
// de page sobre. Même papier et même typographie que l'écran de connexion.
export default function PagePublique({ surtitre, titre, introduction, retour = 'Retour à la connexion', className = '', children }) {
  return (
    <div className={`page-publique ${className}`}>
      <div className="pp-tissage"><Tissage colonnes={30} lignes={2} /></div>
      <div className="pp-cadre">
        <header className="pp-barre">
          <Link to="/connexion" className="login-marque">
            <img src={logoIcon} alt="" />
            <span><strong>EduSphere</strong><small>Enseignement supérieur · Gabon</small></span>
          </Link>
          <Link to="/connexion" className="pp-retour"><IconArrowLeft aria-hidden="true" /> {retour}</Link>
        </header>
        <div className="pp-titre">
          {surtitre && <p className="acces-eyebrow">{surtitre}</p>}
          <h1>{titre}</h1>
          {introduction && <p className="pp-introduction">{introduction}</p>}
        </div>
        <main className="pp-corps">{children}</main>
        <footer className="pp-pied">
          <span>© {new Date().getFullYear()} EduSphere · Libreville</span>
          <span className="pp-pied-liens">
            <Link to="/verifier">Vérifier un document</Link>
            <Link to="/confidentialite">Politique de confidentialité</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
