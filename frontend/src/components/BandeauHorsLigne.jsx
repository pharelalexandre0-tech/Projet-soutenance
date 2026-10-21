import { useEffect, useState } from 'react';
import { etatConnexion, suivreConnexion } from '../api/horsLigne';
import { IconHorsLigne } from './icons';

function quand(date) {
  const d = new Date(date);
  const jour = d.toDateString() === new Date().toDateString()
    ? "aujourd'hui"
    : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  return `${jour} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Pastille en bas de l'écran tant que l'appareil travaille sans réseau :
// les pages montrent la dernière copie gardée, avec sa date.
export default function BandeauHorsLigne() {
  const [etat, setEtat] = useState(etatConnexion);
  useEffect(() => suivreConnexion(setEtat), []);
  if (!etat.horsLigne) return null;
  return (
    <div className="bandeau-hors-ligne" role="status">
      <IconHorsLigne />
      <span>
        <strong>Hors ligne</strong>
        {etat.depuis ? ` · données enregistrées ${quand(etat.depuis)}` : ' · dernières données enregistrées sur cet appareil'}
      </span>
    </div>
  );
}
