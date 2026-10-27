const crypto = require('crypto');

// Sauvegardes chiffrées (npm run backup / npm run restore) : AES-256-GCM,
// clé tirée de la phrase secrète CLE_SAUVEGARDE par scrypt (sel aléatoire
// propre à chaque fichier). Sans la phrase, le fichier est illisible ; une
// seule modification d'octet le rend impossible à restaurer (tag GCM).
const ENTETE = Buffer.from('EDUSPHERE-SAUVEGARDE-CHIFFREE-1\n');
const PARAMETRES_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function chiffrerSauvegarde(texte, phrase) {
  const sel = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cle = crypto.scryptSync(phrase, sel, 32, PARAMETRES_SCRYPT);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const corps = Buffer.concat([chiffreur.update(texte, 'utf8'), chiffreur.final()]);
  return Buffer.concat([ENTETE, sel, iv, chiffreur.getAuthTag(), corps]);
}

const estChiffree = (contenu) => contenu.subarray(0, ENTETE.length).equals(ENTETE);

function dechiffrerSauvegarde(contenu, phrase) {
  let i = ENTETE.length;
  const sel = contenu.subarray(i, (i += 16));
  const iv = contenu.subarray(i, (i += 12));
  const tag = contenu.subarray(i, (i += 16));
  const cle = crypto.scryptSync(phrase, sel, 32, PARAMETRES_SCRYPT);
  const dechiffreur = crypto.createDecipheriv('aes-256-gcm', cle, iv);
  dechiffreur.setAuthTag(tag);
  try {
    return Buffer.concat([dechiffreur.update(contenu.subarray(i)), dechiffreur.final()]).toString('utf8');
  } catch {
    throw new Error('phrase secrète incorrecte ou fichier de sauvegarde altéré');
  }
}

module.exports = { chiffrerSauvegarde, dechiffrerSauvegarde, estChiffree };
