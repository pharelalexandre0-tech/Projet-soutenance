const crypto = require('crypto');

// Chiffrement applicatif (AES-256-GCM) des valeurs sensibles conservées en
// base : clé privée de signature des documents, secrets de double
// authentification. Une copie volée de la base ne suffit pas à les lire.
//
// Clé maîtresse : CLE_CHIFFREMENT si l'hébergeur la fournit (32 octets en
// base64, ou n'importe quelle phrase longue), sinon dérivée de JWT_SECRET
// par HKDF avec un contexte propre, pour ne jamais réutiliser telle quelle
// la clé des sessions.
const PREFIXE = 'v1:';
let cleMaitreCache = null;

function cleMaitre() {
  if (cleMaitreCache) return cleMaitreCache;
  const fournie = process.env.CLE_CHIFFREMENT;
  if (fournie) {
    const brute = Buffer.from(fournie, 'base64');
    cleMaitreCache = brute.length === 32 ? brute : crypto.createHash('sha256').update(fournie).digest();
  } else {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET ou CLE_CHIFFREMENT requis pour le chiffrement');
    cleMaitreCache = Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, 'edusphere', 'chiffrement-donnees-v1', 32));
  }
  return cleMaitreCache;
}

function chiffrer(texte) {
  if (texte == null) return texte;
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cleMaitre(), iv);
  const corps = Buffer.concat([chiffreur.update(String(texte), 'utf8'), chiffreur.final()]);
  return PREFIXE + Buffer.concat([iv, chiffreur.getAuthTag(), corps]).toString('base64');
}

// Une valeur enregistrée avant le chiffrement (sans préfixe) est rendue
// telle quelle : la migration se fait au fil des écritures.
function dechiffrer(valeur) {
  if (valeur == null || !String(valeur).startsWith(PREFIXE)) return valeur;
  const brut = Buffer.from(String(valeur).slice(PREFIXE.length), 'base64');
  const dechiffreur = crypto.createDecipheriv('aes-256-gcm', cleMaitre(), brut.subarray(0, 12));
  dechiffreur.setAuthTag(brut.subarray(12, 28));
  return Buffer.concat([dechiffreur.update(brut.subarray(28)), dechiffreur.final()]).toString('utf8');
}

const estChiffre = (valeur) => valeur != null && String(valeur).startsWith(PREFIXE);

// Empreinte SHA-256 en hexadécimal.
const sha256 = (donnee) => crypto.createHash('sha256').update(donnee).digest('hex');

module.exports = { chiffrer, dechiffrer, estChiffre, sha256 };
