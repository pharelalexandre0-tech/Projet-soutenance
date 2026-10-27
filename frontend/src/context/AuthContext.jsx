import { createContext, useContext, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { reinitialiserFlux } from '../api/tempsReel';
import { suivreSession } from '../api/synchronisation';
import { connexionHorsLigne, definirCompte, estErreurReseau, memoriserConnexion, profilHorsLigne, signalerHorsLigne } from '../api/horsLigne';

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
      .then((res) => { definirCompte(res.data.profil); setProfil(res.data.profil); })
      // Pendant une maintenance, la session reste valable : on garde le
      // jeton pour que l'utilisateur retrouve son espace dès la réouverture,
      // sans avoir à se reconnecter. Sans réseau, même chose : le profil
      // gardé sur l'appareil rouvre l'espace en mode hors ligne.
      .catch(async (err) => {
        if (estErreurReseau(err)) {
          const garde = await profilHorsLigne(token);
          if (garde) { definirCompte(garde); setProfil(garde); signalerHorsLigne(); return; }
        }
        // Seul un refus du serveur (session expirée ou invalide) ferme la
        // session ; un serveur momentanément injoignable ne la ferme pas.
        if ([401, 403].includes(err.response?.status)) sessionStorage.removeItem('pgs_token');
      })
      .finally(() => setChargement(false));
  }, []);

  // Hors ligne : toutes les données de l'espace connecté sont gardées sur
  // l'appareil et tenues à jour automatiquement (synchronisation.js).
  useEffect(() => { suivreSession(profil); }, [profil?.id, profil?.role]);

  // Retour du réseau après une session ouverte hors ligne : si le jeton a
  // expiré entre-temps, retour à l'écran de connexion.
  useEffect(() => {
    function verifier() {
      if (!sessionStorage.getItem('pgs_token')) return;
      client.get('/auth/moi').catch((err) => { if (err.response?.status === 401) seDeconnecter(); });
    }
    window.addEventListener('edusphere:reseau-retabli', verifier);
    return () => window.removeEventListener('edusphere:reseau-retabli', verifier);
  }, []);

  // Identifiants de la connexion en cours, le temps de l'étape du code
  // (gardés en mémoire seulement, pour préparer l'accès hors ligne).
  const enCours = useRef(null);

  function ouvrirSession(token, nouveauProfil) {
    sessionStorage.setItem('pgs_token', token);
    definirCompte(nouveauProfil);
  }

  // Renvoie soit { profil } (connexion terminée), soit
  // { doubleFacteurRequis: true, utilisateurId } quand un code par e-mail
  // reste à saisir (rôle Etudiant) — c'est à l'appelant (Login) de gérer
  // cette deuxième étape.
  async function seConnecter(email, motDePasse) {
    let res;
    try {
      res = await client.post('/auth/connexion', { email, motDePasse });
    } catch (err) {
      if (!estErreurReseau(err)) throw err;
      // Pas de réseau : session rouverte si ce compte s'est déjà connecté
      // en ligne sur cet appareil (pas de code par e-mail possible ici).
      const session = await connexionHorsLigne(email, motDePasse);
      ouvrirSession(session.token, session.profil);
      signalerHorsLigne(session.date);
      setProfil(session.profil);
      return { profil: session.profil };
    }
    if (res.data.doubleFacteurRequis) {
      enCours.current = { email, motDePasse };
      return { doubleFacteurRequis: true, utilisateurId: res.data.utilisateurId, delaiRenvoi: res.data.delaiRenvoi };
    }
    // Personnel : code de l'application d'authentification (ou première
    // configuration de celle-ci).
    if (res.data.applicationRequise) {
      enCours.current = { email, motDePasse };
      return {
        applicationRequise: true,
        configurationRequise: res.data.configurationRequise,
        jetonEtape: res.data.jetonEtape,
        prenom: res.data.prenom,
      };
    }
    ouvrirSession(res.data.token, res.data.profil);
    memoriserConnexion(email, motDePasse, res.data.token, res.data.profil);
    setProfil(res.data.profil);
    return { profil: res.data.profil };
  }

  // Le profil n'est appliqué qu'à l'appel de `appliquer()` : l'écran de
  // connexion garde ainsi le temps de montrer « code accepté » avant de
  // céder la place à l'espace (un profil posé tout de suite le redirigeait
  // aussitôt, animation coupée).
  async function verifierDoubleFacteur(utilisateurId, code) {
    const res = await client.post('/auth/connexion/double-facteur', { utilisateurId, code });
    ouvrirSession(res.data.token, res.data.profil);
    if (enCours.current) memoriserConnexion(enCours.current.email, enCours.current.motDePasse, res.data.token, res.data.profil);
    enCours.current = null;
    return { profil: res.data.profil, appliquer: () => setProfil(res.data.profil) };
  }

  // Session ouverte par l'étape de l'application d'authentification (code,
  // code de secours ou première configuration).
  function sessionDepuis(res) {
    ouvrirSession(res.data.token, res.data.profil);
    if (enCours.current) memoriserConnexion(enCours.current.email, enCours.current.motDePasse, res.data.token, res.data.profil);
    enCours.current = null;
    return { ...res.data, appliquer: () => setProfil(res.data.profil) };
  }

  async function verifierApplication(jetonEtape, code) {
    return sessionDepuis(await client.post('/auth/connexion/application', { jetonEtape, code }));
  }

  async function preparerApplication(jetonEtape) {
    return (await client.post('/auth/connexion/application/initialiser', { jetonEtape })).data;
  }

  async function activerApplication(jetonEtape, code) {
    return sessionDepuis(await client.post('/auth/connexion/application/activer', { jetonEtape, code }));
  }

  function seDeconnecter() {
    // La session est aussi fermée côté serveur (le jeton ne vaut plus rien,
    // même copié ailleurs).
    if (sessionStorage.getItem('pgs_token')) client.post('/auth/deconnexion').catch(() => {});
    sessionStorage.removeItem('pgs_token');
    definirCompte(null);
    // Rien de l'école précédente ne doit rester pour le compte suivant.
    try {
      Object.keys(sessionStorage).filter((cle) => cle.startsWith('es_identifiants')).forEach((cle) => sessionStorage.removeItem(cle));
    } catch { /* stockage indisponible */ }
    reinitialiserFlux();
    setProfil(null);
  }

  // Après une modification de son propre profil (ex. superadmin qui change
  // son nom), pour que la sidebar reflète le changement sans reconnexion.
  function mettreAJourProfil(nouveauProfil) {
    setProfil(nouveauProfil);
  }

  return (
    <AuthContext.Provider value={{
      profil, chargement, seConnecter, verifierDoubleFacteur, verifierApplication, preparerApplication, activerApplication, seDeconnecter, mettreAJourProfil,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
