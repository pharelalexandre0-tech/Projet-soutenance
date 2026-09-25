import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('pgs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Maintenance déclenchée par le superadmin pendant qu'une session est
// ouverte : n'importe quel appel peut revenir en 503 "maintenance". Un seul
// endroit pour le repérer, qui prévient l'écran d'attente global
// (EcranMaintenance) au lieu que chaque page affiche sa propre erreur.
client.interceptors.response.use(
  (reponse) => reponse,
  (err) => {
    if (err.response?.status === 503 && err.response.data?.maintenance) {
      window.dispatchEvent(new CustomEvent('edusphere:maintenance', { detail: err.response.data }));
    }
    return Promise.reject(err);
  }
);

export default client;
