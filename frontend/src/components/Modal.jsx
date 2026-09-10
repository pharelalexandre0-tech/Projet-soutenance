import { useEffect } from 'react';

// Boîte de dialogue générique — remplace les alert()/confirm() natifs du
// navigateur (jamais habillables, toujours collés à la barre d'URL) par un
// vrai composant cohérent avec le reste de l'interface.
export default function Modal({ titre, onFermer, children, largeur = 480 }) {
  useEffect(() => {
    function surEchap(e) { if (e.key === 'Escape') onFermer(); }
    document.addEventListener('keydown', surEchap);
    return () => document.removeEventListener('keydown', surEchap);
  }, [onFermer]);

  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale-carte" style={{ maxWidth: largeur }} onClick={(e) => e.stopPropagation()}>
        <div className="modale-entete">
          <h2>{titre}</h2>
          <button type="button" className="modale-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        </div>
        <div className="modale-corps">{children}</div>
      </div>
    </div>
  );
}
