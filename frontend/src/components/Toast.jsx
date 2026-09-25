import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Notification transitoire en bas d'écran — remplace les alert() natifs
// pour les confirmations rapides ("relance envoyée", etc.). Rendue dans
// <body>, pour la même raison que Modal : jamais enfermée dans une carte.
export default function Toast({ message, type = 'succes', onFermer, duree = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onFermer, duree);
    return () => clearTimeout(t);
  }, [onFermer, duree]);

  return createPortal(
    <div className={`toast toast-${type}`} role="status">
      {message}
    </div>,
    document.body
  );
}
