// xlsx est une grosse bibliothèque (~400 Ko gzippés) qui ne sert qu'à
// l'import Excel/CSV — un enseignant sur mille l'utilise dans une
// session donnée. Importée en dur, elle partait dans le bundle principal
// de tout le monde ; chargée à la demande ici, elle n'est téléchargée
// que par qui clique réellement sur "Importer".
let xlsxPromise;
function chargerXLSX() {
  if (!xlsxPromise) {
    xlsxPromise = Promise.all([
      import('xlsx'),
      // Sans ça, XLSX.read({ codepage: ... }) fonctionne quand même pour
      // l'UTF-8 mais log une erreur "Codepage tables are not loaded" à
      // chaque fichier importé.
      import('xlsx/dist/cpexcel.full.mjs'),
    ]).then(([XLSX, cptable]) => {
      XLSX.set_cptable(cptable);
      return XLSX;
    });
  }
  return xlsxPromise;
}

// Un enseignant qui exporte sa liste depuis un tableur n'utilisera jamais
// exactement "prenom"/"nom" sans accent ni majuscule — on normalise les
// en-têtes (accents, casse, espaces) pour retrouver "Prénom", "PRENOM " ou
// "Prénom élève" de la même façon.
function normaliserCle(cle) {
  return cle
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normaliserTexte(texte) {
  return (texte ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Lit la première feuille d'un .xlsx/.xls/.csv et renvoie un tableau
// d'objets dont les clés sont normalisées (cf. normaliserCle) — chaque
// appelant sait alors chercher ligne.prenom / ligne.email sans se soucier
// de la façon dont le fichier d'origine a nommé ses colonnes.
export async function lireFichierExcel(fichier) {
  const XLSX = await chargerXLSX();
  const tampon = await fichier.arrayBuffer();
  // codepage 65001 (UTF-8) : sans lui, un .csv sans BOM voit ses accents
  // corrompus ("Prénom" -> "PrÃ©nom") — un .xlsx/.xls binaire n'est pas
  // concerné (son encodage est déclaré dans le fichier), seul le texte
  // brut d'un CSV en profite.
  const classeur = XLSX.read(tampon, { type: 'array', codepage: 65001 });
  const feuille = classeur.Sheets[classeur.SheetNames[0]];
  const lignes = XLSX.utils.sheet_to_json(feuille, { defval: '' });
  return lignes.map((ligne) => {
    const normalisee = {};
    for (const [cle, valeur] of Object.entries(ligne)) {
      normalisee[normaliserCle(cle)] = typeof valeur === 'string' ? valeur.trim() : valeur;
    }
    return normalisee;
  });
}

export function motDePasseAleatoire() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let mot = '';
  for (let i = 0; i < 10; i += 1) mot += alphabet[Math.floor(Math.random() * alphabet.length)];
  return mot;
}
