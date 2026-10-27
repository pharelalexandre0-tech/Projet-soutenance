import { useEffect, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import { messageErreur } from '../utils/erreurs';
import { IconSearch, IconShield, IconShieldX, IconFingerprint } from './icons';

const ACTIONS = {
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  connexion: 'Connexion',
  connexion_refusee: 'Connexion refusée',
  compte_bloque_temporairement: 'Compte bloqué 15 min',
  code_email_epuise: 'Code e-mail épuisé',
  double_facteur_active: 'Double authentification activée',
  double_facteur_reconfigure: 'Téléphone changé',
  codes_secours_regeneres: 'Codes de secours renouvelés',
  code_secours_utilise: 'Code de secours utilisé',
  session_fermee: 'Appareil déconnecté',
  sessions_fermees: 'Autres appareils déconnectés',
  mot_de_passe_change: 'Mot de passe changé',
  mot_de_passe_reinitialise: 'Mot de passe réinitialisé',
  reinitialisation_demandee: 'Réinitialisation demandée',
  email_change: 'E-mail changé',
  compte_cree: 'Compte créé',
  acces_academie_reinitialise: 'Accès Académie réinitialisé',
};
const SENSIBLES = new Set(['connexion_refusee', 'compte_bloque_temporairement', 'code_email_epuise', 'code_secours_utilise', 'suppression', 'acces_academie_reinitialise']);
const ROLES = { superadmin: 'Superadmin', academie: 'Académie', finance: 'Finance', etudiant: 'Étudiant' };

const horodatage = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Journal d'audit chaîné : chaque ligne porte l'empreinte de la précédente.
// `plateforme` : vue superadmin (toutes les écoles, filtre par école).
export default function JournalAudit({ plateforme = false }) {
  const [entrees, setEntrees] = useState(null);
  const [suite, setSuite] = useState(null);
  const [filtres, setFiltres] = useState({ action: '', q: '', etablissementId: '' });
  const [ecoles, setEcoles] = useState([]);
  const [integrite, setIntegrite] = useState(null);
  const [controle, setControle] = useState(false);
  const [erreur, setErreur] = useState('');

  const parametres = (avant) => new URLSearchParams(Object.entries({ ...filtres, avant }).filter(([, v]) => v)).toString();

  function charger() {
    return client.get(`/audit?${parametres()}`)
      .then((r) => { setEntrees(r.data.entrees); setSuite(r.data.suite); setErreur(''); })
      .catch((e) => setErreur(messageErreur(e, 'journal indisponible')));
  }
  useEffect(() => {
    const minuteur = setTimeout(charger, filtres.q ? 300 : 0);
    return () => clearTimeout(minuteur);
  }, [filtres.action, filtres.q, filtres.etablissementId]);
  useActualisation(charger, { plateforme });
  useEffect(() => {
    if (plateforme) client.get('/superadmin/etablissements').then((r) => setEcoles(r.data.etablissements || [])).catch(() => {});
  }, [plateforme]);

  async function plusAnciennes() {
    const r = await client.get(`/audit?${parametres(suite)}`);
    setEntrees((e) => [...e, ...r.data.entrees]);
    setSuite(r.data.suite);
  }

  async function verifier() {
    setControle(true);
    try {
      setIntegrite((await client.get('/audit/integrite')).data);
    } catch (e) {
      setIntegrite({ erreur: messageErreur(e, 'contrôle impossible') });
    } finally {
      setControle(false);
    }
  }

  return (
    <section className="carte journal-audit">
      <div className="entete-carte">
        <h2><IconFingerprint /> Journal d’audit</h2>
        <button type="button" className="secondaire" onClick={verifier} disabled={controle}>
          <IconShield /> {controle ? 'Contrôle en cours…' : 'Contrôler l’intégrité'}
        </button>
      </div>
      <p className="carte-document-texte">
        Connexions, refus, changements de sécurité et chaque création, modification ou suppression de données
        {plateforme ? ' sur toute la plateforme' : ' dans votre établissement'}. Chaque entrée est scellée avec
        l’empreinte de la précédente : une ligne effacée ou modifiée après coup est détectée par le contrôle.
      </p>
      {integrite && !integrite.erreur && (
        <div className={`etat-integrite ${integrite.integre ? 'ok' : 'refus'}`} role="status">
          {integrite.integre ? <IconShield /> : <IconShieldX />}
          <span>
            {integrite.integre
              ? `Journal intègre : ${integrite.entrees} entrées vérifiées, aucune altération.`
              : `Altération détectée à l’entrée n° ${integrite.rupture.id} (${integrite.rupture.raison}), après ${integrite.entrees} entrées intactes.`}
          </span>
        </div>
      )}
      {integrite?.erreur && <div className="message-erreur">{integrite.erreur}</div>}
      <div className="barre-outils">
        <label className="champ-recherche">
          <IconSearch />
          <input type="search" placeholder="Auteur, ressource ou adresse IP…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher dans le journal" />
        </label>
        <select className="filtre-select" value={filtres.action} onChange={(e) => setFiltres({ ...filtres, action: e.target.value })} aria-label="Type d’événement">
          <option value="">Tous les événements</option>
          {Object.entries(ACTIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {plateforme && (
          <select className="filtre-select" value={filtres.etablissementId} onChange={(e) => setFiltres({ ...filtres, etablissementId: e.target.value })} aria-label="École">
            <option value="">Toutes les écoles</option>
            <option value="plateforme">Plateforme (superadmin)</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
      </div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <div className="table-scroll">
        <table className="table-audit">
          <thead>
            <tr>
              <th>N°</th><th>Date et heure</th><th>Événement</th><th>Auteur</th><th>Rôle</th>
              {plateforme && <th>École</th>}
              <th>Ressource</th><th>Adresse IP</th><th>Empreinte</th>
            </tr>
          </thead>
          <tbody>
            {(entrees || []).map((e) => (
              <tr key={e.id}>
                <td className="cellule-nombre">{e.id}</td>
                <td>{horodatage(e.horodatage)}</td>
                <td><span className={`badge ${SENSIBLES.has(e.action) ? 'or' : e.action === 'connexion' ? 'vert' : 'gris'} sans-point`}>{ACTIONS[e.action] || e.action}</span></td>
                <td>{e.auteur || <span className="note-secondaire">Accès temporaire</span>}</td>
                <td>{ROLES[e.role] || <span className="note-secondaire">Professeur</span>}</td>
                {plateforme && <td>{e.ecole || <span className="note-secondaire">Plateforme</span>}</td>}
                <td className="cellule-ressource">{e.cible}</td>
                <td className="mono">{e.ip}</td>
                <td className="mono note-secondaire" title={e.empreinte}>{e.empreinte.slice(0, 12)}…</td>
              </tr>
            ))}
            {entrees && entrees.length === 0 && <tr><td colSpan={plateforme ? 9 : 8} className="vide">Aucun événement pour ces critères.</td></tr>}
            {!entrees && !erreur && <tr><td colSpan={plateforme ? 9 : 8} className="chargement">Chargement…</td></tr>}
          </tbody>
        </table>
      </div>
      {suite && <button type="button" className="secondaire bouton-plus" onClick={plusAnciennes}>Entrées plus anciennes</button>}
    </section>
  );
}
