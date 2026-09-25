import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Panneau latéral droit pour le détail d'un élément d'une liste (sans
// quitter la liste des yeux) : en-tête, contenu défilant, actions en pied.
export default function Tiroir({ titre, sousTitre, icone, onFermer, pied, children }) {
  useEffect(() => {
    function surEchap(e) { if (e.key === 'Escape') onFermer(); }
    document.addEventListener('keydown', surEchap);
    return () => document.removeEventListener('keydown', surEchap);
  }, [onFermer]);

  return createPortal(
    <>
      <div className="tiroir-fond" onClick={onFermer} />
      <aside className="tiroir" role="dialog" aria-label={titre}>
        <div className="tiroir-entete">
          {icone}
          <div>
            <h2>{titre}</h2>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
          <button type="button" className="modale-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        </div>
        <div className="tiroir-corps">{children}</div>
        {pied && <div className="tiroir-pied">{pied}</div>}
      </aside>
    </>,
    document.body
  );
}
