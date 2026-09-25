// Deux cas où le message d'erreur brut du serveur n'est pas fiable :
// - Pas de réponse du tout, ou un 5xx : la passerelle (Render endormi,
//   coupure réseau) répond à la place de l'appli, pas l'appli elle-même —
//   sans ce cas, une simple mise en veille du backend s'affichait comme
//   "identifiants incorrects" à la connexion, alors que le mot de passe
//   était le bon.
// - Un 413 (payload trop volumineux) peut venir de nginx AVANT même
//   d'atteindre le backend — la page d'erreur est alors du HTML, pas le
//   JSON {erreur:...} que l'API renvoie normalement, donc
//   err.response.data.erreur est vide.
// Exception : le 503 de maintenance vient bien de l'appli elle-même (champ
// `maintenance`), et son message est justement celui à montrer.
export function messageErreur(err, messageParDefaut) {
  if (err.response?.data?.maintenance) {
    return err.response.data.erreur;
  }
  if (!err.response || err.response.status >= 500) {
    return 'Impossible de joindre le serveur, réessaie dans quelques secondes.';
  }
  if (err.response.status === 413) {
    return 'fichier trop volumineux, réduis-le et réessaie';
  }
  return err.response.data?.erreur || messageParDefaut;
}
