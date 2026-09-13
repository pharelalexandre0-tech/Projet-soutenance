import logoIcon from '../assets/logo-icon.png';
import MotifPoints from './MotifPoints';

export default function TransitionOuverture() {
  return (
    <div className="transition-ouverture">
      <div className="halo-ouverture">
        <MotifPoints className="motif-ouverture" />
        <span className="sceau"><img src={logoIcon} alt="" /></span>
      </div>
      <h1>Ouverture de votre espace</h1>
      <p>Préparation de votre session en cours…</p>
      <div className="piste-progres">
        <div className="barre-progres" />
      </div>
    </div>
  );
}
