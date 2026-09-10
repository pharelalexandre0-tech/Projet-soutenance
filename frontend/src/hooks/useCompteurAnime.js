import { useEffect, useRef, useState } from 'react';

// Anime un nombre de sa valeur précédente vers sa nouvelle valeur (montage
// inclus, en partant de 0) au lieu de l'afficher figé.
export default function useCompteurAnime(cible, duree = 700) {
  const [valeur, setValeur] = useState(0);
  const origine = useRef(0);
  const depart = useRef(null);

  useEffect(() => {
    origine.current = valeur;
    depart.current = null;
    let frame;

    function etape(horodatage) {
      if (depart.current === null) depart.current = horodatage;
      const progression = Math.min(1, (horodatage - depart.current) / duree);
      const relachement = 1 - Math.pow(1 - progression, 3);
      setValeur(origine.current + (cible - origine.current) * relachement);
      if (progression < 1) frame = requestAnimationFrame(etape);
    }

    frame = requestAnimationFrame(etape);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible, duree]);

  return valeur;
}
