import { useState } from 'react';

const TAILLE_LOGO_MAX = 1024 * 1024;

// Réutilisé partout où l'identité d'un établissement se saisit — à la
// création d'une école (Superadmin) comme pour en modifier une déjà
// existante (Superadmin ou Académie) : même validation, même apparence,
// jamais trois copies qui finissent par diverger.
export default function ChampLogo({ valeur, onChange, label = "Logo de l'établissement" }) {
  const [erreur, setErreur] = useState('');

  function choisir(e) {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    setErreur('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(fichier.type)) {
      setErreur('format non pris en charge — PNG, JPEG ou WebP');
      return;
    }
    if (fichier.size > TAILLE_LOGO_MAX) {
      setErreur('le logo doit faire moins de 1 Mo');
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => onChange(lecteur.result);
    lecteur.readAsDataURL(fichier);
  }

  return (
    <div className="champ">
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10, border: '1px solid var(--bordure)',
          background: 'var(--gris-fond)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
        }}>
          {valeur ? (
            <img src={valeur} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span className="note-secondaire" style={{ fontSize: '0.65rem', textAlign: 'center' }}>Aucun<br />logo</span>
          )}
        </div>
        <label className="secondaire" style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
          {valeur ? 'Changer' : 'Choisir un fichier'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choisir} style={{ display: 'none' }} />
        </label>
        {valeur && (
          <button type="button" className="secondaire" style={{ padding: '7px 14px', fontSize: '0.85rem' }} onClick={() => onChange('')}>
            Retirer
          </button>
        )}
      </div>
      {erreur
        ? <p className="note-secondaire" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.76rem', color: 'var(--erreur)' }}>{erreur}</p>
        : <p className="note-secondaire" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.76rem' }}>PNG, JPEG ou WebP, 1 Mo maximum — un fond transparent (PNG) rend mieux sur les documents.</p>}
    </div>
  );
}
