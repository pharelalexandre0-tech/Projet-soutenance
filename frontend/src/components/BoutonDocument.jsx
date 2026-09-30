import { useState } from 'react';
import client, { ORIGINE_API } from '../api/client';

// Téléchargement d'un PDF de l'établissement (bulletin, reçu, fiche de paie).
// Le serveur exige la session : un simple lien ne l'enverrait pas, le fichier
// est donc demandé avec le jeton puis enregistré depuis la mémoire du navigateur.
export default function BoutonDocument({ chemin, className, style, title, children }) {
  const [etat, setEtat] = useState(''); // '' | 'chargement' | 'erreur'

  async function telecharger() {
    setEtat('chargement');
    try {
      const res = await client.get(`${ORIGINE_API}${chemin}`, { baseURL: '', responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = chemin.split('/').pop();
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setEtat('');
    } catch {
      setEtat('erreur');
    }
  }

  return (
    <button type="button" className={className} style={style} title={etat === 'erreur' ? 'Téléchargement impossible, réessayez' : title} onClick={telecharger} disabled={etat === 'chargement'}>
      {etat === 'chargement' ? 'Téléchargement…' : etat === 'erreur' ? 'Réessayer' : children}
    </button>
  );
}
