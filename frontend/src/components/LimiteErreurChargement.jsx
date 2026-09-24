import { Component } from 'react';

const CLE_RELOAD = 'edusphere_reload_apres_erreur';

// Un chunk lazy() (voir App.jsx) qui échoue à charger — build fraîchement
// redéployé pendant qu'un onglet était resté ouvert sur l'ancien
// index.html, donc l'ancien nom de fichier haché n'existe plus côté
// serveur — plante toute l'app en page blanche : Suspense ne gère que le
// temps de chargement, pas un import qui rejette, et sans error boundary
// nulle part React démonte tout l'arbre sans rien afficher à la place.
// Un seul rechargement suffit (la page fraîche pointe vers les bons
// fichiers) — sessionStorage évite une boucle si l'erreur n'a en fait rien
// à voir avec un chunk manquant.
export default class LimiteErreurChargement extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur) {
    const chunkManquant = /dynamically imported module|loading chunk|failed to fetch/i.test(erreur?.message || '');
    if (chunkManquant && !sessionStorage.getItem(CLE_RELOAD)) {
      sessionStorage.setItem(CLE_RELOAD, '1');
      window.location.reload();
    }
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14,
        textAlign: 'center', padding: 24, fontFamily: 'var(--police)',
      }}>
        <p style={{ fontSize: '1rem', color: 'var(--texte)' }}>Une mise à jour a eu lieu. Cette page a besoin d'être rechargée.</p>
        <button
          className="bouton-connexion"
          style={{ maxWidth: 220 }}
          onClick={() => { sessionStorage.removeItem(CLE_RELOAD); window.location.reload(); }}
        >
          Recharger
        </button>
      </div>
    );
  }
}
