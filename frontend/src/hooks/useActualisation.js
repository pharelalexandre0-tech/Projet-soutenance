import { useEffect, useRef } from 'react';
import { ecouterEvenements } from '../api/tempsReel';
import { useAuth } from '../context/AuthContext';

// Recharge les données d'une page dès qu'une information change dans
// l'école (nouvel élève, note, absence, paiement, publication...), sans
// recherche ni changement d'onglet. Plusieurs changements rapprochés (un
// import de 60 élèves) ne provoquent qu'un seul rechargement.
//
// `charger` : la fonction de chargement de la page (elle peut changer à
// chaque rendu, c'est toujours la dernière qui est appelée).
// `plateforme` : recharger aussi sur les changements de la plateforme
// (maintenance, annonce, fonctionnalités ajoutées par le superadmin).
// `domaines` : pour un chargement coûteux, ne recharger que si le
// changement touche ces domaines (premier segment de l'adresse de l'API :
// notes, absences, finance, eleves...).
export default function useActualisation(charger, { plateforme = false, delai = 600, domaines = null } = {}) {
  const { profil } = useAuth();
  const chargerRef = useRef(charger);
  chargerRef.current = charger;
  const superadmin = profil?.role === 'superadmin';
  const connecte = Boolean(profil);
  const filtre = domaines ? domaines.join(',') : '';

  useEffect(() => {
    if (!connecte) return undefined;
    let minuteur = null;
    const desabonner = ecouterEvenements((evenement) => {
      const pertinent = evenement.domaine === 'resynchronisation'
        || evenement.etablissementId
        || evenement.domaine === 'donnees'
        || plateforme
        || superadmin;
      if (!pertinent) return;
      if (filtre && evenement.domaine !== 'resynchronisation' && !filtre.split(',').includes(evenement.domaine)) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        try {
          const resultat = chargerRef.current?.();
          if (resultat && typeof resultat.catch === 'function') resultat.catch(() => {});
        } catch { /* chargement en erreur : la page garde ses données */ }
      }, delai);
    });
    return () => {
      clearTimeout(minuteur);
      desabonner();
    };
  }, [connecte, plateforme, delai, superadmin, filtre]);
}
