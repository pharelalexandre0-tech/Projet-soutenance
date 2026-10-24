const zlib = require('zlib');

// Archive ZIP minimale (sans dépendance) : fichiers compressés « deflate »,
// noms en UTF-8. Suffit pour l'archive de sortie d'une école, que tout
// système ouvre (Windows, macOS, Android, Excel pour les CSV qu'elle contient).

const TABLE_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(tampon) {
  let c = 0xffffffff;
  for (let i = 0; i < tampon.length; i++) c = TABLE_CRC[(c ^ tampon[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dateDos(date) {
  const heure = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const jour = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { heure, jour };
}

// fichiers : [{ nom: 'dossier/fichier.csv', contenu: Buffer | string }]
function creerZip(fichiers) {
  const morceaux = [];
  const central = [];
  let position = 0;
  const { heure, jour } = dateDos(new Date());

  for (const fichier of fichiers) {
    const nom = Buffer.from(fichier.nom, 'utf8');
    const donnees = Buffer.isBuffer(fichier.contenu) ? fichier.contenu : Buffer.from(String(fichier.contenu), 'utf8');
    const compresse = zlib.deflateRawSync(donnees, { level: 6 });
    const crc = crc32(donnees);

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4); // version requise
    entete.writeUInt16LE(0x0800, 6); // noms en UTF-8
    entete.writeUInt16LE(8, 8); // deflate
    entete.writeUInt16LE(heure, 10);
    entete.writeUInt16LE(jour, 12);
    entete.writeUInt32LE(crc, 14);
    entete.writeUInt32LE(compresse.length, 18);
    entete.writeUInt32LE(donnees.length, 22);
    entete.writeUInt16LE(nom.length, 26);
    entete.writeUInt16LE(0, 28);
    morceaux.push(entete, nom, compresse);

    const repertoire = Buffer.alloc(46);
    repertoire.writeUInt32LE(0x02014b50, 0);
    repertoire.writeUInt16LE(20, 4);
    repertoire.writeUInt16LE(20, 6);
    repertoire.writeUInt16LE(0x0800, 8);
    repertoire.writeUInt16LE(8, 10);
    repertoire.writeUInt16LE(heure, 12);
    repertoire.writeUInt16LE(jour, 14);
    repertoire.writeUInt32LE(crc, 16);
    repertoire.writeUInt32LE(compresse.length, 20);
    repertoire.writeUInt32LE(donnees.length, 24);
    repertoire.writeUInt16LE(nom.length, 28);
    repertoire.writeUInt32LE(position, 42);
    central.push(repertoire, nom);

    position += entete.length + nom.length + compresse.length;
  }

  const tailleCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...morceaux, ...central, fin]);
}

module.exports = { creerZip };
