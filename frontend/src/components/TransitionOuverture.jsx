// Les deux lettres du sceau (E et S) recréées en tracés vectoriels pour
// pouvoir les animer à l'ouverture — impossible avec la photo du logo
// (image plate) utilisée partout ailleurs dans l'appli.
function MarqueAnimee() {
  return (
    <svg viewBox="0 0 100 100" className="marque-animee" fill="none">
      <path
        className="trait-e"
        d="M72,20 C30,20 12,45 12,50 C12,55 30,80 72,80"
        stroke="var(--edu-marine)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        className="trait-e-barre"
        d="M18,50 L58,50"
        stroke="var(--edu-marine)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        className="trait-s"
        d="M66,26 C48,16 34,30 46,46 C58,62 44,76 26,66"
        stroke="url(#degrade-marque-s)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="degrade-marque-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--edu-bleu)" />
          <stop offset="55%" stopColor="var(--edu-vert)" />
          <stop offset="100%" stopColor="var(--edu-or)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function TransitionOuverture() {
  return (
    <div className="transition-ouverture">
      <span className="sceau"><MarqueAnimee /></span>
      <h1>Ouverture de votre espace</h1>
      <p>Préparation de votre session en cours…</p>
      <div className="vague-points">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
