import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';

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
  // Les rubriques du dossier qui s'ouvre, comme les onglets du classeur.
  const ONGLETS = profil?.role === 'etudiant' ? ['Mon dossier', 'Vie scolaire', 'Documents']
    : profil?.role === 'ministere' ? ['Tutelle', 'Pilotage', 'Contrôle']
      : profil?.role === 'superadmin' ? ['Écoles', 'Plateforme', 'Administration']
        : ['Scolarité', 'Évaluation', 'Établissement'];
  return (
    <div className="transition-ouverture volet-ouverture">
      {pret && (
        <>
          <span className="sceau-ouverture">
            {ecole && !etab?.logo
              ? <span className="sceau-initiales">{initiales(etab)}</span>
              : <img src={ecole ? etab.logo : logoIcon} alt="" />}
          </span>
          {nom && <h1 className={`nom-ouverture ${nom.length > 28 ? 'nom-long' : ''}`}>{nom}</h1>}
          <div className="onglets-ouverture" aria-hidden="true">
            {ONGLETS.map((o, i) => <span key={o} style={{ '--i': i }}><b>{['I', 'II', 'III'][i]}</b>{o}</span>)}
          </div>
          <p>Ouverture de votre dossier…</p>
          {ecole && <small className="ouverture-plateforme">EduSphere</small>}
        </>
      )}
    </div>
  );
}
