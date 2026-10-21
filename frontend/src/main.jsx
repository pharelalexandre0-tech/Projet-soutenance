import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Site seulement (l'application Android contient déjà ses fichiers) : le
// service worker garde l'application pour qu'elle s'ouvre sans réseau, et
// la rend installable depuis le navigateur du téléphone.
if (import.meta.env.PROD && import.meta.env.MODE !== 'android' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* navigateur sans prise en charge */ });
  });
}
