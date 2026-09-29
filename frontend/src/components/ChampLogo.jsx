import { useRef, useState } from 'react';

const TAILLE_LOGO_MAX = 5 * 1024 * 1024;
const COTE_LOGO = 512;

// Prépare le logo une fois pour toutes, pour qu'il remplisse bien chaque
// emplacement (menu, e-mails, PDF) : marges vides ou blanches rognées,
// image centrée dans un carré transparent, 512 px au plus, en PNG (lu par
// toutes les messageries et par le générateur de PDF).
function normaliserLogo(source) {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => {
      const l = image.naturalWidth;
      const h = image.naturalHeight;
      const toile = document.createElement('canvas');
      toile.width = l;
      toile.height = h;
      const ctx = toile.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, l, h);
      let x0 = l; let y0 = h; let x1 = -1; let y1 = -1;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < l; x += 1) {
          const i = (y * l + x) * 4;
          const vide = data[i + 3] < 16 || (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245);
          if (!vide) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = l - 1; y1 = h - 1; }
      const largeur = x1 - x0 + 1;
      const hauteur = y1 - y0 + 1;
      const cote = Math.round(Math.max(largeur, hauteur) * 1.08);
      const echelle = Math.min(1, COTE_LOGO / cote);
      const final = document.createElement('canvas');
      final.width = Math.max(1, Math.round(cote * echelle));
      final.height = final.width;
      const fctx = final.getContext('2d');
      fctx.imageSmoothingQuality = 'high';
      const dl = largeur * echelle;
      const dh = hauteur * echelle;
      fctx.drawImage(toile, x0, y0, largeur, hauteur, (final.width - dl) / 2, (final.height - dh) / 2, dl, dh);
      resoudre(final.toDataURL('image/png'));
    };
    image.onerror = () => rejeter(new Error('image illisible'));
    image.src = source;
  });
}

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
      setErreur('le logo doit faire moins de 5 Mo');
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => {
      normaliserLogo(lecteur.result)
        .then(onChange)
        .catch(() => setErreur("impossible de lire cette image, essaie un autre fichier"));
    };
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
        : <p className="note-secondaire" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.76rem' }}>PNG, JPEG ou WebP. Les marges vides sont rognées et le logo est centré automatiquement.</p>}
    </div>
  );
}
