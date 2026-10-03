import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LimiteErreurChargement from './components/LimiteErreurChargement';
import EcranMaintenance from './components/EcranMaintenance';
import EcranDemarrage, { demarrageAAfficher } from './components/EcranDemarrage';
import Login from './pages/Login';

// Chaque profil ne charge jamais que son propre tableau de bord — les
// quatre étaient importés en dur, donc livrés en un seul bloc à tout le
// monde (~400 Ko gzippés) avant même l'écran de connexion. En lazy, un
// étudiant ne télécharge plus le code de l'espace finance ou académie.
const AccesTemporaire = lazy(() => import('./pages/AccesTemporaire'));
const ReinitialiserMotDePasse = lazy(() => import('./pages/ReinitialiserMotDePasse'));
const Confidentialite = lazy(() => import('./pages/Confidentialite'));
const DashboardAcademie = lazy(() => import('./pages/DashboardAcademie'));
const DashboardEtudiant = lazy(() => import('./pages/DashboardEtudiant'));
const DashboardFinance = lazy(() => import('./pages/DashboardFinance'));
const DashboardSuperAdmin = lazy(() => import('./pages/DashboardSuperAdmin'));
// Application Android seulement (construction en mode « android ») : son
// animation d'ouverture. Dans la construction du site, la condition est
// fausse dès la compilation et ce code n'est pas inclus.
const IntroApplication = import.meta.env.MODE === 'android' ? lazy(() => import('./mobile/IntroApplication')) : null;
if (import.meta.env.MODE === 'android') import('./mobile/application.css');

function Accueil() {
  const { profil } = useAuth();
  if (profil?.role === 'superadmin') return <DashboardSuperAdmin />;
  if (profil?.role === 'academie') return <DashboardAcademie />;
  if (profil?.role === 'finance') return <DashboardFinance />;
  if (profil?.role === 'etudiant') return <DashboardEtudiant />;
  return <Navigate to="/connexion" replace />;
}

function MisEnPage({ children }) {
  const { profil } = useAuth();
  return (
    <div className="app-shell" data-role={profil?.role}>
      <main className="contenu">{children}</main>
    </div>
  );
}

export default function App() {
  const [demarrage, setDemarrage] = useState(demarrageAAfficher);

  return (
    <AuthProvider>
      <BrowserRouter>
        <LimiteErreurChargement>
          <Suspense fallback={<div className="chargement">Chargement…</div>}>
            <Routes>
              <Route path="/connexion" element={<Login />} />
              <Route path="/acces-temporaire/:jeton" element={<AccesTemporaire />} />
              <Route path="/reinitialiser-mot-de-passe/:jeton" element={<ReinitialiserMotDePasse />} />
              <Route path="/confidentialite" element={<Confidentialite />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MisEnPage>
                      <Accueil />
                    </MisEnPage>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
          <EcranMaintenance />
          {demarrage && (IntroApplication
            ? <Suspense fallback={null}><IntroApplication onTermine={() => setDemarrage(false)} /></Suspense>
            : <EcranDemarrage onTermine={() => setDemarrage(false)} />)}
        </LimiteErreurChargement>
      </BrowserRouter>
    </AuthProvider>
  );
}
