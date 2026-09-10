import logoIcon from '../assets/logo-icon.png';

export default function TransitionOuverture() {
  return (
    <div className="transition-ouverture">
      <span className="sceau"><img src={logoIcon} alt="" /></span>
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
