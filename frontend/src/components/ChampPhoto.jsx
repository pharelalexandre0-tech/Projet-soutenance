import { useRef, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { messageErreur } from '../utils/erreurs';
import { IconUpload, IconTrash } from './icons';

const FORMATS = ['image/png', 'image/jpeg'];
const TAILLE_MAX = 8 * 1024 * 1024;
const COTE = 512;

function initiales(prenom, nom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

// Photo (ou initiales) du compte : utilisée dans l'en-tête, le menu du
// compte et le profil.
export function Avatar({ profil, className = '' }) {
  return (
    <span className={`avatar-compte ${className}`} aria-hidden="true">
      {profil?.photo && !profil.modeParent ? <img src={profil.photo} alt="" /> : initiales(profil?.prenom, profil?.nom)}
    </span>
  );
}

// Lecture de l'image choisie, recadrée au centre en carré et réduite dans le
// navigateur (envoi léger), puis préparée à nouveau par le serveur.
function preparer(fichier) {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      const cote = Math.min(image.naturalWidth, image.naturalHeight);
      if (cote < 64) { URL.revokeObjectURL(url); rejeter(new Error('image trop petite (64 × 64 pixels au moins)')); return; }
      const sortie = Math.min(COTE, cote);
      const toile = document.createElement('canvas');
      toile.width = sortie;
      toile.height = sortie;
      const ctx = toile.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, sortie, sortie);
      ctx.drawImage(image, (image.naturalWidth - cote) / 2, (image.naturalHeight - cote) / 2, cote, cote, 0, 0, sortie, sortie);
      URL.revokeObjectURL(url);
      resoudre(toile.toDataURL('image/jpeg', 0.9));
    };
    image.onerror = () => { URL.revokeObjectURL(url); rejeter(new Error('image illisible')); };
    image.src = url;
  });
}

// Choix de la photo de profil : PNG ou JPEG, 8 Mo au plus, recadrée en
// carré. Le parent connecté sur le compte de son enfant ne la modifie pas.
export default function ChampPhoto() {
  const { profil, mettreAJourProfil } = useAuth();
  const champ = useRef(null);
  const [etat, setEtat] = useState('');
  const [erreur, setErreur] = useState('');
  if (!profil || profil.modeParent) return null;

  async function choisir(fichier) {
    if (!fichier) return;
    setErreur('');
    if (!FORMATS.includes(fichier.type)) { setErreur('Format refusé : choisissez une photo PNG ou JPEG.'); return; }
    if (fichier.size > TAILLE_MAX) { setErreur('Photo trop lourde : 8 Mo au plus.'); return; }
    setEtat('envoi');
    try {
      const image = await preparer(fichier);
      const res = await client.put('/auth/photo', { image });
      mettreAJourProfil(res.data.profil);
    } catch (e) {
      setErreur(e.response ? messageErreur(e, 'photo refusée') : `${e.message.charAt(0).toUpperCase()}${e.message.slice(1)}.`);
    } finally {
      setEtat('');
      if (champ.current) champ.current.value = '';
    }
  }

  async function retirer() {
    setEtat('retrait');
    try {
      mettreAJourProfil((await client.delete('/auth/photo')).data.profil);
    } catch (e) {
      setErreur(messageErreur(e, 'retrait impossible'));
    } finally {
      setEtat('');
    }
  }

  return (
    <div className="champ-photo">
      <Avatar profil={profil} className="grand" />
      <div className="champ-photo-texte">
        <strong>Photo de profil</strong>
        <small>PNG ou JPEG, 8 Mo au plus. Elle est recadrée en carré et réduite automatiquement.</small>
        <div className="champ-photo-actions">
          <button type="button" className="secondaire petit" disabled={Boolean(etat)} onClick={() => champ.current?.click()}>
            <IconUpload /> {etat === 'envoi' ? 'Envoi…' : profil.photo ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {profil.photo && <button type="button" className="secondaire petit danger" disabled={Boolean(etat)} onClick={retirer}><IconTrash /> Retirer</button>}
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
      </div>
      <input ref={champ} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => choisir(e.target.files?.[0])} />
    </div>
  );
}
