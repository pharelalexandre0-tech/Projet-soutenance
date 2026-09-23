// Liste fermée plutôt qu'un champ texte libre : évite qu'une même promotion
// se retrouve éclatée entre "L1", "Licence 1", "1ere annee"... au fil des
// saisies — la fiabilité du regroupement par niveau (Finance, statistiques)
// en dépend directement.
export const NIVEAUX = ['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat'];
