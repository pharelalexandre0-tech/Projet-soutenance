import { useEffect, useRef, useState } from 'react';
import './intro.css';
import calqueE from './logo/e.png';
import calqueS from './logo/s.png';
import calqueDore from './logo/dore.png';
import calqueTete from './logo/tete.png';
import calqueFeuilles from './logo/feuilles.png';
import calquePixels from './logo/pixels.png';

const CLE_DEMARRAGE = 'edusphere_demarrage_vu';
const DUREE_MS = 4400;
const NOM = 'EduSphere';

// Animation d'ouverture de l'application Android (le site garde son propre
// écran de démarrage). Les lettres du logo bougent un peu, avec du
// caractère : le E glisse et se redresse, le S se dandine, les feuilles
// poussent, la tête s'y pose ; puis E et S se soulèvent ensemble avant que
// le croissant doré, les pixels et le nom n'apparaissent.
// Un toucher passe l'animation.
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
      <div className="intro-sceau">
        <div className="intro-embleme">
          <img className="calque calque-dore" src={calqueDore} alt="" />
          <img className="calque calque-e" src={calqueE} alt="" />
          <img className="calque calque-s" src={calqueS} alt="" />
          <img className="calque calque-pixels" src={calquePixels} alt="" />
          <img className="calque calque-feuilles" src={calqueFeuilles} alt="" />
          <img className="calque calque-tete" src={calqueTete} alt="" />
        </div>
      </div>
      <div className="intro-nom">
        {NOM.split('').map((lettre, i) => <span key={i} style={{ '--i': i }}>{lettre}</span>)}
        <i className="intro-point" />
      </div>
      <p className="intro-sous-titre">Plateforme de gestion scolaire</p>
    </div>
  );
}
