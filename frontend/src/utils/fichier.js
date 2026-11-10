import { Capacitor } from '@capacitor/core';

function enBase64(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1]);
    lecteur.onerror = rejeter;
    lecteur.readAsDataURL(blob);
  });
}

// Enregistre un fichier reçu du serveur : téléchargement dans le
// navigateur, écriture puis partage dans l'application Android.
export async function enregistrerFichier(blob, nom) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const fichier = await Filesystem.writeFile({ path: nom, data: await enBase64(blob), directory: Directory.Cache });
    await Share.share({ title: nom, url: fichier.uri, dialogTitle: 'Ouvrir ou partager le fichier' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Nom de fichier annoncé par le serveur (Content-Disposition).
export const nomDepuisEntete = (res, defaut) => ((res.headers?.['content-disposition'] || '').match(/filename="?([^";]+)"?/) || [])[1] || defaut;

// Message d'erreur d'une réponse « blob » (le JSON d'erreur arrive en blob).
export async function erreurBlob(err, defaut) {
  try {
    const texte = await err?.response?.data?.text?.();
    return JSON.parse(texte).erreur || defaut;
  } catch {
    return err?.response?.data?.erreur || defaut;
  }
}
