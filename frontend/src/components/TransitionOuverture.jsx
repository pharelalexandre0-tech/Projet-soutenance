import logoIcon from '../assets/logo-icon.png';

// Les lettres du nom apparaissent une à une plutôt qu'un indicateur
// générique (barre de progression, points qui pulsent) — la marque elle-même
// qui s'assemble, sur la même couleur plate que l'écran de connexion.
function MarqueAnimee() {
  const lettres = 'EduSphere'.split('');
  return (
    <h1 className="marque-lettres" aria-label="EduSphere">
      {lettres.map((lettre, i) => (
        <span key={i} style={{ animationDelay: `${0.25 + i * 0.045}s` }}>{lettre}</span>
      ))}
    </h1>
  );
}

export default function TransitionOuverture() {
  return (
    <div className="transition-ouverture">
      <span className="filet-connexion" />
      <span className="sceau-ouverture"><img src={logoIcon} alt="" /></span>
      <MarqueAnimee />
      <p>Ouverture de votre espace…</p>
    </div>
  );
}
