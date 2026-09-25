import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('pgs_token');
    if (!token) {
      setChargement(false);
      return;
    }
    client
      .get('/auth/moi')
      .then((res) => setProfil(res.data.profil))
      // Pendant une maintenance, la session reste valable : on garde le
      // jeton pour que l'utilisateur retrouve son espace dès la réouverture,
      // sans avoir à se reconnecter.
      .catch((err) => { if (!err.response?.data?.maintenance) sessionStorage.removeItem('pgs_token'); })
      .finally(() => setChargement(false));
  }, []);

  // Renvoie soit { profil } (connexion terminée), soit
  // { doubleFacteurRequis: true, utilisateurId } quand un code par e-mail
  // reste à saisir (rôle Etudiant) — c'est à l'appelant (Login) de gérer
  // cette deuxième étape.
  async function seConnecter(email, motDePasse) {
    const res = await client.post('/auth/connexion', { email, motDePasse });
    if (res.data.doubleFacteurRequis) {
      return { doubleFacteurRequis: true, utilisateurId: res.data.utilisateurId };
    }
    sessionStorage.setItem('pgs_token', res.data.token);
    setProfil(res.data.profil);
    return { profil: res.data.profil };
  }

  async function verifierDoubleFacteur(utilisateurId, code) {
    const res = await client.post('/auth/connexion/double-facteur', { utilisateurId, code });
    sessionStorage.setItem('pgs_token', res.data.token);
    setProfil(res.data.profil);
    return res.data.profil;
  }

  function seDeconnecter() {
    sessionStorage.removeItem('pgs_token');
    setProfil(null);
  }

  // Après une modification de son propre profil (ex. superadmin qui change
  // son nom), pour que la sidebar reflète le changement sans reconnexion.
  function mettreAJourProfil(nouveauProfil) {
    setProfil(nouveauProfil);
  }

  return (
    <AuthContext.Provider value={{ profil, chargement, seConnecter, verifierDoubleFacteur, seDeconnecter, mettreAJourProfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
