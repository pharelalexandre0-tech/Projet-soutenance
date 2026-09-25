import { useState } from 'react';
import Comportement from './Comportement';
import AlertesDecrochage from './AlertesDecrochage';


// Diagramme d'activité 7 : déclencher l'analyse -> collecte -> calcul du
// score -> alerte si seuil dépassé -> l'Académie consulte le dossier et
// décide d'une action. Le signalement de comportement vit ici (sous-onglet)
// plutôt que dans un onglet "Absences" à part : c'est un des trois signaux
// de ce même calcul (notes, absences, comportement), pas un sujet séparé.
export default function PredictionIA() {
  const [onglet, setOnglet] = useState('alertes');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'alertes' ? 'actif' : ''} onClick={() => setOnglet('alertes')}>Alertes décrochage</button>
        <button className={onglet === 'comportement' ? 'actif' : ''} onClick={() => setOnglet('comportement')}>Signaler un comportement</button>
      </div>
      {onglet === 'alertes' && <AlertesDecrochage />}
      {onglet === 'comportement' && <Comportement />}
    </div>
  );
}


