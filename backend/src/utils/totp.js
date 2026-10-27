const crypto = require('crypto');

// Codes à usage unique basés sur le temps (RFC 6238), compatibles avec
// Google Authenticator, Microsoft Authenticator, Authy, FreeOTP...
// HMAC-SHA1, pas de 30 secondes, 6 chiffres.
const PAS_S = 30;
const CHIFFRES = 6;
const ALPHABET_B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(octets) {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_B32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET_B32[(valeur << (5 - bits)) & 31];
  return sortie;
}

function depuisBase32(texte) {
  const propre = String(texte).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valeur = 0;
  const octets = [];
  for (const c of propre) {
    valeur = (valeur << 5) | ALPHABET_B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

// 160 bits, la taille recommandée pour HMAC-SHA1.
const genererSecret = () => base32(crypto.randomBytes(20));

function codeAuPas(secret, pas) {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const hmac = crypto.createHmac('sha1', depuisBase32(secret)).update(compteur).digest();
  const decalage = hmac[hmac.length - 1] & 15;
  const binaire = hmac.readUInt32BE(decalage) & 0x7fffffff;
  return String(binaire % 10 ** CHIFFRES).padStart(CHIFFRES, '0');
}

const pasActuel = (maintenant = Date.now()) => Math.floor(maintenant / 1000 / PAS_S);

// Accepte le pas courant et ses deux voisins (horloge du téléphone en
// avance ou en retard de 30 s). Un pas déjà utilisé est refusé : un code
// intercepté ne sert pas deux fois. Renvoie le pas reconnu, ou null.
function verifierCode(secret, code, dernierPasUtilise = null) {
  const saisi = String(code || '').replace(/\D/g, '');
  if (saisi.length !== CHIFFRES) return null;
  const courant = pasActuel();
  for (const pas of [courant, courant - 1, courant + 1]) {
    if (dernierPasUtilise != null && pas <= Number(dernierPasUtilise)) continue;
    const attendu = codeAuPas(secret, pas);
    if (crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(saisi))) return pas;
  }
  return null;
}

function uriOtpauth(secret, compte, emetteur = 'EduSphere') {
  const libelle = encodeURIComponent(`${emetteur}:${compte}`);
  return `otpauth://totp/${libelle}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=${CHIFFRES}&period=${PAS_S}`;
}

// Codes de secours : 10 codes XXXX-XXXX à usage unique, montrés une seule
// fois ; seule leur empreinte est conservée.
const ALPHABET_SECOURS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function genererCodesSecours(nombre = 10) {
  return Array.from({ length: nombre }, () => {
    const brut = Array.from(crypto.randomBytes(8), (o) => ALPHABET_SECOURS[o % ALPHABET_SECOURS.length]).join('');
    return `${brut.slice(0, 4)}-${brut.slice(4)}`;
  });
}
const normaliserCodeSecours = (code) => String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

module.exports = { genererSecret, verifierCode, uriOtpauth, codeAuPas, pasActuel, genererCodesSecours, normaliserCodeSecours };
