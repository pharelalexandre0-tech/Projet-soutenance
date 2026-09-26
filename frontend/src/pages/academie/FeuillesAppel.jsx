import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import DetailCompteRendu from '../../components/DetailCompteRendu';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconClipboard, IconCircleCheck, IconCalendarAlert, IconClock, IconSearch, IconChevronRight } from '../../components/icons';

function dateCourte(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Feuilles d'appel envoyées par les professeurs depuis leur accès
// temporaire (Comptes éphémères) : où elles arrivent, pour l'Académie.
export default function FeuillesAppel() {
  const [appels, setAppels] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes)).catch(() => {});
    client.get('/comptes-ephemeres/comptes-rendus', { params: { tache: 'saisie_absences' } })
      .then((res) => setAppels(res.data.comptesRendus))
      .catch((err) => { setAppels((a) => a || []); setToast({ message: messageErreur(err, 'impossible de charger les feuilles d’appel'), type: 'erreur' }); });
  }
  useEffect(charger, []);
  useActualisation(charger);

  async function ouvrir(a) {
    try {
      const res = await client.get(`/comptes-ephemeres/comptes-rendus/${a.id}`);
      setDetail(res.data.compteRendu);
    } catch (err) {
      setToast({ message: messageErreur(err, 'impossible d’ouvrir cette feuille d’appel'), type: 'erreur' });
    }
  }

  const liste = appels || [];
  const r = recherche.trim().toLowerCase();
  const affiches = liste
    .filter((a) => !classeId || String(a.classeId) === classeId)
    .filter((a) => !r || `${a.professeur} ${a.classe}`.toLowerCase().includes(r));
  const total = (cle) => liste.reduce((s, a) => s + (a.resume?.[cle] || 0), 0);
  const effectifTotal = liste.reduce((s, a) => s + (a.effectif || 0), 0);
  const tauxPresence = effectifTotal ? Math.round((total('presents') / effectifTotal) * 100) : null;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Appels reçus</span><span className="puce-icone petite"><IconClipboard /></span></div>
          <div className="valeur">{appels ? liste.length : '…'}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Taux de présence</span><span className="puce-icone petite"><IconCircleCheck /></span></div>
          <div className="valeur">{tauxPresence !== null ? `${tauxPresence} %` : '…'}</div>
        </div>
        <div className={`stat-tile ${total('absents') ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Absences signalées</span><span className="puce-icone petite"><IconCalendarAlert /></span></div>
          <div className="valeur">{appels ? total('absents') : '…'}</div>
        </div>
        <div className={`stat-tile ${total('retards') ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Retards signalés</span><span className="puce-icone petite"><IconClock /></span></div>
          <div className="valeur">{appels ? total('retards') : '…'}</div>
        </div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Feuilles d'appel <span className="entete-carte-compteur">{affiches.length}</span></h2>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un professeur, une classe…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher une feuille d'appel" />
          </label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Filtrer par classe" className="filtre-select">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table className="table-appels">
            <thead>
              <tr><th>Séance</th><th>Classe</th><th>Professeur</th><th className="chiffre">Présents</th><th className="chiffre">Absents</th><th className="chiffre">Retards</th><th>Reçue le</th><th aria-label="Voir" /></tr>
            </thead>
            <tbody>
              {affiches.map((a) => (
                <tr key={a.id} className="ligne-cliquable" onClick={() => ouvrir(a)}>
                  <td className="cellule-nom">{dateCourte(a.date)}</td>
                  <td>{a.classe}</td>
                  <td>{a.professeur || <span className="note-secondaire">Professeur retiré</span>}</td>
                  <td className="chiffre ton-reussite">{a.resume?.presents ?? 0}<span className="note-secondaire"> / {a.effectif}</span></td>
                  <td className="chiffre">{a.resume?.absents ? <span className="badge rouge">{a.resume.absents}</span> : <span className="note-secondaire">0</span>}</td>
                  <td className="chiffre">{a.resume?.retards ? <span className="badge or">{a.resume.retards}</span> : <span className="note-secondaire">0</span>}</td>
                  <td className="note-secondaire">{new Date(a.envoyeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {appels && affiches.length === 0 && (
                <tr>
                  <td colSpan={8} className="vide">
                    {liste.length === 0
                      ? "Aucune feuille d'appel reçue. Ouvrez un accès « Faire l'appel » à un professeur depuis Comptes éphémères : sa feuille arrivera ici dès qu'il l'enverra."
                      : 'Aucune feuille ne correspond.'}
                  </td>
                </tr>
              )}
              {!appels && <tr><td colSpan={8} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {detail && <DetailCompteRendu compteRendu={detail} onFermer={() => setDetail(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
