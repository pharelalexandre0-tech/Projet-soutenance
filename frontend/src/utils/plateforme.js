// Libellés partagés entre l'espace Superadmin (qui pilote la plateforme) et
// les espaces des écoles (qui en voient l'effet : nouveautés, annonce...).

export const LIBELLES_ESPACES = {
  academie: 'Académie',
  finance: 'Finance',
  etudiant: 'Étudiants',
  parent: 'Parents',
  professeur: 'Professeurs',
};

// Ordre d'affichage des cases "Espaces qui la verront" d'une note de version.
export const ESPACES_NOTES = ['academie', 'finance', 'etudiant', 'parent'];

export const TYPES_MISE_A_JOUR = {
  nouveaute: { libelle: 'Nouveauté', badge: 'vert' },
  amelioration: { libelle: 'Amélioration', badge: 'bleu' },
  correctif: { libelle: 'Correctif', badge: 'or' },
};

export function dateCourte(valeur) {
  return new Date(valeur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateHeure(valeur) {
  return new Date(valeur).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "il y a 3 h", "il y a 2 j" : pour dire depuis quand quelque chose tourne
// (serveur, maintenance) sans obliger à faire le calcul de tête.
export function depuis(valeur) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(valeur).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} j`;
}

// Valeur d'un <input type="datetime-local"> (heure locale, sans fuseau)
// vers une date ISO, et inversement.
export function versIso(valeurLocale) {
  return valeurLocale ? new Date(valeurLocale).toISOString() : null;
}
export function versLocale(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
