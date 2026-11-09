// Envoi des saisies gardées hors ligne : au retour du réseau, au démarrage
// et toutes les 30 secondes tant qu'il en reste. Chaque saisie part avec sa
// clé d'origine (aucun doublon côté serveur). Une saisie refusée par le
// serveur (note verrouillée, lien expiré...) reste visible avec la raison.
import client from './client';
import { estErreurReseau, estHorsLigne, listerAttente, retirerAttente, marquerRejet } from './horsLigne';

let enCours = false;

export async function envoyerSaisiesEnAttente() {
  if (enCours || estHorsLigne()) return { envoyees: 0 };
  enCours = true;
  let envoyees = 0;
  try {
    for (const fiche of await listerAttente()) {
      if (fiche.rejet) continue;
      try {
        await client.request({ method: fiche.methode, url: fiche.url, data: fiche.corps, headers: { 'X-Idempotence': fiche.id }, rejeu: true });
        await retirerAttente(fiche.id);
        envoyees += 1;
      } catch (err) {
        if (estErreurReseau(err)) break;
        await marquerRejet(fiche, err.response?.data?.erreur || 'saisie refusée par le serveur');
      }
    }
  } finally {
    enCours = false;
  }
  if (envoyees && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('edusphere:saisies-envoyees', { detail: { envoyees } }));
  return { envoyees };
}

if (typeof window !== 'undefined') {
  window.addEventListener('edusphere:reseau-retabli', () => { envoyerSaisiesEnAttente(); });
  window.addEventListener('online', () => { setTimeout(envoyerSaisiesEnAttente, 1500); });
  setInterval(async () => {
    if (estHorsLigne() || document.hidden) return;
    const liste = await listerAttente();
    if (liste.some((f) => !f.rejet)) envoyerSaisiesEnAttente();
  }, 30000);
  setTimeout(envoyerSaisiesEnAttente, 4000);
}
