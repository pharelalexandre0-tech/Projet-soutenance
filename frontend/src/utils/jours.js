// Seule liste des jours de la semaine dans l'app — jamais un jour de plus
// (l'Académie ne propose que ces 6 à la création d'un créneau, aucun
// dimanche), et toujours cette casse : EmploiDuTemps.jour est stocké
// exactement comme choisi dans ce select, donc toute page qui groupe/trie
// par jour doit comparer contre ces mêmes chaînes, pas une variante
// (minuscules, ordre différent) recréée localement.
export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
