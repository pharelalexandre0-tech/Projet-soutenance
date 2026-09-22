// Petits totaux répétés sur plusieurs tableaux de bord — un seul endroit
// pour compter "combien d'élèves au total", que la donnée soit groupée par
// classe (TableauDeBord Académie/Finance) ou par niveau puis par classe
// (Finance : Impayés, Définir les frais, qui partagent l'endpoint
// /finance/impayes/par-classe).
export function totalElevesParClasses(classes) {
  return classes.reduce((somme, c) => somme + (c.Eleves?.length ?? 0), 0);
}

export function totalElevesParNiveaux(niveaux) {
  return niveaux.reduce((somme, n) => somme + n.classes.reduce((s, c) => s + c.eleves.length, 0), 0);
}
