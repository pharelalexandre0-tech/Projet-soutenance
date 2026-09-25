import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IconWrench } from './icons';
import { dateHeure } from '../utils/plateforme';
import logoIcon from '../assets/logo-icon.png';

const DELAI_VERIFICATION_MS = 30 * 1000;

// Écran d'attente plein écran quand le superadmin a mis la plateforme en
// maintenance : déclenché par n'importe quel appel API revenu en 503
// "maintenance" (voir api/client.js). Seulement pour une session ouverte :
// sur l'écran de connexion, c'est le formulaire lui-même qui l'annonce.
// Vérifie tout seul toutes les 30 s et rouvre l'espace dès la fin.
export default function EcranMaintenance() {
  const { seDeconnecter } = useAuth();
  const [maintenance, setMaintenance] = useState(null);
  const [verification, setVerification] = useState(false);

  useEffect(() => {
    function surMaintenance(e) {
      if (!sessionStorage.getItem('pgs_token')) return;
      setMaintenance({ message: e.detail?.erreur, finPrevue: e.detail?.finPrevue || null });
    }
    window.addEventListener('edusphere:maintenance', surMaintenance);
    return () => window.removeEventListener('edusphere:maintenance', surMaintenance);
  }, []);

  const verifier = useCallback(async () => {
    setVerification(true);
    try {
      const res = await client.get('/plateforme/statut');
      if (!res.data.maintenance.actif) {
        window.location.reload();
        return;
      }
      setMaintenance((m) => ({ ...m, finPrevue: res.data.maintenance.finPrevue }));
    } catch {
      // Serveur momentanément injoignable (redémarrage pendant la
      // maintenance) : on réessaiera au prochain passage.
    } finally {
      setVerification(false);
    }
  }, []);

  useEffect(() => {
    if (!maintenance) return undefined;
    const minuteur = setInterval(verifier, DELAI_VERIFICATION_MS);
    return () => clearInterval(minuteur);
  }, [maintenance, verifier]);

  if (!maintenance) return null;

  return (
    <div className="ecran-maintenance" role="alertdialog" aria-labelledby="titre-maintenance">
      <div className="ecran-maintenance-carte">
        <span className="ecran-maintenance-sceau"><img src={logoIcon} alt="" /></span>
        <span className="ecran-maintenance-icone"><IconWrench width={22} height={22} /></span>
        <h1 id="titre-maintenance">Maintenance en cours</h1>
        <p className="ecran-maintenance-message">{maintenance.message}</p>
        {maintenance.finPrevue && (
          <p className="ecran-maintenance-fin">Retour prévu : <strong>{dateHeure(maintenance.finPrevue)}</strong></p>
        )}
        <p className="ecran-maintenance-aide">
          Ta session est conservée. Cette page se rouvrira d'elle-même dès la fin de la maintenance.
        </p>
        <div className="ecran-maintenance-actions">
          <button className="primaire" onClick={verifier} disabled={verification}>
            {verification ? 'Vérification…' : 'Vérifier maintenant'}
          </button>
          <button className="secondaire" onClick={() => { seDeconnecter(); setMaintenance(null); }}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
