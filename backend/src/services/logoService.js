const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

// Même préparation que l'interface applique à l'envoi d'un logo
// (components/ChampLogo.jsx) : marges vides ou blanches rognées, image
// centrée dans un carré transparent, 512 px au plus, en PNG. Sert aux logos
// enregistrés avant cette préparation, pour qu'ils remplissent eux aussi
// leur emplacement (menu, e-mails, PDF) sans être écrasés ni minuscules.
const COTE_MAX = 512;
const MARGE = 1.08;

function decoder(dataUri) {
  const m = String(dataUri || '').match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!m) return null;
  const tampon = Buffer.from(m[2], 'base64');
  if (m[1] === 'png') {
    const png = PNG.sync.read(tampon);
    return { largeur: png.width, hauteur: png.height, pixels: png.data };
  }
  if (m[1] === 'jpeg' || m[1] === 'jpg') {
    const img = jpeg.decode(tampon, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
    return { largeur: img.width, hauteur: img.height, pixels: img.data };
  }
  return null; // WebP : pas de décodeur pur JavaScript, laissé tel quel
}

function estVide(p, i) {
  return p[i + 3] < 16 || (p[i] > 245 && p[i + 1] > 245 && p[i + 2] > 245);
}

// Réduction par moyenne des pixels couverts (nette, sans crénelage).
function echantillonner(src, sl, x0, y0, largeur, hauteur, dest, dl, ox, oy, dw, dh) {
  const rx = largeur / dw;
  const ry = hauteur / dh;
  for (let y = 0; y < dh; y += 1) {
    const ya = y0 + y * ry;
    const yb = Math.min(y0 + hauteur, ya + Math.max(ry, 1));
    for (let x = 0; x < dw; x += 1) {
      const xa = x0 + x * rx;
      const xb = Math.min(x0 + largeur, xa + Math.max(rx, 1));
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let sy = Math.floor(ya); sy < Math.ceil(yb); sy += 1) {
        for (let sx = Math.floor(xa); sx < Math.ceil(xb); sx += 1) {
          const i = (sy * sl + sx) * 4;
          const alpha = src[i + 3];
          r += src[i] * alpha; g += src[i + 1] * alpha; b += src[i + 2] * alpha; a += alpha; n += 1;
        }
      }
      const j = ((oy + y) * dl + (ox + x)) * 4;
      if (a > 0) {
        dest[j] = Math.round(r / a); dest[j + 1] = Math.round(g / a); dest[j + 2] = Math.round(b / a);
      }
      dest[j + 3] = n ? Math.round(a / n) : 0;
    }
  }
}

