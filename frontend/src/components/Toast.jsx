import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconCircleCheck, IconCircleAlert } from './icons';

// Notification transitoire en bas d'écran — remplace les alert() natifs
// pour les confirmations rapides ("relance envoyée", etc.). Rendue dans
// <body>, pour la même raison que Modal : jamais enfermée dans une carte.
export default function Toast({ message, type = 'succes', onFermer, duree = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onFermer, duree);
    return () => clearTimeout(t);
  }, [onFermer, duree]);

  const Icone = type === 'erreur' ? IconCircleAlert : IconCircleCheck;
  return createPortal(
    <div className={`toast toast-${type}`} role="status">
      <Icone />
      <span>{message}</span>
    </div>,
    document.body
  );
}
