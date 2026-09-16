import logoIcon from '../assets/logo-icon.png';

// Les lettres du nom s'assemblent une à une — la marque elle-même qui se
// construit, sur le même dégradé que l'écran de connexion.
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
      <span className="sceau-ouverture"><img src={logoIcon} alt="" /></span>
      <MarqueAnimee />
      <p>Ouverture de votre espace…</p>
      <span className="piste-ouverture" aria-hidden="true">
        <span className="remplissage-ouverture" />
      </span>
    </div>
  );
}
