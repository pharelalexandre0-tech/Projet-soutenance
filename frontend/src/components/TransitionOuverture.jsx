import logoIcon from '../assets/logo-icon.png';

export default function TransitionOuverture() {
  return (
    <div className="transition-ouverture">
      <span className="sceau-ouverture"><img src={logoIcon} alt="" /></span>
      <h1>EduSphere</h1>
      <p>Ouverture de votre espace…</p>
      <div className="indicateur-ouverture" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  );
}
