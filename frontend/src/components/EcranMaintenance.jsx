import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IconWrench } from './icons';
import { dateHeure } from '../utils/plateforme';
import logoIcon from '../assets/logo-icon.png';

const DELAI_VERIFICATION_MS = 30 * 1000;
const RAYON = 62;
const CIRCONFERENCE = 2 * Math.PI * RAYON;
// Message pré-rempli côté superadmin : déjà dit par la phrase d'accroche,
// on ne le répète pas.
const MESSAGE_PAR_DEFAUT = 'Mise à jour de la plateforme en cours.';

function dureeRestante(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `environ ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `environ ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

// Écran d'attente plein écran quand le superadmin a mis la plateforme en
// maintenance : déclenché par n'importe quel appel API revenu en 503
// "maintenance" (voir api/client.js). Seulement pour une session ouverte :
// sur l'écran de connexion, c'est le formulaire lui-même qui l'annonce.
// Autour du logo, un anneau avance du début de la maintenance jusqu'au
// retour prévu, avec un arc lumineux qui tourne en continu ; la clé à
// molette reste en pastille. Vérifie tout seul toutes les 30 s et rouvre
// l'espace dès la fin.
export default function EcranMaintenance() {
  const { seDeconnecter } = useAuth();
  const [maintenance, setMaintenance] = useState(null);
  const [verification, setVerification] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    function surMaintenance(e) {
      if (!sessionStorage.getItem('pgs_token')) return;
      setMaintenance({ detail: e.detail?.detail || null, depuis: e.detail?.depuis || null, finPrevue: e.detail?.finPrevue || null });
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
      const m = res.data.maintenance;
      setMaintenance((ancien) => ({ ...ancien, detail: m.message || ancien?.detail || null, depuis: m.depuis || ancien?.depuis || null, finPrevue: m.finPrevue || null }));
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
    const horloge = setInterval(() => setMaintenant(Date.now()), 1000);
    verifier();
    return () => { clearInterval(minuteur); clearInterval(horloge); };
  }, [Boolean(maintenance), verifier]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!maintenance) return null;

  const debut = maintenance.depuis ? new Date(maintenance.depuis).getTime() : null;
  const fin = maintenance.finPrevue ? new Date(maintenance.finPrevue).getTime() : null;
  const avancement = debut && fin && fin > debut ? Math.min(0.97, Math.max(0.03, (maintenant - debut) / (fin - debut))) : null;
  const depassee = fin && maintenant > fin;

  return (
    <div className="ecran-maintenance" role="alertdialog" aria-labelledby="titre-maintenance">
      <div className="ecran-maintenance-carte">
        <div className="maintenance-anneau" aria-hidden="true">
          <svg viewBox="0 0 140 140">
            <defs>
              <linearGradient id="degrade-anneau" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1D5FA8" />
                <stop offset="60%" stopColor="#157A8C" />
                <stop offset="100%" stopColor="#1F8A54" />
              </linearGradient>
            </defs>
            <circle className="maintenance-piste" cx="70" cy="70" r={RAYON} />
            {avancement !== null && (
              <circle
                className="maintenance-progression" cx="70" cy="70" r={RAYON}
                strokeDasharray={CIRCONFERENCE} strokeDashoffset={CIRCONFERENCE * (1 - avancement)}
              />
            )}
            <circle className="maintenance-comete" cx="70" cy="70" r={RAYON} strokeDasharray={`${CIRCONFERENCE * 0.18} ${CIRCONFERENCE}`} />
          </svg>
          <span className="maintenance-logo"><img src={logoIcon} alt="" /></span>
          <span className="maintenance-cle"><IconWrench /></span>
        </div>

        <span className="maintenance-surtitre">Maintenance planifiée</span>
        <h1 id="titre-maintenance">Nous améliorons EduSphere</h1>
        <p className="ecran-maintenance-message">
          La plateforme est momentanément indisponible le temps d'une opération de maintenance.
          {maintenance.detail && maintenance.detail !== MESSAGE_PAR_DEFAUT ? ` ${maintenance.detail}` : ''}
        </p>

        {fin && (
          <div className="maintenance-retour">
            <div>
              <span>Retour prévu</span>
              <strong>{dateHeure(maintenance.finPrevue)}</strong>
            </div>
            <div>
              <span>{depassee ? 'Statut' : 'Temps restant'}</span>
              <strong>{depassee ? 'Finalisation en cours' : dureeRestante(fin - maintenant)}</strong>
            </div>
            {avancement !== null && (
              <div>
                <span>Avancement estimé</span>
                <strong>{Math.round(avancement * 100)} %</strong>
              </div>
            )}
          </div>
        )}

        <p className="ecran-maintenance-aide">
          Vos données et votre session sont préservées. Cette page se rouvrira d'elle-même dès la fin de la maintenance.
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
