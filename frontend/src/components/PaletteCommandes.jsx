import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconSearch, IconEnter } from './icons';

// Recherche de page au clavier (Ctrl+K / ⌘K) : saisir quelques lettres,
// flèches pour se déplacer, Entrée pour ouvrir. Les pages restent
// regroupées comme dans le menu latéral.
export default function PaletteCommandes({ onglets, onChoisir, onFermer }) {
  const [saisie, setSaisie] = useState('');
  const [indexActif, setIndexActif] = useState(0);
  const listeRef = useRef(null);

  const resultats = useMemo(() => {
    const filtre = saisie.trim().toLowerCase();
    return filtre
      ? onglets.filter((o) => `${o.label} ${o.groupe || ''} ${o.description || ''}`.toLowerCase().includes(filtre))
      : onglets;
  }, [onglets, saisie]);

  useEffect(() => setIndexActif(0), [saisie]);

  useEffect(() => {
    listeRef.current?.querySelector('.palette-option.active')?.scrollIntoView({ block: 'nearest' });
  }, [indexActif]);

  function surTouche(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndexActif((i) => Math.min(i + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndexActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (resultats[indexActif]) onChoisir(resultats[indexActif].id);
    } else if (e.key === 'Escape') {
      onFermer();
    }
  }

  let groupePrecedent = null;

  return createPortal(
    <div className="palette-fond" onMouseDown={onFermer}>
      <div className="palette" role="dialog" aria-label="Rechercher une page" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-saisie">
          <IconSearch />
          <input
            autoFocus
            placeholder="Rechercher une page…"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={surTouche}
            aria-controls="palette-liste"
          />
          <kbd>Échap</kbd>
        </div>
        <div className="palette-liste" id="palette-liste" ref={listeRef} role="listbox">
          {resultats.length === 0 && <div className="palette-vide">Aucune page ne correspond à « {saisie} ».</div>}
          {resultats.map((o, index) => {
            const Icone = o.icone;
            const titreGroupe = o.groupe && o.groupe !== groupePrecedent ? o.groupe : null;
            groupePrecedent = o.groupe;
            return (
              <div key={o.id}>
                {titreGroupe && <div className="palette-groupe">{titreGroupe}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === indexActif}
                  className={`palette-option ${index === indexActif ? 'active' : ''}`}
                  onMouseEnter={() => setIndexActif(index)}
                  onClick={() => onChoisir(o.id)}
                >
                  {Icone && <Icone />}
                  {o.label}
                  {index === indexActif && <small>Ouvrir</small>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-pied">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd><IconEnter width={11} height={11} /></kbd> ouvrir</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
