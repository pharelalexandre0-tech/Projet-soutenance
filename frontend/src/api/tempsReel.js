// Connexion unique au flux d'événements du serveur (/api/evenements), tant
// qu'au moins une page l'écoute. fetch plutôt qu'EventSource : le jeton part
// dans l'en-tête Authorization, jamais dans l'adresse. Coupure (réseau,
// réveil du serveur, redéploiement) : nouvel essai avec un délai croissant,
// puis un événement « resynchronisation » pour que chaque page recharge ce
// qu'elle a pu manquer.

const DELAI_MIN_MS = 2000;
const DELAI_MAX_MS = 30000;

const ecouteurs = new Set();
let controleur = null;
let minuteurRelance = null;
let delai = DELAI_MIN_MS;
let dejaConnecte = false;

function diffuser(evenement) {
  ecouteurs.forEach((ecouteur) => {
    try { ecouteur(evenement); } catch { /* une page en erreur ne bloque pas les autres */ }
  });
}

function programmerRelance() {
  if (minuteurRelance || ecouteurs.size === 0) return;
  minuteurRelance = setTimeout(() => {
    minuteurRelance = null;
    ouvrir();
  }, delai);
  delai = Math.min(delai * 2, DELAI_MAX_MS);
}

async function ouvrir() {
  const jeton = sessionStorage.getItem('pgs_token');
  if (!jeton || controleur) return;
  const courant = new AbortController();
  controleur = courant;
  try {
    const reponse = await fetch('/api/evenements', {
      headers: { Authorization: `Bearer ${jeton}`, Accept: 'text/event-stream' },
      signal: courant.signal,
      cache: 'no-store',
    });
    if (!reponse.ok || !reponse.body) throw new Error(`flux indisponible (${reponse.status})`);
    delai = DELAI_MIN_MS;
    if (dejaConnecte) diffuser({ domaine: 'resynchronisation', etablissementId: null });
    dejaConnecte = true;

    const lecteur = reponse.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = '';
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      let fin = tampon.indexOf('\n\n');
      while (fin !== -1) {
        const bloc = tampon.slice(0, fin);
        tampon = tampon.slice(fin + 2);
        const donnees = bloc.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
        if (donnees) {
          try { diffuser(JSON.parse(donnees)); } catch { /* message illisible : ignoré */ }
        }
        fin = tampon.indexOf('\n\n');
      }
    }
  } catch {
    // Coupure ou fermeture volontaire : traitée ci-dessous.
  } finally {
    if (controleur === courant) controleur = null;
    if (!courant.signal.aborted) programmerRelance();
  }
}

function fermer() {
  clearTimeout(minuteurRelance);
  minuteurRelance = null;
  if (controleur) controleur.abort();
  controleur = null;
  dejaConnecte = false;
  delai = DELAI_MIN_MS;
}

// Écoute les événements du serveur ; renvoie la fonction de désabonnement.
export function ecouterEvenements(ecouteur) {
  ecouteurs.add(ecouteur);
  if (!controleur && !minuteurRelance) ouvrir();
  return () => {
    ecouteurs.delete(ecouteur);
    if (ecouteurs.size === 0) fermer();
  };
}

// Déconnexion (ou changement de compte) : le flux de l'ancienne session se
// ferme, le prochain abonnement rouvrira avec le nouveau jeton.
export function reinitialiserFlux() {
  fermer();
  if (ecouteurs.size > 0) ouvrir();
}
