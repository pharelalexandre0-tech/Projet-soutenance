// Un 413 (payload trop volumineux) peut être renvoyé par nginx AVANT même
// d'atteindre le backend — la page d'erreur est alors du HTML, pas le JSON
// {erreur:...} que l'API renvoie normalement, donc err.response.data.erreur
// est vide. Sans ce cas particulier, une image trop lourde (logo…) retombe
// sur un message générique qui ne dit jamais pourquoi ça a échoué.
export function messageErreur(err, messageParDefaut) {
  if (err.response?.status === 413) {
    return 'fichier trop volumineux — réduis-le et réessaie';
  }
  return err.response?.data?.erreur || messageParDefaut;
}
