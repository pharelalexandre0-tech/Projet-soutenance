import { useRef, useState } from 'react';

const TAILLE_LOGO_MAX = 1024 * 1024;

// Réutilisé partout où l'identité d'un établissement se saisit — à la
// création d'une école (Superadmin) comme pour en modifier une déjà
// existante (Superadmin ou Académie) : même validation, même apparence,
// jamais trois copies qui finissent par diverger.
export default function ChampLogo({ valeur, onChange, label = "Logo de l'établissement" }) {
  const [erreur, setErreur] = useState('');
  // Le déclencheur visible doit être un <button> — la classe "secondaire"
  // ne cible QUE la balise button en CSS (button.secondaire), un <label>
  // stylé pareil resterait sans bordure ni fond, comme si aucun style ne
  // s'appliquait. L'input file reste caché, ouvert via ce bouton.
  const inputRef = useRef(null);

  function choisir(e) {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    setErreur('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(fichier.type)) {
      setErreur('format non pris en charge : PNG, JPEG ou WebP');
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
        <button type="button" className="secondaire" onClick={() => inputRef.current?.click()}>
          {valeur ? 'Changer' : 'Choisir un fichier'}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={choisir} style={{ display: 'none' }} />
        {valeur && (
          <button type="button" className="secondaire" style={{ padding: '7px 14px', fontSize: '0.85rem' }} onClick={() => onChange('')}>
            Retirer
          </button>
        )}
      </div>
      {erreur
        ? <p className="note-secondaire" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.76rem', color: 'var(--erreur)' }}>{erreur}</p>
        : <p className="note-secondaire" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.76rem' }}>PNG, JPEG ou WebP, 1 Mo maximum. Un fond transparent (PNG) rend mieux sur les documents.</p>}
    </div>
  );
}