// Renvoie le logo préparé (data URI PNG), ou null s'il n'y a rien à faire.
function normaliserLogo(dataUri) {
  const image = decoder(dataUri);
  if (!image) return null;
  const { largeur: l, hauteur: h, pixels: p } = image;
  let x0 = l; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < l; x += 1) {
      if (!estVide(p, (y * l + x) * 4)) {
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
  const cote = Math.round(Math.max(largeur, hauteur) * MARGE);
  // Déjà préparé : carré, marges proches de celles attendues, bonne taille.
  if (l === h && l <= COTE_MAX && Math.abs(cote * Math.min(1, COTE_MAX / cote) - l) <= Math.max(3, l * 0.04)) return null;

  const echelle = Math.min(1, COTE_MAX / cote);
  const dl = Math.max(1, Math.round(cote * echelle));
  const dw = Math.max(1, Math.round(largeur * echelle));
  const dh = Math.max(1, Math.round(hauteur * echelle));
  const sortie = new PNG({ width: dl, height: dl });
  sortie.data.fill(0);
  echantillonner(p, l, x0, y0, largeur, hauteur, sortie.data, dl, Math.floor((dl - dw) / 2), Math.floor((dl - dh) / 2), dw, dh);
  return `data:image/png;base64,${PNG.sync.write(sortie).toString('base64')}`;
}

// Version réduite (PNG, carré de `cote` px) d'un logo déjà préparé : les
// e-mails n'ont besoin que de 128 px (affiché en 64 px, net sur écran haute
// densité), pas des 512 px enregistrés.
function redimensionnerLogo(dataUri, cote) {
  const image = decoder(dataUri);
  if (!image) return null;
  const { largeur: l, hauteur: h, pixels: p } = image;
  const echelle = Math.min(1, cote / Math.max(l, h));
  const dw = Math.max(1, Math.round(l * echelle));
  const dh = Math.max(1, Math.round(h * echelle));
  const dl = Math.max(dw, dh);
  const sortie = new PNG({ width: dl, height: dl });
  sortie.data.fill(0);
  echantillonner(p, l, 0, 0, l, h, sortie.data, dl, Math.floor((dl - dw) / 2), Math.floor((dl - dh) / 2), dw, dh);
  return PNG.sync.write(sortie);
}

// Au démarrage : prépare les logos d'écoles enregistrés avant cette règle.
async function normaliserLogosEnregistres() {
  const { Etablissement } = require('../models');
  const ecoles = await Etablissement.findAll({ attributes: ['id', 'logo'] });
  let prepares = 0;
  for (const ecole of ecoles) {
    if (!ecole.logo) continue;
    try {
      const nouveau = normaliserLogo(ecole.logo);
      if (nouveau) {
        await Etablissement.update({ logo: nouveau }, { where: { id: ecole.id } });
        prepares += 1;
      }
    } catch (err) {
      console.error(`[Logo] École ${ecole.id} : logo laissé tel quel (${err.message}).`);
    }
  }
  if (prepares) console.log(`[Logo] ${prepares} logo(s) d'école préparé(s) (rognés, centrés, 512 px).`);
}

// Photo de profil : PNG ou JPEG uniquement (vérifié sur les octets, pas sur
// le nom), recadrée au centre en carré, réduite à 256 px, fond blanc sous la
// transparence, réencodée en JPEG. Renvoie null si l'image est refusée.
const COTE_PHOTO = 256;
function preparerPhoto(dataUri) {
  const m = String(dataUri || '').match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const tampon = Buffer.from(m[2], 'base64');
  const estPng = tampon.length > 8 && tampon.readUInt32BE(0) === 0x89504e47;
  const estJpeg = tampon.length > 3 && tampon[0] === 0xff && tampon[1] === 0xd8 && tampon[2] === 0xff;
  if (!estPng && !estJpeg) return null;
  let image;
  try {
    image = decoder(`data:image/${estPng ? 'png' : 'jpeg'};base64,${m[2]}`);
  } catch {
    return null;
  }
  if (!image || image.largeur < 64 || image.hauteur < 64) return null;
  const { largeur: l, hauteur: h, pixels: p } = image;
  const cote = Math.min(l, h);
  const dl = Math.min(COTE_PHOTO, cote);
  const sortie = new Uint8Array(dl * dl * 4);
  echantillonner(p, l, Math.floor((l - cote) / 2), Math.floor((h - cote) / 2), cote, cote, sortie, dl, 0, 0, dl, dl);
  for (let i = 0; i < sortie.length; i += 4) {
    const a = sortie[i + 3] / 255;
    sortie[i] = Math.round(sortie[i] * a + 255 * (1 - a));
    sortie[i + 1] = Math.round(sortie[i + 1] * a + 255 * (1 - a));
    sortie[i + 2] = Math.round(sortie[i + 2] * a + 255 * (1 - a));
    sortie[i + 3] = 255;
  }
  const jpg = jpeg.encode({ data: sortie, width: dl, height: dl }, 85);
  return `data:image/jpeg;base64,${Buffer.from(jpg.data).toString('base64')}`;
}

module.exports = { normaliserLogo, normaliserLogosEnregistres, redimensionnerLogo, preparerPhoto };
