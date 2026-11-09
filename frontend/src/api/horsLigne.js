// Fonctionnement hors ligne, sur le site comme dans l'application Android.
//
// - Chaque lecture réussie (GET) est gardée sur l'appareil, rangée sous le
//   compte connecté (jamais sous une clé commune : un autre compte du même
//   appareil ne voit rien). Sans réseau, la même lecture renvoie la copie
//   gardée et l'écran affiche le bandeau « hors ligne ».
// - Connexion sans réseau : possible seulement sur un appareil où ce compte
//   s'est déjà connecté en ligne. Le mot de passe n'est pas gardé, seulement
//   une empreinte (PBKDF2 salé) qui permet de le vérifier.
// - Les saisies courantes (moyennes, feuille d'appel, paiement) faites sans
//   réseau sont gardées dans une file d'attente sur l'appareil, puis envoyées
//   d'elles-mêmes au retour du réseau (voir fileAttente.js). Les autres
//   modifications demandent le serveur et sont refusées avec un message clair.
//
// Stockage : IndexedDB (accepte les PDF en Blob), base « edusphere-hors-ligne ».

const BASE = 'edusphere-hors-ligne';
const LECTURES = 'lectures';
const COMPTES = 'comptes';
const ATTENTE = 'attente';
const CLE_COMPTE = 'es_compte_hors_ligne';

let basePromesse = null;
function ouvrirBase() {
  if (basePromesse) return basePromesse;
  basePromesse = new Promise((resoudre, rejeter) => {
    if (typeof indexedDB === 'undefined') { rejeter(new Error('stockage indisponible')); return; }
    const demande = indexedDB.open(BASE, 2);
    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains(LECTURES)) db.createObjectStore(LECTURES);
      if (!db.objectStoreNames.contains(COMPTES)) db.createObjectStore(COMPTES);
      if (!db.objectStoreNames.contains(ATTENTE)) db.createObjectStore(ATTENTE);
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
  basePromesse.catch(() => { basePromesse = null; });
  return basePromesse;
}

async function lire(magasin, cle) {
  const db = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const demande = db.transaction(magasin).objectStore(magasin).get(cle);
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
}

async function ecrire(magasin, cle, valeur) {
  const db = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(magasin, 'readwrite');
    tx.objectStore(magasin).put(valeur, cle);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
  });
}

// ---- Compte courant (sert à ranger les lectures) ----
function compteCourant() {
  try { return sessionStorage.getItem(CLE_COMPTE); } catch { return null; }
}
export function definirCompte(profil) {
  try {
    if (profil) sessionStorage.setItem(CLE_COMPTE, `${profil.role}:${profil.id}`);
    else sessionStorage.removeItem(CLE_COMPTE);
  } catch { /* stockage indisponible */ }
}

// ---- Lectures gardées ----
// La clé reprend l'adresse et ses paramètres, dans un ordre stable.
export function cleLecture(config) {
  const adresse = `${config.baseURL ?? ''}${config.url ?? ''}`.replace(/^https?:\/\/[^/]+/, '');
  const params = config.params ? Object.entries(config.params).filter(([, v]) => v !== undefined && v !== null && v !== '').sort(([a], [b]) => a.localeCompare(b)) : [];
  const suite = params.length ? `${adresse.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}` : '';
  return `${adresse}${suite}`;
}

export async function garderLecture(config, donnees) {
  const compte = compteCourant();
  if (!compte) return;
  try { await ecrire(LECTURES, `${compte}|${cleLecture(config)}`, { donnees, date: Date.now() }); } catch { /* plein ou indisponible : sans gravité */ }
}

export async function retrouverLecture(config) {
  const compte = compteCourant();
  if (!compte) return null;
  try { return (await lire(LECTURES, `${compte}|${cleLecture(config)}`)) || null; } catch { return null; }
}

