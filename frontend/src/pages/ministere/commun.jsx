import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';
import BoutonDocument from '../../components/BoutonDocument';
import { IconDownload } from '../../components/icons';

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

// Téléchargement d'un document officiel en PDF certifié et en Excel.
export function Telechargements({ chemin, libelle = 'Télécharger' }) {
  const sep = chemin.includes('?') ? '&' : '?';
  return (
    <div className="telechargements" role="group" aria-label={libelle}>
      <BoutonDocument className="secondaire" chemin={`${chemin}${sep}format=pdf`}><IconDownload width={16} height={16} /> PDF certifié</BoutonDocument>
      <BoutonDocument className="secondaire" chemin={`${chemin}${sep}format=xlsx`}><IconDownload width={16} height={16} /> Excel</BoutonDocument>
    </div>
  );
}

export const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
export const STATUTS_HABILITATION = { habilitee: ['Habilitée', 'vert'], en_renouvellement: ['En renouvellement', 'or'], suspendue: ['Suspendue', 'rouge'], retiree: ['Retirée', 'gris'] };
export const NATURES_INSPECTION = { pedagogique: 'Pédagogique', administrative: 'Administrative', financiere: 'Financière', conformite: 'Conformité' };
export const STATUTS_INSPECTION = { programmee: ['Programmée', 'bleu'], realisee: ['Rapport rendu', 'or'], cloturee: ['Clôturée', 'vert'], annulee: ['Annulée', 'gris'] };
export const AVIS = { favorable: ['Favorable', 'vert'], reserves: ['Avec réserves', 'or'], defavorable: ['Défavorable', 'rouge'] };
export const STATUTS_RECO = { a_faire: ['À mettre en œuvre', 'rouge'], en_cours: ['En cours', 'or'], realisee: ['Réalisée', 'vert'] };
export const NATURES_CALENDRIER = { rentree: 'Rentrée', cours: 'Cours', examens: 'Examens', deliberations: 'Délibérations', rattrapage: 'Rattrapage', vacances: 'Vacances', autre: 'Autre' };
export const dateCourte = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
