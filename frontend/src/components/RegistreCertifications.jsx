import { useEffect, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import Modal from './Modal';
import Toast from './Toast';
import { IconSearch, IconShield, IconExternal, IconCopy } from './icons';

const STATUTS = {
  valide: { libelle: 'En vigueur', classe: 'vert' },
  remplace: { libelle: 'Remplacé', classe: 'or' },
  annule: { libelle: 'Annulé', classe: 'rouge' },
};

const dateCourte = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// Registre des documents officiels émis par l'école : chaque PDF porte un
// code et un QR code vérifiables sur la page publique /verifier. Un document
// émis par erreur peut être annulé : la vérification l'affiche alors comme
// annulé, avec le motif.
export default function RegistreCertifications({ actualiser = 0 }) {
  const [donnees, setDonnees] = useState(null);
  const [filtres, setFiltres] = useState({ type: '', statut: '', q: '' });
  const [aAnnuler, setAAnnuler] = useState(null);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  function charger() {
    const params = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v)).toString();
    return client.get(`/certifications${params ? `?${params}` : ''}`).then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || { documents: [], totaux: {}, types: [] }));
  }
  useEffect(() => {
    const minuteur = setTimeout(charger, filtres.q ? 300 : 0);
    return () => clearTimeout(minuteur);
  }, [filtres.type, filtres.statut, filtres.q, actualiser]);
  useActualisation(charger, { domaines: ['certifications', 'bulletins', 'finance', 'documents'] });

  async function annuler() {
    setEnCours(true);
    setErreur('');
    try {
      await client.post(`/certifications/${aAnnuler.code}/annuler`, { motif });
      setToast({ message: `Document ${aAnnuler.code} annulé`, type: 'succes' });
      setAAnnuler(null);
      setMotif('');
      charger();
    } catch (e) {
      setErreur(e.response?.data?.erreur || 'annulation impossible, réessayez');
    } finally {
      setEnCours(false);
    }
  }

  function copier(code) {
    navigator.clipboard?.writeText(code).then(() => setToast({ message: `Code ${code} copié`, type: 'succes' }), () => {});
  }

  const documents = donnees?.documents || [];
  const totaux = donnees?.totaux || {};

  return (
    <section className="carte registre-certifications">
      <div className="entete-carte">
        <h2><IconShield /> Documents certifiés émis <span className="entete-carte-compteur">{documents.length}</span></h2>
        <span className="note-secondaire">
          {totaux.valide || 0} en vigueur · {totaux.remplace || 0} remplacé{(totaux.remplace || 0) > 1 ? 's' : ''} · {totaux.annule || 0} annulé{(totaux.annule || 0) > 1 ? 's' : ''}
        </span>
      </div>
      <p className="carte-document-texte">
        Chaque document PDF porte un QR code et un code de vérification signés. Toute personne qui le reçoit peut confirmer
        son authenticité sur la page publique <a href="/verifier" target="_blank" rel="noreferrer">Vérifier un document</a>.
        Une nouvelle version (notes modifiées) remplace automatiquement la précédente.
      </p>
      <div className="barre-outils">
        <label className="champ-recherche">
          <IconSearch />
          <input type="search" placeholder="Titulaire, titre ou code…" value={filtres.q} onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} aria-label="Rechercher un document" />
        </label>
        <select className="filtre-select" value={filtres.type} onChange={(e) => setFiltres({ ...filtres, type: e.target.value })} aria-label="Type de document">
          <option value="">Tous les types</option>
          {(donnees?.types || []).map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <select className="filtre-select" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.libelle}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table className="table-registre">
          <thead>
            <tr><th>Code</th><th>Document</th><th>Titulaire</th><th>Émis le</th><th>Émis par</th><th>Vérifications</th><th>Statut</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.code}>
                <td>
                  <button type="button" className="code-certification" onClick={() => copier(d.code)} title="Copier le code">
                    {d.code} <IconCopy />
                  </button>
                </td>
                <td className="cellule-titre">{d.titre}</td>
                <td>{d.titulaire || <span className="note-secondaire">Collectif</span>}</td>
                <td className="cellule-date">{dateCourte(d.emisLe)}</td>
                <td>{d.emisPar || <span className="note-secondaire">Automatique</span>}</td>
                <td className="cellule-nombre">{d.nombreVerifications}</td>
                <td>
                  <span className={`badge ${STATUTS[d.statut]?.classe}`} title={d.motifAnnulation || undefined}>{STATUTS[d.statut]?.libelle}</span>
                </td>
                <td className="cellule-actions">
                  <a className="bouton-icone" href={`/verifier/${d.code}`} target="_blank" rel="noreferrer" title="Ouvrir la page de vérification" aria-label="Ouvrir la page de vérification"><IconExternal /></a>
                  {d.statut !== 'annule' && (
                    <button type="button" className="secondaire petit danger" onClick={() => { setAAnnuler(d); setMotif(''); setErreur(''); }}>Annuler</button>
                  )}
                </td>
              </tr>
            ))}
            {donnees && documents.length === 0 && (
              <tr><td colSpan={8} className="vide">Aucun document certifié pour ces critères. Ils apparaissent ici dès le premier téléchargement.</td></tr>
            )}
            {!donnees && <tr><td colSpan={8} className="chargement">Chargement…</td></tr>}
          </tbody>
        </table>
      </div>

      {aAnnuler && (
        <Modal titre="Annuler ce document" onFermer={() => setAAnnuler(null)} largeur={460}>
          <p className="confirmation-texte">
            <strong>{aAnnuler.titre}</strong>{aAnnuler.titulaire ? `, ${aAnnuler.titulaire}` : ''} (code {aAnnuler.code}).
            La page de vérification l’indiquera comme annulé, avec le motif ci-dessous. Cette annulation est définitive.
          </p>
          <div className="champ">
            <label htmlFor="motif-annulation">Motif de l’annulation</label>
            <textarea id="motif-annulation" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. Document émis par erreur, note corrigée après délibération" maxLength={300} />
          </div>
          {erreur && <div className="message-erreur" style={{ marginBottom: 14 }}>{erreur}</div>}
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={() => setAAnnuler(null)} disabled={enCours}>Retour</button>
            <button type="button" className="danger secondaire" onClick={annuler} disabled={enCours || motif.trim().length < 5}>
              {enCours ? 'Annulation…' : 'Annuler le document'}
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </section>
  );
}
