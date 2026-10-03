import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import client, { ORIGINE_API } from '../api/client';

function enBase64(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1]);
    lecteur.onerror = rejeter;
    lecteur.readAsDataURL(blob);
  });
}

// Téléchargement d'un PDF de l'établissement (bulletin, reçu, fiche de paie).
// Le serveur exige la session : un simple lien ne l'enverrait pas, le fichier
// est donc demandé avec le jeton. Dans le navigateur, il est enregistré depuis
// la mémoire ; dans l'application Android, il est écrit sur le téléphone puis
// proposé à l'ouverture ou au partage (lecteur PDF, messagerie...).
export default function BoutonDocument({ chemin, className, style, title, children }) {
  const [etat, setEtat] = useState(''); // '' | 'chargement' | 'erreur'

  async function telecharger() {
    setEtat('chargement');
    try {
      const res = await client.get(`${ORIGINE_API}${chemin}`, { baseURL: '', responseType: 'blob' });
      const nom = chemin.split('/').pop();
      if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
        const fichier = await Filesystem.writeFile({ path: nom, data: await enBase64(res.data), directory: Directory.Cache });
        await Share.share({ title: nom, url: fichier.uri, dialogTitle: 'Ouvrir ou partager le document' });
      } else {
        const url = URL.createObjectURL(res.data);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = nom;
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      setEtat('');
    } catch (err) {
      // Partage fermé sans choisir d'application : ce n'est pas une erreur.
      setEtat(/cancel|annul/i.test(String(err?.message || err)) ? '' : 'erreur');
    }
  }

  return (
    <button type="button" className={className} style={style} title={etat === 'erreur' ? 'Téléchargement impossible, réessayez' : title} onClick={telecharger} disabled={etat === 'chargement'}>
      {etat === 'chargement' ? 'Téléchargement…' : etat === 'erreur' ? 'Réessayer' : children}
    </button>
  );
}
