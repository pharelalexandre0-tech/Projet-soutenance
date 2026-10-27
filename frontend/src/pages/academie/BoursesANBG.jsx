import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import BoutonDocument from '../../components/BoutonDocument';
import PiecesBourse from '../../components/PiecesBourse';
import Modal from '../../components/Modal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconSearch, IconDownload, IconChevronRight, IconGraduationCap } from '../../components/icons';

const STATUTS = { incomplet: ['Incomplet', 'gris'], soumis: ['À examiner', 'or'], a_corriger: ['À corriger', 'rouge'], valide: ['Validé', 'vert'] };

// Dossiers de bourse ANBG des étudiants : examen des pièces, validation ou
// demande de correction, liste Excel des boursiers pour l'agence.
export default function BoursesANBG() {
  const [donnees, setDonnees] = useState(null);
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/bourse/dossiers${statut ? `?statut=${statut}` : ''}`).then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || { dossiers: [], totaux: {} }));
  useEffect(() => { charger(); }, [statut]);
  useActualisation(charger, { domaines: ['bourse'] });

  const t = donnees?.totaux || {};
  const filtre = q.trim().toLowerCase();
  const liste = (donnees?.dossiers || []).filter((d) => !filtre || `${d.nom} ${d.prenom} ${d.matricule} ${d.numeroBoursier || ''}`.toLowerCase().includes(filtre));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile tile-or"><div className="stat-tile-haut"><span className="libelle">À examiner</span></div><div className="valeur">{t.soumis || 0}</div></div>
        <div className="stat-tile tile-vert"><div className="stat-tile-haut"><span className="libelle">Validés</span></div><div className="valeur">{t.valide || 0}</div></div>
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">En préparation</span></div><div className="valeur">{t.incomplet || 0}</div></div>
        <div className="stat-tile tile-rouge"><div className="stat-tile-haut"><span className="libelle">À corriger</span></div><div className="valeur">{t.a_corriger || 0}</div></div>
      </div>
      <section className="carte">
        <div className="entete-carte">
          <h2>Dossiers de bourse ANBG <span className="entete-carte-compteur">{liste.length}</span></h2>
          <BoutonDocument className="secondaire" chemin="/api/bourse/export"><IconDownload width={16} height={16} /> Liste des boursiers (Excel)</BoutonDocument>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche"><IconSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, matricule ou n° de boursier…" aria-label="Rechercher un dossier" /></label>
          <select className="filtre-select" value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut">
            <option value="">Tous les dossiers</option>
            {Object.entries(STATUTS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Étudiant</th><th>Matricule</th><th>Classe</th><th>N° boursier</th><th>Pièces obligatoires</th><th>À examiner</th><th>Statut</th><th aria-label="Ouvrir" /></tr></thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.eleveId} className="ligne-cliquable" onClick={() => setOuvert(d.eleveId)}>
                  <td className="cellule-nom">{d.nom} {d.prenom}</td>
                  <td className="mono">{d.matricule}</td>
                  <td>{d.classe}</td>
                  <td className="mono">{d.numeroBoursier || ''}</td>
                  <td className="cellule-nombre">{d.completude.presents}/{d.completude.obligatoires}</td>
                  <td className="cellule-nombre">{d.aExaminer}</td>
                  <td><span className={`badge ${STATUTS[d.statut][1]}`}>{STATUTS[d.statut][0]}</span></td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {donnees && liste.length === 0 && <tr><td colSpan={8} className="vide">Aucun dossier de bourse. Les étudiants le constituent depuis leur espace (rubrique « Bourse ANBG »).</td></tr>}
              {!donnees && <tr><td colSpan={8} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {ouvert && <DossierBourse eleveId={ouvert} onFermer={() => setOuvert(null)} onMaj={(m) => { if (m) setToast({ message: m, type: 'succes' }); charger(); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function DossierBourse({ eleveId, onFermer, onMaj }) {
  const [vue, setVue] = useState(null);
  const [refus, setRefus] = useState(null);
  const [decision, setDecision] = useState(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');

  const charger = () => client.get(`/bourse/dossiers/${eleveId}`).then((r) => setVue(r.data)).catch((e) => setErreur(messageErreur(e, 'dossier indisponible')));
  useEffect(() => { charger(); }, [eleveId]);

  async function examiner(piece, statut, commentaire) {
    try {
      await client.post(`/bourse/pieces/${piece.id}/examiner`, { statut, commentaire });
      setRefus(null);
      setTexte('');
      await charger();
      onMaj();
    } catch (e) {
      setErreur(messageErreur(e, 'examen impossible'));
    }
  }

  async function decider() {
    try {
      setVue({ ...vue, ...(await client.post(`/bourse/dossiers/${eleveId}/decision`, { statut: decision, observations: texte })).data });
      onMaj(decision === 'valide' ? 'Dossier validé, étudiant notifié' : 'Corrections demandées à l’étudiant');
      setDecision(null);
      setTexte('');
    } catch (e) {
      setErreur(messageErreur(e, 'décision impossible'));
      setDecision(null);
    }
  }

  const d = vue?.dossier;
  return (
    <Tiroir
      titre={vue ? `${vue.eleve.prenom} ${vue.eleve.nom}` : 'Dossier de bourse'}
      sousTitre={vue ? `${vue.eleve.matricule} · ${vue.eleve.classe}${d.numeroBoursier ? ` · boursier ${d.numeroBoursier}` : ''}` : ''}
      icone={<span className="tuile-fonctionnalite"><IconGraduationCap /></span>}
      onFermer={onFermer}
      pied={vue && d.statut !== 'valide' && (
        <>
          <button type="button" className="secondaire danger" onClick={() => setDecision('a_corriger')}>Demander une correction</button>
          <button type="button" className="primaire" disabled={vue.completude.valides < vue.completude.obligatoires} onClick={() => setDecision('valide')}>Valider le dossier</button>
        </>
      )}
    >
      {erreur && <div className="message-erreur">{erreur}</div>}
      {!vue && !erreur && <div className="chargement">Chargement…</div>}
      {vue && (
        <section className="tiroir-section">
          <p className="note-secondaire">
            <span className={`badge ${STATUTS[d.statut][1]}`}>{STATUTS[d.statut][0]}</span>{' '}
            {vue.completude.valides}/{vue.completude.obligatoires} pièces obligatoires validées{d.valideLe ? ` · validé le ${new Date(d.valideLe).toLocaleDateString('fr-FR')} par ${d.valideParNom}` : ''}
          </p>
          <PiecesBourse
            vue={vue}
            urlDepot={`/bourse/dossiers/${eleveId}/pieces`}
            onChange={async () => { await charger(); onMaj(); }}
            modifiable={d.statut !== 'valide'}
            examiner={(p, statut) => (statut === 'refuse' ? setRefus(p) : examiner(p, 'valide'))}
          />
        </section>
      )}
      {refus && (
        <Modal titre="Refuser la pièce" onFermer={() => setRefus(null)} largeur={460}>
          <div className="formulaire">
            <p className="confirmation-texte">{refus.nomFichier} : expliquez à l’étudiant ce qu’il doit fournir.</p>
            <div className="champ"><label htmlFor="b-motif">Motif</label><textarea id="b-motif" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Ex. document illisible, décision ANBG de l'année précédente" /></div>
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setRefus(null)}>Annuler</button>
              <button type="button" className="primaire" disabled={texte.trim().length < 5} onClick={() => examiner(refus, 'refuse', texte)}>Refuser la pièce</button>
            </div>
          </div>
        </Modal>
      )}
      {decision && (
        <Modal titre={decision === 'valide' ? 'Valider le dossier' : 'Demander une correction'} onFermer={() => setDecision(null)} largeur={460}>
          <div className="formulaire">
            <p className="confirmation-texte">{decision === 'valide' ? 'Le dossier sera inclus comme validé dans la liste transmise à l’ANBG et l’étudiant sera prévenu.' : 'Le dossier redevient modifiable pour l’étudiant, qui reçoit vos observations.'}</p>
            <div className="champ"><label htmlFor="b-obs">Observations{decision === 'a_corriger' ? '' : ' (facultatif)'}</label><textarea id="b-obs" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setDecision(null)}>Annuler</button>
              <button type="button" className="primaire" disabled={decision === 'a_corriger' && texte.trim().length < 5} onClick={decider}>Confirmer</button>
            </div>
          </div>
        </Modal>
      )}
    </Tiroir>
  );
}
