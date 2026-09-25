import { createContext, useContext } from 'react';

// Modules ouverts pour l'école de l'utilisateur, fournis par EspaceDashboard
// (qui les charge depuis /plateforme/etat). Sert aux pages qui mènent vers
// un autre onglet (actions rapides...) : ne pas proposer un raccourci vers
// un module que le superadmin a fermé pour cette école.
export const PlateformeContext = createContext(null);

export function useFonctionnaliteOuverte() {
  const fonctionnalites = useContext(PlateformeContext);
  // Tant que l'état n'est pas chargé, tout est considéré ouvert (même
  // hypothèse que le menu latéral).
  return (cle) => !fonctionnalites || fonctionnalites[cle] !== false;
}
