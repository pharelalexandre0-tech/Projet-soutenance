import useCompteurAnime from '../hooks/useCompteurAnime';

export default function AnneauProgression({ valeur, sousLabel, taille = 128, epaisseur = 13, couleur }) {
  const r = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * r;
  const cible = Math.max(0, Math.min(100, valeur));
  const progres = useCompteurAnime(cible);
  const decalage = circonference - (progres / 100) * circonference;

  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} className="anneau-progression">
      <circle cx={taille / 2} cy={taille / 2} r={r} className="anneau-piste" strokeWidth={epaisseur} fill="none" />
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={r}
        className="anneau-remplissage"
        fill="none"
        strokeWidth={epaisseur}
        strokeLinecap="round"
        strokeDasharray={circonference}
        strokeDashoffset={decalage}
        transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
        style={{ stroke: couleur || 'var(--primaire)' }}
      />
      <text x="50%" y={sousLabel ? '46%' : '52%'} textAnchor="middle" dominantBaseline="middle" className="anneau-valeur">
        {Math.round(progres)}%
      </text>
      {sousLabel && (
        <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" className="anneau-souslabel">
          {sousLabel}
        </text>
      )}
    </svg>
  );
}
