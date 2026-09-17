import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

// Chaque profil ne charge jamais que son propre tableau de bord — les
// quatre étaient importés en dur, donc livrés en un seul bloc à tout le
// monde (~400 Ko gzippés) avant même l'écran de connexion. En lazy, un
// étudiant ne télécharge plus le code de l'espace finance ou académie.
const AccesTemporaire = lazy(() => import('./pages/AccesTemporaire'));
const DashboardAcademie = lazy(() => import('./pages/DashboardAcademie'));
const DashboardEtudiant = lazy(() => import('./pages/DashboardEtudiant'));
const DashboardFinance = lazy(() => import('./pages/DashboardFinance'));
const DashboardSuperAdmin = lazy(() => import('./pages/DashboardSuperAdmin'));

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
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="chargement">Chargement…</div>}>
          <Routes>
            <Route path="/connexion" element={<Login />} />
            <Route path="/acces-temporaire/:jeton" element={<AccesTemporaire />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
