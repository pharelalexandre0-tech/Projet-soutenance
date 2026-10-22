// Synchronisation automatique pour le hors ligne : à chaque connexion, au
// retour du réseau, puis toutes les 15 minutes tant que le réseau est là,
// l'application relit d'elle-même toutes les données de l'espace connecté
// (pas seulement les pages déjà ouvertes). Chaque lecture passe par
// `client`, qui la garde sur l'appareil sous le compte connecté
// (horsLigne.js) : hors ligne, chaque page retrouve ainsi ses données les
// plus récentes.
//
// Les adresses sont écrites exactement comme les pages les demandent
// (même chemin, mêmes paramètres) pour que la copie gardée soit retrouvée.
import client from './client';
import { estHorsLigne } from './horsLigne';

const INTERVALLE_MS = 15 * 60 * 1000;
const EN_PARALLELE = 3;

// Lit une adresse ; renvoie les données, ou null en cas d'échec (une
// lecture refusée ou absente ne bloque pas le reste).
async function lire(adresse, options) {
  try { return (await client.get(adresse, options)).data; } catch { return null; }
}

// Lit une liste d'adresses, quelques-unes à la fois (serveur gratuit : pas
// de rafale).
async function toutLire(adresses) {
  for (let i = 0; i < adresses.length; i += EN_PARALLELE) {
    if (estHorsLigne()) return;
    await Promise.all(adresses.slice(i, i + EN_PARALLELE).map((a) => (Array.isArray(a) ? lire(...a) : lire(a))));
  }
}

const COMMUN = ['/auth/moi', '/etablissement', '/plateforme/etat', '/plateforme/statut', '/plateforme/confidentialite', '/notifications', '/semestres'];

async function academie() {
  const [classes, semestres, eleves, alertes] = await Promise.all([lire('/classes'), lire('/semestres'), lire('/eleves'), lire('/predictions/alertes')]);
  const lesClasses = classes?.classes || [];
  const lesSemestres = semestres?.semestres || [];
  const lesEleves = eleves?.eleves || [];
  await toutLire([
    '/professeurs', '/unites-enseignement', '/tableau-de-bord/academique', '/absences/statistiques', '/incidents',
    '/comptes-ephemeres', '/messages', ['/comptes-ephemeres/comptes-rendus', { params: { tache: 'saisie_absences' } }],
    ...lesSemestres.map((s) => `/unites-enseignement?semestreId=${s.id}`),
    ...lesClasses.flatMap((c) => [
      `/eleves?classeId=${c.id}`, `/cahier-de-textes?classeId=${c.id}`, `/emplois-du-temps?classeId=${c.id}`,
      `/classes/${c.id}/statistiques`, ['/emplois-du-temps/publication', { params: { classeId: c.id } }],
    ]),
    ...(alertes?.alertes || []).map((a) => `/predictions/eleve/${a.eleveId}`),
    ...lesEleves.flatMap((e) => [`/notes/eleve/${e.id}`, `/absences/eleve/${e.id}`, `/incidents/eleve/${e.id}`]),
    ...lesEleves.flatMap((e) => lesSemestres.map((s) => `/bulletins/${e.id}/${s.id}`)),
  ]);
}

async function finance() {
  const [, , eleves, personnel] = await Promise.all([lire('/classes'), lire('/semestres'), lire('/eleves'), lire('/finance/personnel')]);
  await toutLire([
    '/finance/impayes', '/finance/impayes/par-classe',
    ...(personnel?.personnel || []).map((p) => `/finance/personnel/${p.id}/fiche`),
    ...(eleves?.eleves || []).flatMap((e) => [`/finance/frais/eleve/${e.id}`, `/finance/paiements/eleve/${e.id}`]),
  ]);
}

async function etudiant() {
  const [dossier, semestres] = await Promise.all([lire('/eleves'), lire('/semestres')]);
  const moi = dossier?.eleves?.[0];
  if (!moi) return;
  await toutLire([
    '/messages',
    `/notes/eleve/${moi.id}`, `/absences/eleve/${moi.id}`, `/incidents/eleve/${moi.id}`,
    `/finance/frais/eleve/${moi.id}`, `/finance/paiements/eleve/${moi.id}`,
    ...(moi.classeId ? [`/emplois-du-temps?classeId=${moi.classeId}`] : []),
    ...(semestres?.semestres || []).map((s) => `/bulletins/${moi.id}/${s.id}`),
  ]);
}

async function superadmin() {
  const etablissements = await lire('/superadmin/etablissements');
  await toutLire([
    '/superadmin/statistiques', '/superadmin/fonctionnalites', '/superadmin/mises-a-jour', '/superadmin/diffusion',
    '/superadmin/systeme', '/superadmin/config-email', '/superadmin/superadmins', '/superadmin/journal',
    ['/superadmin/journal', { params: { limite: 500 } }],
    ...(etablissements?.etablissements || []).map((e) => `/superadmin/etablissements/${e.id}`),
  ]);
}

const PAR_ROLE = { academie, finance, etudiant, superadmin };

let roleEnCours = null;
let minuteur = null;
let enCours = null;

async function synchroniser() {
  if (!roleEnCours || estHorsLigne() || enCours) return enCours;
  enCours = (async () => {
    try {
      await toutLire(COMMUN.filter((a) => roleEnCours !== 'superadmin' || !a.startsWith('/etablissement')));
      await PAR_ROLE[roleEnCours]?.();
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

function auRetourReseau() { synchroniser(); }

// Session ouverte (ou rouverte) : synchronisation tout de suite, puis
// régulièrement. `null` : session fermée, tout s'arrête.
export function suivreSession(profil) {
  clearInterval(minuteur);
  minuteur = null;
  window.removeEventListener('edusphere:reseau-retabli', auRetourReseau);
  roleEnCours = profil?.role || null;
  if (!roleEnCours) return;
  // Laisse d'abord la page d'accueil de l'espace charger ses propres données.
  setTimeout(synchroniser, 3000);
  minuteur = setInterval(synchroniser, INTERVALLE_MS);
  window.addEventListener('edusphere:reseau-retabli', auRetourReseau);
}
