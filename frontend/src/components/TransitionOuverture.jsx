import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';

// Les lettres du nom s'assemblent une à une : l'identité qui se construit,
// sur le même dégradé que l'écran de connexion.
function NomAnime({ texte, long }) {
  return (
    <h1 className={`marque-lettres ${long ? 'nom-long' : ''}`} aria-label={texte}>
      {texte.split('').map((lettre, i) => (
        <span key={i} style={{ animationDelay: `${0.25 + i * (long ? 0.02 : 0.045)}s` }}>{lettre === ' ' ? ' ' : lettre}</span>
      ))}
    </h1>
  );
}

function initiales(etab) {
  const sigle = String(etab?.sigle || '').replace(/[^\p{L}\p{N}]/gu, '');
  if (sigle) return sigle.slice(0, 4).toUpperCase();
  const mots = String(etab?.nom || '').split(/[\s'’-]+/).filter((m) => m.length > 2 || /^[A-Z]/.test(m));
  return (mots.map((m) => m[0]).join('').slice(0, 3) || 'E').toUpperCase();
}

// Écran d'ouverture après connexion : le logo et le nom de L'ÉCOLE du
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
    <div className="transition-ouverture">
      {pret && (
        <>
          <span className="sceau-ouverture">
            {ecole && !etab?.logo
              ? <span className="sceau-initiales">{initiales(etab)}</span>
              : <img src={ecole ? etab.logo : logoIcon} alt="" />}
          </span>
          {nom && <NomAnime texte={nom} long={nom.length > 18} />}
          <p>Ouverture de votre espace…</p>
          <span className="piste-ouverture" aria-hidden="true">
            <span className="remplissage-ouverture" />
          </span>
          {ecole && <small className="ouverture-plateforme">EduSphere</small>}
        </>
      )}
    </div>
  );
}