// ---- File d'attente des saisies faites hors ligne ----
// Seules ces saisies peuvent attendre le réseau : elles sont rejouées telles
// quelles, avec une clé qui empêche tout doublon côté serveur.
const SAISIES_DIFFERABLES = [
  { motif: /^\/notes$/, libelle: 'Moyennes saisies' },
  { motif: /^\/finance\/paiements$/, libelle: 'Paiement encaissé' },
  { motif: /^\/comptes-ephemeres\/[^/]+\/notes$/, libelle: 'Notes du professeur' },
  { motif: /^\/comptes-ephemeres\/[^/]+\/absences$/, libelle: "Feuille d'appel" },
];
const cheminDe = (config) => String(config.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
export function saisieDifferable(config) {
  if ((config.method || 'get').toLowerCase() !== 'post') return null;
  const chemin = cheminDe(config);
  return SAISIES_DIFFERABLES.find((s) => s.motif.test(chemin))?.libelle || null;
}
function compteDeLaSaisie(config) {
  const lien = cheminDe(config).match(/^\/comptes-ephemeres\/([^/]+)\//);
  return compteCourant() || (lien ? `lien:${lien[1]}` : null);
}
const ecouteursAttente = new Set();
async function diffuserAttente() {
  const liste = await listerAttente();
  ecouteursAttente.forEach((f) => { try { f(liste); } catch { /* sans effet sur les autres */ } });
}
export function suivreAttente(f) {
  ecouteursAttente.add(f);
  listerAttente().then(f).catch(() => {});
  return () => ecouteursAttente.delete(f);
}
export async function mettreEnAttente(config, libelle) {
  const compte = compteDeLaSaisie(config);
  if (!compte) return null;
  let corps = config.data;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { /* garde le texte */ } }
  const cle = config.headers?.['X-Idempotence'] || config.headers?.get?.('X-Idempotence') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const fiche = { id: cle, compte, methode: 'post', url: cheminDe(config), corps, libelle, date: Date.now(), rejet: null };
  await ecrire(ATTENTE, cle, fiche);
  diffuserAttente();
  return fiche;
}
export async function listerAttente() {
  const compte = compteCourant();
  try {
    const db = await ouvrirBase();
    const toutes = await new Promise((resoudre, rejeter) => {
      const demande = db.transaction(ATTENTE).objectStore(ATTENTE).getAll();
      demande.onsuccess = () => resoudre(demande.result || []);
      demande.onerror = () => rejeter(demande.error);
    });
    const page = typeof window !== 'undefined' ? window.location.pathname : '';
    return toutes
      .filter((f) => f.compte === compte || (f.compte.startsWith('lien:') && page.includes(f.compte.slice(5))))
      .sort((a, b) => a.date - b.date);
  } catch { return []; }
}
export async function retirerAttente(id) {
  const db = await ouvrirBase();
  await new Promise((resoudre) => {
    const tx = db.transaction(ATTENTE, 'readwrite');
    tx.objectStore(ATTENTE).delete(id);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => resoudre();
  });
  diffuserAttente();
}
export async function marquerRejet(fiche, message) {
  await ecrire(ATTENTE, fiche.id, { ...fiche, rejet: message });
  diffuserAttente();
}

// ---- État de la connexion, pour le bandeau ----
const ecouteurs = new Set();
let etat = { horsLigne: typeof navigator !== 'undefined' && navigator.onLine === false, depuis: null };
function diffuser(nouvel) {
  if (nouvel.horsLigne === etat.horsLigne && nouvel.depuis === etat.depuis) return;
  etat = nouvel;
  ecouteurs.forEach((f) => { try { f(etat); } catch { /* sans effet sur les autres */ } });
}
// Tant que l'appareil est hors ligne, le serveur est interrogé toutes les
// 5 secondes (adresse publique, sans données) : dès qu'il répond, les pages
// rechargent leurs données à jour, sans attendre une action.
const ORIGINE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let sonde = null;
async function serveurRepond() {
  try {
    const r = await fetch(`${ORIGINE}/api/sante`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}
function demarrerSonde() {
  if (sonde || typeof window === 'undefined') return;
  sonde = setInterval(async () => { if (await serveurRepond()) retourEnLigne(); }, 5000);
}
function retourEnLigne() {
  const etaitHorsLigne = etat.horsLigne;
  signalerEnLigne();
  if (etaitHorsLigne) window.dispatchEvent(new CustomEvent('edusphere:reseau-retabli'));
}

export function signalerHorsLigne(dateDonnees) {
  const etaitEnLigne = !etat.horsLigne;
  diffuser({ horsLigne: true, depuis: dateDonnees ?? etat.depuis });
  demarrerSonde();
  // Bascule immédiate : chaque page recharge aussitôt, depuis les copies
  // gardées, sans attendre qu'une requête échoue au bout de son délai.
  if (etaitEnLigne && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('edusphere:passage-hors-ligne'));
}
export function signalerEnLigne() {
  clearInterval(sonde);
  sonde = null;
  if (etat.horsLigne) diffuser({ horsLigne: false, depuis: null });
}
export function estHorsLigne() {
  return etat.horsLigne || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
// Coupure possible (flux du serveur interrompu) : vérification rapide, et
// passage hors ligne aussitôt si le serveur ne répond plus.
export async function verifierConnexion() {
  if (etat.horsLigne) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { signalerHorsLigne(); return; }
  if (!(await serveurRepond())) signalerHorsLigne();
}
export function etatConnexion() { return etat; }
export function suivreConnexion(f) {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}
if (typeof window !== 'undefined') {
  // Coupure silencieuse (Wi-Fi sans internet, serveur injoignable : le
  // navigateur ne prévient pas) : vérification courte toutes les 6 secondes
  // tant qu'une session est ouverte et la page visible.
  setInterval(() => {
    if (etat.horsLigne || document.hidden || !compteCourant()) return;
    verifierConnexion();
  }, 6000);
  // Wi-Fi ou données mobiles coupés : bascule tout de suite.
  window.addEventListener('offline', () => signalerHorsLigne());
  // Retour du réseau : chaque page recharge ses données à jour.
  window.addEventListener('online', async () => { if (await serveurRepond()) retourEnLigne(); });
}

// Serveur injoignable : pas de réponse du tout (réseau coupé), ou réponse de
// la passerelle à la place de l'application (502/503/504 hors maintenance,
// ou une page d'erreur sans le JSON de l'API).
export function estErreurReseau(err) {
  if (!err || err.code === 'ERR_CANCELED') return false;
  if (!err.response) return true;
  const { status, data } = err.response;
  if (data?.maintenance) return false;
  return [502, 503, 504].includes(status) || (status >= 500 && (typeof data !== 'object' || data === null || data instanceof Blob));
}

// ---- Connexion sans réseau ----
const texte = new TextEncoder();
function enHex(tampon) {
  return [...new Uint8Array(tampon)].map((o) => o.toString(16).padStart(2, '0')).join('');
}
async function empreinte(motDePasse, sel) {
  const cle = await crypto.subtle.importKey('raw', texte.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: texte.encode(sel), iterations: 120000 }, cle, 256);
  return enHex(bits);
}
const cleCompte = (email) => String(email || '').trim().toLowerCase();

// Après une connexion réussie en ligne : de quoi rouvrir la session hors ligne.
export async function memoriserConnexion(email, motDePasse, token, profil) {
  try {
    if (!crypto?.subtle) return;
    const sel = enHex(crypto.getRandomValues(new Uint8Array(16)));
    await ecrire(COMPTES, cleCompte(email), { sel, empreinte: await empreinte(String(motDePasse), sel), token, profil, date: Date.now() });
  } catch { /* hors ligne indisponible sur cet appareil : la connexion en ligne marche quand même */ }
}

// Mêmes variantes que le serveur pour le matricule étudiant (brut, sans
// espaces autour, en majuscules).
export async function connexionHorsLigne(email, motDePasse) {
  let fiche = null;
  try { fiche = await lire(COMPTES, cleCompte(email)); } catch { /* indisponible */ }
  const erreur = (message) => Object.assign(new Error(message), { horsLigne: true, response: { status: 0, data: { erreur: message } } });
  if (!fiche || !crypto?.subtle) {
    throw erreur("Vous êtes hors ligne. Connectez-vous une première fois avec internet sur cet appareil pour pouvoir ensuite l'utiliser hors ligne.");
  }
  const brut = String(motDePasse);
  for (const essai of new Set([brut, brut.trim(), brut.trim().toUpperCase()])) {
    if (await empreinte(essai, fiche.sel) === fiche.empreinte) return { token: fiche.token, profil: fiche.profil, date: fiche.date };
  }
  throw erreur('identifiants incorrects');
}

// Profil gardé pour une session déjà ouverte (réouverture du site sans réseau).
export async function profilHorsLigne(token) {
  try {
    const db = await ouvrirBase();
    return await new Promise((resoudre) => {
      const demande = db.transaction(COMPTES).objectStore(COMPTES).openCursor();
      demande.onsuccess = () => {
        const curseur = demande.result;
        if (!curseur) { resoudre(null); return; }
        if (curseur.value?.token === token) { resoudre(curseur.value.profil); return; }
        curseur.continue();
      };
      demande.onerror = () => resoudre(null);
    });
  } catch { return null; }
}
