import { useEffect, useRef, useState } from 'react';
import logoIcon from '../assets/logo-icon.png';
import FilOuverture from './FilOuverture';

const CLE_DEMARRAGE = 'edusphere_demarrage_vu';
const NOM = 'EduSphere';
const DUREE_AFFICHAGE_MS = 1900;
const DUREE_SORTIE_MS = 420;

// Une animation ne progresse pas dans un onglet caché : on n'attend jamais
// sa fin plus longtemps que prévu, l'écran de démarrage ne peut pas rester
// bloqué devant la connexion.
function auPlusTard(promesse, ms) {
  return Promise.race([promesse.catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}

// À afficher une seule fois par onglet, à l'ouverture de l'application.
// Pose aussi, tout de suite, la classe qui retient les animations de
// l'écran de connexion rendu dessous (voir .demarrage-en-cours en CSS).
export function demarrageAAfficher() {
  try {
    if (sessionStorage.getItem(CLE_DEMARRAGE)) return false;
  } catch {
    return false;
  }
  document.documentElement.classList.add('demarrage-en-cours');
  return true;
}

// Écran de démarrage : fond clair, le logo et le nom apparaissent, le fil
// aux couleurs d'EduSphere se tisse dessous. Il s'efface ensuite d'un fondu
// court pour laisser place à la connexion.
export default function EcranDemarrage({ onTermine }) {
  const racineRef = useRef(null);
  const [depart, setDepart] = useState(false);
  const onTermineRef = useRef(onTermine);
  onTermineRef.current = onTermine;

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let annule = false;

    function terminer() {
      if (annule) return;
      try { sessionStorage.setItem(CLE_DEMARRAGE, '1'); } catch { /* sans stockage : réaffiché au prochain chargement, sans gravité */ }
      document.documentElement.classList.remove('demarrage-en-cours');
      onTermineRef.current();
    }

    async function partir() {
      const racine = racineRef.current;
      if (!racine) return;
      setDepart(true);
      const fondu = racine.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: reduit ? 200 : DUREE_SORTIE_MS, easing: 'ease', fill: 'forwards' });
      if (fondu) await auPlusTard(fondu.finished, DUREE_SORTIE_MS + 300);
      terminer();
    }

    const minuteur = setTimeout(partir, reduit ? 500 : DUREE_AFFICHAGE_MS);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, []);

  return (
    <div className={`ecran-demarrage ecran-ouverture ${depart ? 'depart' : ''}`} ref={racineRef} aria-hidden="true">
      <div className="ouverture-centre">
        <span className="ouverture-logo"><img src={logoIcon} alt="" /></span>
        <h1 className="ouverture-nom">{NOM}</h1>
        <p className="ouverture-surtitre">Enseignement supérieur · Gabon</p>
        <FilOuverture />
      </div>
    </div>
  );
}
