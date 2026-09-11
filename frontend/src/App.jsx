import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AccesTemporaire from './pages/AccesTemporaire';
import DashboardAcademie from './pages/DashboardAcademie';
import DashboardEtudiant from './pages/DashboardEtudiant';
import DashboardFinance from './pages/DashboardFinance';
import DashboardSuperAdmin from './pages/DashboardSuperAdmin';

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
      </BrowserRouter>
    </AuthProvider>
  );
}
