import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pgs_token');
    if (!token) {
      setChargement(false);
      return;
    }
    client
      .get('/auth/moi')
      .then((res) => setProfil(res.data.profil))
      .catch(() => localStorage.removeItem('pgs_token'))
      .finally(() => setChargement(false));
  }, []);

  async function seConnecter(email, motDePasse) {
    const res = await client.post('/auth/connexion', { email, motDePasse });
    localStorage.setItem('pgs_token', res.data.token);
    setProfil(res.data.profil);
    return res.data.profil;
  }

  function seDeconnecter() {
    localStorage.removeItem('pgs_token');
    setProfil(null);
  }

  // Après une modification de son propre profil (ex. superadmin qui change
  // son nom), pour que la sidebar reflète le changement sans reconnexion.
  function mettreAJourProfil(nouveauProfil) {
    setProfil(nouveauProfil);
  }

  return (
    <AuthContext.Provider value={{ profil, chargement, seConnecter, seDeconnecter, mettreAJourProfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
