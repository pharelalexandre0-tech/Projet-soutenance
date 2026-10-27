// Service worker du site EduSphere : garde l'application elle-même (pages,
// scripts, styles, polices) pour qu'elle s'ouvre sans réseau. Les données
// (/api, /fichiers) ne passent pas par ici : l'application les garde
// elle-même, rangées par compte (src/api/horsLigne.js).
const COQUILLE = 'edusphere-coquille-v2';
const POLICES = 'edusphere-polices-v1';
// Les fichiers sont retrouvés par leur seule adresse : le serveur répond
// avec « Vary » (Origin, Accept-Encoding) et les scripts de la page sont
// demandés en mode cors, avec d'autres en-têtes que lors de la mise en
// cache. Sans cette option, rien n'était retrouvé et la page restait
// blanche hors ligne.
const SANS_VARY = { ignoreVary: true };

// Met en cache les fichiers /assets référencés par index.html, puis ceux
// qu'ils référencent à leur tour (morceaux chargés plus tard : un espace
// jamais ouvert doit pouvoir s'ouvrir hors ligne). Niveau par niveau, six
// téléchargements à la fois : sur une connexion de téléphone, un par un
// prenait plus d'une minute.
// « assets/x.js » (index.html, carte de préchargement) ou « ./x.js »
// (import dynamique écrit depuis un fichier de /assets).
const MOTIF = /(?:\/?assets\/|["'`]\.\/)([\w.\-]+\.(?:js|css|png|svg|jpg|webp|woff2?))/g;
async function prechargerDepuis(html, niveauxMax = Infinity) {
  const cache = await caches.open(COQUILLE);
  const vus = new Set();
  let textes = [html];
  for (let niveau = 0; niveau < niveauxMax && textes.length; niveau++) {
    const urls = [];
    for (const texte of textes) {
      for (const [, chemin] of texte.matchAll(MOTIF)) {
        const url = `/assets/${chemin}`;
        if (!vus.has(url)) { vus.add(url); urls.push(url); }
      }
    }
    const suivants = [];
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async (url) => {
        let reponse = await cache.match(url, SANS_VARY);
        if (!reponse) {
          try {
            reponse = await fetch(url);
            if (!reponse.ok) return;
            await cache.put(url, reponse.clone());
          } catch { return; }
        }
        if (url.endsWith('.js') || url.endsWith('.css')) suivants.push(await reponse.text());
      }));
    }
    textes = suivants;
  }
}

// Installation rapide : la page et ses fichiers directs (de quoi rouvrir
// l'application). Le reste suit aussitôt après, en arrière-plan.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    const reponse = await fetch('/index.html', { cache: 'no-store' });
    await cache.put('/index.html', reponse.clone());
    await cache.addAll(['/favicon.png', '/manifest.webmanifest', '/icones/icone-192.png']).catch(() => {});
    await prechargerDepuis(await reponse.text(), 2);
    await self.skipWaiting();
  })());
});

// La page demande le préchargement complet dès que ce service worker la
// contrôle (et à chaque ouverture : ce qui est déjà gardé n'est pas refait).
self.addEventListener('message', (evenement) => {
  if (evenement.data !== 'precharger') return;
  evenement.waitUntil((async () => {
    const garde = await caches.match('/index.html', SANS_VARY);
    if (garde) await prechargerDepuis(await garde.text());
    evenement.source?.postMessage('pret-hors-ligne');
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom !== COQUILLE && nom !== POLICES) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);

  // Polices Google : copie gardée, rafraîchie en arrière-plan.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    evenement.respondWith((async () => {
      const cache = await caches.open(POLICES);
      const garde = await cache.match(requete, SANS_VARY);
      const reseau = fetch(requete).then((r) => { if (r.ok || r.type === 'opaque') cache.put(requete, r.clone()); return r; }).catch(() => garde);
      return garde || reseau;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/fichiers/')) return;

  // Pages de l'application : réseau d'abord (nouvelle version), sinon la copie.
  if (requete.mode === 'navigate') {
    evenement.respondWith((async () => {
      try {
        const reponse = await fetch(requete);
        if (reponse.ok) {
          const copie = reponse.clone();
          evenement.waitUntil((async () => {
            const html = await copie.text();
            const cache = await caches.open(COQUILLE);
            await cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
            await prechargerDepuis(html);
          })());
        }
        return reponse;
      } catch {
        return (await caches.match('/index.html', SANS_VARY)) || Response.error();
      }
    })());
    return;
  }

  // Fichiers versionnés (/assets) : la copie suffit ; le reste : réseau d'abord.
  evenement.respondWith((async () => {
    const cache = await caches.open(COQUILLE);
    if (url.pathname.startsWith('/assets/')) {
      const garde = await cache.match(url.pathname, SANS_VARY);
      if (garde) return garde;
    }
    try {
      const reponse = await fetch(requete);
      if (reponse.ok) cache.put(requete, reponse.clone());
      return reponse;
    } catch {
      return (await cache.match(url.pathname, SANS_VARY)) || Response.error();
    }
  })());
});
