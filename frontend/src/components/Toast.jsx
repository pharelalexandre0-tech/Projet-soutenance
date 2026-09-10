import { useEffect } from 'react';

// Notification transitoire en bas d'écran — remplace les alert() natifs
// pour les confirmations rapides ("relance envoyée", etc.).
export default function Toast({ message, type = 'succes', onFermer, duree = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onFermer, duree);
    return () => clearTimeout(t);
  }, [onFermer, duree]);

  return (
    <div className={`toast toast-${type}`} role="status">
      {message}
    </div>
  );
}
