import { useEffect, useRef, useState } from 'react';
import './intro.css';
import Tissage from '../components/Tissage';
import FilOuverture from '../components/FilOuverture';
import logoIcon from '../assets/logo-icon.png';

const CLE_DEMARRAGE = 'edusphere_demarrage_vu';
const DUREE_MS = 3600;

// Animation d'ouverture de l'application Android : le motif tissé
// d'EduSphere remplit l'écran case par case, puis remonte en bande comme sur
// l'écran de connexion ; le logo, le nom et le fil apparaissent sur le papier
// clair dessous (jamais dans un encadré). Un toucher passe l'animation.
export default function IntroApplication({ onTermine }) {
  const [depart, setDepart] = useState(false);
  const fini = useRef(false);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    setDepart(true);
    setTimeout(() => {
      try { sessionStorage.setItem(CLE_DEMARRAGE, '1'); } catch { /* sans stockage : rejouée au prochain lancement */ }
      document.documentElement.classList.remove('demarrage-en-cours');
      onTermine();
    }, 450);
  }

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minuteur = setTimeout(terminer, reduit ? 900 : DUREE_MS);
    return () => clearTimeout(minuteur);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`intro-app ${depart ? 'depart' : ''}`} onClick={terminer} aria-hidden="true">
      <div className="intro-motif"><Tissage colonnes={6} lignes={12} className="intro-tissage" /></div>
      <div className="intro-papier">
        <span className="intro-logo"><img src={logoIcon} alt="" /></span>
        <strong className="intro-nom">EduSphere</strong>
        <span className="intro-sous-titre">Enseignement supérieur · Gabon</span>
        <FilOuverture />
      </div>
    </div>
  );
}
