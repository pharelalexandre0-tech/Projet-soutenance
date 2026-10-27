import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';
import FilOuverture from './FilOuverture';

function initiales(etab) {
  const sigle = String(etab?.sigle || '').replace(/[^\p{L}\p{N}]/gu, '');
  if (sigle) return sigle.slice(0, 4).toUpperCase();
  const mots = String(etab?.nom || '').split(/[\s'’-]+/).filter((m) => m.length > 2 || /^[A-Z]/.test(m));
  return (mots.map((m) => m[0]).join('').slice(0, 3) || 'E').toUpperCase();
}

// Écran d'ouverture après connexion, sobre et clair : le logo et le nom de L'ÉCOLE du
// compte (ses initiales si elle n'a pas de logo), EduSphere seulement pour
// le superadmin, qui n'appartient à aucune école.
export default function TransitionOuverture() {
  const { profil } = useAuth();
  const ecole = profil && profil.role !== 'superadmin';
  const [etab, setEtab] = useState(null);
  const [pret, setPret] = useState(!ecole);

  useEffect(() => {
    if (!ecole) return;
    client.get('/etablissement')
      .then((res) => setEtab(res.data.etablissement))
      .catch(() => {})
      .finally(() => setPret(true));
  }, [ecole]);

  const nom = ecole ? (etab?.nom || '') : 'EduSphere';
  return (
    <div className="transition-ouverture ecran-ouverture">
      {pret && (
        <div className="ouverture-centre">
          <span className="ouverture-logo">
            {ecole && !etab?.logo
              ? <span className="ouverture-initiales">{initiales(etab)}</span>
              : <img src={ecole ? etab.logo : logoIcon} alt="" />}
          </span>
          {nom && <h1 className={`ouverture-nom ${nom.length > 28 ? 'nom-long' : ''}`}>{nom}</h1>}
          <p className="ouverture-surtitre">{ecole ? 'Ouverture de votre espace' : 'Console de la plateforme'}</p>
          <FilOuverture />
          {ecole && <small className="ouverture-plateforme"><img src={logoIcon} alt="" /> EduSphere</small>}
        </div>
      )}
    </div>
  );
}
