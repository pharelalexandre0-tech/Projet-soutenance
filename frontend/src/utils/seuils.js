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
