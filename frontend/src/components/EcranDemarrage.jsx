import { useEffect, useRef, useState } from 'react';
import logoIcon from '../assets/logo-icon.png';

export const CLE_DEMARRAGE = 'edusphere_demarrage_vu';
const NOM = 'EduSphere';
const DUREE_AFFICHAGE_MS = 2300;
const DUREE_TRANSITION_MS = 850;
const COURBE = 'cubic-bezier(.65, 0, .35, 1)';

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

// Écran de démarrage : le dégradé de la marque, le sceau et le nom. Pour
// en sortir, pas de fondu brutal : le dégradé se resserre jusqu'à devenir
// exactement la carte bleue de l'écran de connexion (repérée par
// data-cible-demarrage), pendant que le sceau et le nom glissent vers leur
// place dans cette carte. Le formulaire sort ensuite de sous la carte.
export default function EcranDemarrage({ onTermine }) {
  const racineRef = useRef(null);
  const sceauRef = useRef(null);
  const nomRef = useRef(null);
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
      const cible = document.querySelector('[data-cible-demarrage]');

      if (!cible || reduit || typeof racine.animate !== 'function') {
        const fondu = racine.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease', fill: 'forwards' });
        if (fondu) await auPlusTard(fondu.finished, 600);
        terminer();
        return;
      }

      const r = cible.getBoundingClientRect();
      const largeur = window.innerWidth;
      const hauteur = window.innerHeight;
      const rayon = getComputedStyle(cible).borderRadius || '30px';
      const fin = `inset(${r.top}px ${largeur - r.right}px ${hauteur - r.bottom}px ${r.left}px round ${rayon})`;
      const options = { duration: DUREE_TRANSITION_MS, easing: COURBE, fill: 'forwards' };

      const animations = [racine.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: fin }], options)];
      [[sceauRef.current, '.marque-pastille'], [nomRef.current, '.marque-nom']].forEach(([source, selecteur]) => {
        const destination = cible.querySelector(selecteur);
        if (!source || !destination) return;
        const a = source.getBoundingClientRect();
        const b = destination.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        const echelle = b.height / a.height;
        animations.push(source.animate(
          [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${echelle})` }],
          options
        ));
      });

      await auPlusTard(Promise.all(animations.map((a) => a.finished)), DUREE_TRANSITION_MS + 400);
      // Sceau et nom sont maintenant pile sur ceux de la carte : un court
      // fondu laisse apparaître le reste de la carte (texte, formes).
      await auPlusTard(racine.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' }).finished, 600);
      terminer();
    }

    const minuteur = setTimeout(partir, reduit ? 500 : DUREE_AFFICHAGE_MS);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, []);

  return (
    <div className={`ecran-demarrage ${depart ? 'depart' : ''}`} ref={racineRef} aria-hidden="true">
      <span className="demarrage-sceau" ref={sceauRef}><img src={logoIcon} alt="" /></span>
      <h1 className="demarrage-nom" ref={nomRef}>
        <span className="demarrage-lettres">
          {NOM.split('').map((lettre, i) => (
            <span key={i} style={{ animationDelay: `${0.18 + i * 0.045}s` }}>{lettre}</span>
          ))}
        </span>
      </h1>
      <p className="demarrage-sous-titre">Plateforme de gestion scolaire</p>
      <div className="demarrage-piste"><span /></div>
    </div>
  );
}
