const crypto = require('crypto');
const { chiffrer, dechiffrer, sha256 } = require('../utils/chiffrement');
const { lienVerification } = require('../utils/liens');

// Certification des documents officiels : code de vérification aléatoire,
// signature Ed25519 de la plateforme sur le contenu, empreinte des fichiers.
//
// Déroulé pour un document :
//   1. certifier()  avant le dessin : réutilise le code de la version en
//      vigueur si le contenu n'a pas changé (un bulletin retéléchargé garde
//      son code), sinon émet un nouveau code et marque l'ancien « remplacé » ;
//   2. le PDF imprime le code et le QR code (pdfService.sceauVerification) ;
//   3. sceller() après le rendu : ajoute l'empreinte SHA-256 du fichier.

// Alphabet de Crockford : sans I, L, O, U, rien qui se confonde à la saisie.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PARAMETRE_CLE = 'cle_signature_documents';
const MAX_EMPREINTES = 30;

function genererCode() {
  const octets = crypto.randomBytes(12);
  const brut = Array.from(octets, (o) => ALPHABET[o & 31]).join('');
  return `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8, 12)}`;
}

// Code saisi à la main : majuscules, tirets remis, O/I/L corrigés.
function normaliserCode(saisi) {
  const brut = String(saisi || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (brut.length !== 12 || [...brut].some((c) => !ALPHABET.includes(c))) return null;
  return `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8, 12)}`;
}

// Paire de clés Ed25519 de la plateforme. CLE_SIGNATURE_DOCUMENTS (clé
// privée PKCS8 en base64) si l'hébergeur la fournit ; sinon générée une fois
// et conservée chiffrée dans parametres_plateforme.
let clesCache = null;
async function cles() {
  if (clesCache) return clesCache;
  if (process.env.CLE_SIGNATURE_DOCUMENTS) {
    const privee = crypto.createPrivateKey({ key: Buffer.from(process.env.CLE_SIGNATURE_DOCUMENTS, 'base64'), format: 'der', type: 'pkcs8' });
    clesCache = { privee, publique: crypto.createPublicKey(privee) };
    return clesCache;
  }
  const { ParametrePlateforme } = require('../models');
  let ligne = await ParametrePlateforme.findByPk(PARAMETRE_CLE);
  if (!ligne) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publique = crypto.createPublicKey(privateKey).export({ format: 'pem', type: 'spki' });
    [ligne] = await ParametrePlateforme.findOrCreate({
      where: { cle: PARAMETRE_CLE },
      defaults: { valeur: { privee: chiffrer(pem), publique, creeLe: new Date().toISOString() } },
    });
  }
  const privee = crypto.createPrivateKey(dechiffrer(ligne.valeur.privee));
  clesCache = { privee, publique: crypto.createPublicKey(privee) };
  return clesCache;
}

async function clePubliquePem() {
  return (await cles()).publique.export({ format: 'pem', type: 'spki' });
}

// Texte exact signé : toute modification d'un champ certifié invalide la
// signature.
function messageSigne(c) {
  return JSON.stringify({
    v: 1,
    code: c.code,
    type: c.typeDocument,
    etablissement: c.etablissementId ?? null,
    titre: c.titre,
    titulaire: c.titulaire ?? null,
    // Les informations affichées à la vérification sont signées telles
    // quelles : les modifier en base invalide la signature.
    elements: c.elements || [],
    contenu: c.empreinteContenu,
    emisLe: new Date(c.emisLe).toISOString(),
  });
}

async function signer(c) {
  return crypto.sign(null, Buffer.from(messageSigne(c)), (await cles()).privee).toString('base64');
}

async function signatureValide(c) {
  try {
    return crypto.verify(null, Buffer.from(messageSigne(c)), (await cles()).publique, Buffer.from(c.signature, 'base64'));
  } catch {
    return false;
  }
}

// `elements` : [[libellé, valeur]] montrés à la vérification ; `donnees` :
// contenu complet (créneaux, lignes du PV...) couvert par l'empreinte sans
// être affiché.
async function certifier({ cle, type, etablissement, titre, titulaire = null, elements = [], donnees = null, emisParId = null }) {
  const { CertificationDocument } = require('../models');
  const elementsPropres = elements.filter(([, v]) => v != null && v !== '').map(([l, v]) => [String(l), String(v)]);
  const empreinteContenu = sha256(JSON.stringify({ titre, titulaire, elements: elementsPropres, donnees }));
  const enVigueur = await CertificationDocument.findOne({ where: { cle, statut: 'valide' }, order: [['emisLe', 'DESC']] });
  if (enVigueur && enVigueur.empreinteContenu === empreinteContenu) return enVigueur;

  const maintenant = new Date();
  const champs = {
    code: genererCode(),
    cle,
    typeDocument: type,
    etablissementId: etablissement?.id ?? null,
    titre: String(titre).slice(0, 200),
    titulaire: titulaire ? String(titulaire).slice(0, 160) : null,
    elements: elementsPropres,
    empreinteContenu,
    emisLe: maintenant,
    emisParId,
  };
  champs.signature = await signer(champs);
  const certification = await CertificationDocument.create(champs);
  if (enVigueur) await enVigueur.update({ statut: 'remplace', remplaceLe: maintenant });
  return certification;
}

async function sceller(certification, contenuPdf) {
  if (!certification || !contenuPdf) return;
  const empreinte = sha256(contenuPdf);
  const empreintes = certification.empreintes || [];
  if (empreintes.includes(empreinte)) return;
  await certification.update({ empreintes: [...empreintes, empreinte].slice(-MAX_EMPREINTES) });
}

// Lien imprimé dans le QR code.
const urlVerification = (certification) => lienVerification(certification.code);

module.exports = { certifier, sceller, normaliserCode, signatureValide, clePubliquePem, urlVerification, genererCode, ALPHABET };
