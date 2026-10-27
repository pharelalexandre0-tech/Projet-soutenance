import axios from 'axios';
import { estErreurReseau, estHorsLigne, garderLecture, retrouverLecture, signalerEnLigne, signalerHorsLigne } from './horsLigne';

// Adresse du serveur. Vide : même origine (proxy de Vite en local, de nginx
// dans Docker). Sur Vercel, VITE_API_URL = adresse publique du backend.
export const ORIGINE_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const client = axios.create({ baseURL: `${ORIGINE_API}/api` });

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('pgs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Déjà hors ligne : une lecture gardée est rendue tout de suite, sans
// attendre l'échec du réseau.
client.interceptors.request.use(async (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get' || !estHorsLigne()) return config;
  const copie = await retrouverLecture(config);
  if (copie) {
    signalerHorsLigne(copie.date);
    config.adapter = async () => ({ data: copie.donnees, status: 200, statusText: 'OK', headers: {}, config, request: {}, horsLigne: true, date: copie.date });
  }
  return config;
});

// Maintenance déclenchée par le superadmin pendant qu'une session est
// ouverte : n'importe quel appel peut revenir en 503 "maintenance". Un seul
// endroit pour le repérer, qui prévient l'écran d'attente global
// (EcranMaintenance) au lieu que chaque page affiche sa propre erreur.
//
// Hors ligne (voir horsLigne.js) : chaque lecture réussie est gardée sur
// l'appareil ; sans réseau, la même lecture renvoie cette copie, et une
// modification est refusée avec un message qui dit pourquoi.
client.interceptors.response.use(
  (reponse) => {
    if (reponse.horsLigne) return reponse;
    const methode = (reponse.config.method || 'get').toLowerCase();
    if (methode === 'get' && !/\/evenements|\/export|\/documents\/|\/verification\//.test(reponse.config.url || '')) garderLecture(reponse.config, reponse.data);
    signalerEnLigne();
    return reponse;
  },
  async (err) => {
    if (err.response?.status === 503 && err.response.data?.maintenance) {
      window.dispatchEvent(new CustomEvent('edusphere:maintenance', { detail: err.response.data }));
    }
    if (estErreurReseau(err) && err.config) {
      const methode = (err.config.method || 'get').toLowerCase();
      if (methode === 'get') {
        const copie = await retrouverLecture(err.config);
        if (copie) {
          signalerHorsLigne(copie.date);
          return { data: copie.donnees, status: 200, statusText: 'OK', headers: {}, config: err.config, horsLigne: true, date: copie.date };
        }
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        signalerHorsLigne();
        err.horsLigne = true;
      }
    }
    return Promise.reject(err);
  }
);

export default client;
