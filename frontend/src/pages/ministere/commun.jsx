import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';

// Données nationales du ministère (agrégées par établissement, aucune
// donnée nominative), partagées par toutes les pages de l'espace.
export function useNational() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const charger = () => client.get('/ministere/vue-nationale')
    .then((r) => { setDonnees(r.data); setErreur(''); })
    .catch((e) => setErreur(messageErreur(e, 'données nationales indisponibles')));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true, delai: 1500 });
  return { donnees, erreur, recharger: charger };
}

export const pct = (v) => (v == null ? 'N/A' : `${String(v).replace('.', ',')} %`);
export const nombre = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const note = (n) => (n == null ? 'N/A' : String(Math.round(n * 100) / 100).replace('.', ','));
export const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const TONS_AGREMENT = { agree: 'vert', provisoire: 'bleu', en_instruction: 'or', suspendu: 'rouge', retire: 'rouge' };
export function BadgeAgrement({ statut, libelle }) {
  return <span className={`badge ${TONS_AGREMENT[statut] || 'gris'}`}>{libelle}</span>;
}

export function tonReussite(taux) {
  if (taux == null) return 'var(--texte-clair)';
  if (taux >= 70) return 'var(--succes)';
  if (taux >= 50) return 'var(--alerte)';
  return 'var(--erreur)';
}

// Barre horizontale à l'échelle 0-100 %, valeur écrite à droite.
export function BarreTaux({ libelle, taux, sousLibelle }) {
  return (
    <div className="barre-ligne">
      <span title={libelle}>{libelle}{sousLibelle && <small className="barre-sous-libelle">{sousLibelle}</small>}</span>
      <div className="barre-piste"><div className="barre-remplissage" style={{ width: `${taux || 0}%`, background: tonReussite(taux) }} /></div>
      <span>{pct(taux)}</span>
    </div>
  );
}

export function EtatChargement({ erreur }) {
  if (erreur) return <div className="message-erreur">{erreur}</div>;
  return <div className="chargement">Chargement des données nationales…</div>;
}
