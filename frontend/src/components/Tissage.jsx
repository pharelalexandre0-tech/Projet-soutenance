import { useMemo } from 'react';

// Motif tissé inspiré des nattes de raphia du Gabon : une grille de cases
// géométriques (triangles, losanges, chevrons) aux couleurs d'EduSphere.
// Les cases se « tissent » en diagonale à l'apparition (animation CSS,
// délai calculé d'après leur position). Le dessin est déterministe : le
// même motif à chaque affichage.
const FORMES = ['plein', 'tri-haut', 'tri-bas', 'losange', 'chevron', 'demi', 'tri-haut', 'plein'];
const COULEURS = ['marine', 'bleu', 'teal', 'vert', 'marine', 'bleu'];

export default function Tissage({ colonnes = 9, lignes = 8, className = '' }) {
  const cases = useMemo(() => {
    const liste = [];
    for (let l = 0; l < lignes; l += 1) {
      for (let c = 0; c < colonnes; c += 1) {
        // Chevrons en bandes diagonales, quelques fils d'or, rares vides.
        const bande = (c + l) % 6;
        const croise = (c * 3 + l * 5) % 7;
        const forme = FORMES[(bande + croise) % FORMES.length];
        const couleur = (c * 7 + l * 3) % 23 === 0 ? 'or' : COULEURS[(bande + (l % 2)) % COULEURS.length];
        const vide = (c * 11 + l * 13) % 17 === 0;
        liste.push({ cle: `${l}-${c}`, forme: vide ? 'maille-vide' : forme, couleur, retourne: (c + l) % 2 === 1, delai: (c + l) * 0.045 });
      }
    }
    return liste;
  }, [colonnes, lignes]);

  return (
    <div className={`tissage ${className}`} style={{ '--colonnes': colonnes, '--lignes': lignes }} aria-hidden="true">
      {cases.map((k) => (
        <span key={k.cle} className={`maille ${k.forme} ${k.couleur} ${k.retourne ? 'retourne' : ''}`} style={{ '--delai': `${k.delai}s` }} />
      ))}
    </div>
  );
}
