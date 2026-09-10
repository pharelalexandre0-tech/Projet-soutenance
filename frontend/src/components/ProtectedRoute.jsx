import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles, children }) {
  const { profil, chargement } = useAuth();

  if (chargement) return <div className="chargement">Chargement…</div>;
  if (!profil) return <Navigate to="/connexion" replace />;
  if (roles && !roles.includes(profil.role)) return <Navigate to="/" replace />;

  return children;
}
