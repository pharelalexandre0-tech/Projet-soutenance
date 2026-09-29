import { useEffect, useRef } from 'react';

const LONGUEUR = 6;

// Saisie du code de vérification en six bulles « liquides » : les bulles
// voisines fusionnent (filtre SVG), se colorent à mesure qu'on tape, puis se
// rassemblent en une seule pendant la vérification, qui devient une coche
// (code accepté) ou une croix (code refusé).
// `etat` : 'saisie' | 'verification' | 'succes' | 'erreur'.
export default function SaisieCodeLiquide({ valeur, onChange, onComplet, etat, autoFocus = true }) {
  const champs = useRef([]);
  // Valeur à jour même entre deux rendus (frappe rapide, collage).
  const courant = useRef(valeur);
  courant.current = valeur;
  const chiffres = Array.from({ length: LONGUEUR }, (_, i) => valeur[i] || '');
  const actif = Math.min(valeur.length, LONGUEUR - 1);
  const bloque = etat !== 'saisie';

  useEffect(() => {
    if (etat === 'saisie' && autoFocus) champs.current[Math.min(valeur.length, LONGUEUR - 1)]?.focus();
  }, [etat]); // eslint-disable-line react-hooks/exhaustive-deps

  function remplir(texte, depuis) {
    const propre = texte.replace(/\D/g, '');
    if (!propre) return;
    const base = courant.current;
    const suite = (base.slice(0, Math.min(depuis, base.length)) + propre).slice(0, LONGUEUR);
    courant.current = suite;
    onChange(suite);
    champs.current[Math.min(suite.length, LONGUEUR - 1)]?.focus();
    if (suite.length === LONGUEUR) onComplet?.(suite);
  }

  function effacer(i) {
    const base = courant.current;
    const cible = base[i] ? i : Math.max(0, i - 1);
    courant.current = base.slice(0, cible);
    onChange(courant.current);
    champs.current[cible]?.focus();
  }

  return (
    <div className={`code-liquide etat-${etat}`}>
      <svg className="code-liquide-filtre" aria-hidden="true" focusable="false">
        <defs>
          <filter id="filtre-liquide">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="flou" />
            <feColorMatrix in="flou" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="liquide" />
            <feComposite in="SourceGraphic" in2="liquide" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="code-liquide-bulles" aria-hidden="true">
        {chiffres.map((c, i) => (
          <span key={i} className={`bulle ${c ? 'remplie' : ''} ${i === actif && etat === 'saisie' ? 'active' : ''}`} style={{ '--i': i }} />
        ))}
      </div>
      <div className="code-liquide-cases" role="group" aria-label="Code de vérification à 6 chiffres">
        {chiffres.map((c, i) => (
          <input
            key={i}
            ref={(el) => { champs.current[i] = el; }}
            value={c}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LONGUEUR}
            disabled={bloque}
            aria-label={`Chiffre ${i + 1}`}
            onFocus={(e) => { const n = courant.current.length; if (i > n) champs.current[Math.min(n, LONGUEUR - 1)]?.focus(); else e.target.select(); }}
            onChange={(e) => {
              // Frappe dans une case déjà remplie : seul le nouveau chiffre compte.
              const v = e.target.value;
              remplir(c && v.length === 2 ? (v[0] === c ? v[1] : v[0]) : v.slice(-LONGUEUR), i);
            }}
            onPaste={(e) => { e.preventDefault(); remplir(e.clipboardData.getData('text'), 0); }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') { e.preventDefault(); effacer(i); }
              if (e.key === 'ArrowLeft') champs.current[i - 1]?.focus();
              if (e.key === 'ArrowRight' && c) champs.current[i + 1]?.focus();
              if (e.key === 'Enter' && courant.current.length === LONGUEUR) onComplet?.(courant.current);
            }}
          />
        ))}
      </div>
      <div className="code-liquide-resultat" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          {etat === 'succes' && <path className="trace" d="M5 12.5l4.2 4.2L19 7" />}
          {etat === 'erreur' && <path className="trace" d="M7 7l10 10M17 7L7 17" />}
        </svg>
      </div>
    </div>
  );
}
