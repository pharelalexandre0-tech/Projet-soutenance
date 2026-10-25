// Règles de validation de l'école (sur 20), réglées dans Paramètres :
// seuil pour valider (10 par défaut) et note éliminatoire (7 par défaut).
export const REGLES_PAR_DEFAUT = { seuil: 10, eliminatoire: 7 };

export function reglesEtablissement(etablissement) {
  const seuil = Number(etablissement?.seuilValidation);
  const eliminatoire = Number(etablissement?.noteEliminatoire);
  return {
    seuil: Number.isFinite(seuil) && seuil > 0 ? seuil : REGLES_PAR_DEFAUT.seuil,
    eliminatoire: Number.isFinite(eliminatoire) ? eliminatoire : REGLES_PAR_DEFAUT.eliminatoire,
  };
}

// Couleur d'une note saisie : au seuil ou au-dessus (vert), juste en
// dessous du seuil (jaune), éliminatoire (rouge). Rien si vide ou invalide.
export function tonNote(valeur, regles = REGLES_PAR_DEFAUT) {
  if (valeur === '' || valeur === undefined || valeur === null) return null;
  const n = Number(String(valeur).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 20) return null;
  if (n >= regles.seuil) return 'bonne';
  if (n >= regles.eliminatoire) return 'limite';
  return 'eliminatoire';
}

export function noteFr(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// Saisie d'une note sur 20 : chiffres, une virgule ou un point, deux
// décimales au plus, valeur de 0 à 20. Une frappe qui sortirait de ces
// bornes est refusée (le champ garde sa valeur précédente).
export function saisieNoteValide(texte) {
  const t = String(texte ?? '').trim();
  if (t === '') return true;
  if (!/^\d{1,2}([.,]\d{0,2})?$/.test(t)) return false;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 20;
}
