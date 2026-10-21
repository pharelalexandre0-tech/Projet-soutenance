// Service worker du site EduSphere : garde l'application elle-même (pages,
// scripts, styles, polices) pour qu'elle s'ouvre sans réseau. Les données
// (/api, /fichiers) ne passent pas par ici : l'application les garde
// elle-même, rangées par compte (src/api/horsLigne.js).
const COQUILLE = 'edusphere-coquille-v1';
const POLICES = 'edusphere-polices-v1';

// Met en cache index.html et tous les fichiers /assets qu'il référence,
// y compris les morceaux chargés plus tard (un espace jamais ouvert doit
// pouvoir s'ouvrir hors ligne).
async function prechargerDepuis(html) {
  const cache = await caches.open(COQUILLE);
  const vus = new Set();
  const file = [html];
  while (file.length) {
    const texte = file.shift();
    // « assets/x.js » (index.html, carte de préchargement) ou « ./x.js »
    // (import dynamique écrit depuis un fichier de /assets).
    for (const [, chemin] of texte.matchAll(/(?:\/?assets\/|["'`]\.\/)([\w.\-]+\.(?:js|css|png|svg|jpg|webp|woff2?))/g)) {
      const url = `/assets/${chemin}`;
      if (vus.has(url)) continue;
      vus.add(url);
      let reponse = await cache.match(url);
      if (!reponse) {
        try {
          reponse = await fetch(url);
          if (!reponse.ok) continue;
          await cache.put(url, reponse.clone());
        } catch { continue; }
      }
      if (url.endsWith('.js') || url.endsWith('.css')) file.push(await reponse.text());
    }
  }
}

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    const reponse = await fetch('/index.html', { cache: 'no-store' });
    await cache.put('/index.html', reponse.clone());
    await cache.addAll(['/favicon.png', '/manifest.webmanifest', '/icones/icone-192.png']).catch(() => {});
    await prechargerDepuis(await reponse.text());
    await self.skipWaiting();
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
      const garde = await cache.match(requete);
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
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Fichiers versionnés (/assets) : la copie suffit ; le reste : réseau d'abord.
  evenement.respondWith((async () => {
    const cache = await caches.open(COQUILLE);
    if (url.pathname.startsWith('/assets/')) {
      const garde = await cache.match(requete);
      if (garde) return garde;
    }
    try {
      const reponse = await fetch(requete);
      if (reponse.ok) cache.put(requete, reponse.clone());
      return reponse;
    } catch {
      return (await cache.match(requete)) || Response.error();
    }
  })());
});
