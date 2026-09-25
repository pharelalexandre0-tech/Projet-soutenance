// Noms saisis en minuscules ("alexandre pharel") : à l'affichage, chaque
// mot prend sa majuscule, sans toucher à ce qui est enregistré.
export function nomPropre(texte) {
  return String(texte || '').trim().toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, sep, lettre) => sep + lettre.toUpperCase());
}
