import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import BoutonDocument from '../../components/BoutonDocument';
import { messageErreur } from '../../utils/erreurs';
import { IconDownload, IconSearch, IconCopy } from '../../components/icons';

const STATUTS = {
  deposee: ['Nouveau', 'bleu'], en_examen: ['En étude', 'bleu'], piece_demandee: ['Pièce demandée', 'or'], liste_attente: ['Liste d’attente', 'or'],
  acceptee: ['Accepté', 'vert'], refusee: ['Refusé', 'rouge'], inscrite: ['Inscrit', 'gris'],
};
const PROFILS = { bachelier: 'Nouveau bachelier', licence: 'Étudiant en Licence', master: 'Candidat en Master' };
const PIECES = { identite: 'Pièce d’identité', naissance: 'Acte de naissance', photo: 'Photo', diplome: 'Diplôme', releve: 'Relevé de notes', cv: 'CV', motivation: 'Lettre de motivation', autre: 'Autre pièce' };
const FILTRES = [
  ['a_etudier', 'À étudier', (d) => ['deposee', 'en_examen'].includes(d.statut)],
  ['piece_demandee', 'Pièce demandée', (d) => d.statut === 'piece_demandee'],
  ['liste_attente', 'Liste d’attente', (d) => d.statut === 'liste_attente'],
  ['acceptee', 'Acceptés', (d) => d.statut === 'acceptee'],
  ['inscrite', 'Inscrits', (d) => d.statut === 'inscrite'],
  ['refusee', 'Refusés', (d) => d.statut === 'refusee'],
  ['tous', 'Tous', () => true],
];
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

function parcoursDe(d) {
  if (d.profil === 'bachelier') return `Bac ${d.serieBac || ''} ${d.anneeDiplome || ''}${d.mentionDiplome ? `, ${d.mentionDiplome}` : ''}`.trim();
  if (d.profil === 'licence') return `${d.dernierNiveauValide || ''} validée${d.creditsAcquis != null ? `, ${d.creditsAcquis} cr.` : ''}`;
  if (d.profil === 'master') return `Licence ${d.specialiteLicence || ''}${d.moyenneDiplome != null ? `, ${String(d.moyenneDiplome).replace('.', ',')}/20` : ''}`;
  return d.diplomeAcces || '';
}

// Candidatures en ligne reçues par l'établissement : compteurs, filtres par
// profil et formation, sélection multiple et décisions groupées, dossier
// détaillé avec ses pièces.
export default function Candidatures() {
  const [donnees, setDonnees] = useState(null);
  const [classes, setClasses] = useState([]);
  const [filtre, setFiltre] = useState('a_etudier');
  const [profil, setProfil] = useState('');
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState(new Set());
  const [ouvert, setOuvert] = useState(null);
  const [lot, setLot] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/preinscriptions').then((r) => setDonnees(r.data)).catch(() => setDonnees({ dossiers: [], formations: [] }));
  useEffect(() => { charger(); client.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {}); }, []);
  useActualisation(charger, { domaines: ['preinscriptions', 'preinscriptions-publiques'] });

  const q = recherche.trim().toLowerCase();
  const liste = useMemo(() => {
    if (!donnees) return [];
    const test = FILTRES.find(([cle]) => cle === filtre)[2];
    return donnees.dossiers.filter((d) => test(d) && (!profil || d.profil === profil) && (!q || `${d.nom} ${d.prenom} ${d.numero} ${d.email}`.toLowerCase().includes(q)));
  }, [donnees, filtre, profil, q]);

  if (!donnees) return <div className="chargement">Chargement…</div>;
  const formation = (id) => donnees.formations.find((f) => f.id === id);
  const lien = `${window.location.origin}/preinscription`;
  const tousCoches = liste.length > 0 && liste.every((d) => choisis.has(d.id));
  const basculer = (id) => setChoisis((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fini = (message) => { setToast({ message, type: 'succes' }); setOuvert(null); setLot(null); setChoisis(new Set()); charger(); };

  return (
    <>
      <section className="carte encart-candidatures">
        <div>
          <strong>Lien de candidature à diffuser</strong>
          <p className="note-secondaire" style={{ margin: '2px 0 0' }}>Les candidats choisissent leur profil (bachelier, Licence, Master) et suivent ensuite leur dossier avec leur numéro.</p>
        </div>
        <span className="lien-candidature mono">{lien}</span>
        <button type="button" className="secondaire" onClick={() => { navigator.clipboard?.writeText(lien); setToast({ message: 'Lien copié.', type: 'succes' }); }}><IconCopy width={14} height={14} /> Copier</button>
      </section>

      <div className="compteurs-candidatures">
        {FILTRES.filter(([cle]) => cle !== 'tous').map(([cle, libelle, test]) => (
          <button key={cle} type="button" className={`compteur-candidature ${filtre === cle ? 'actif' : ''}`} onClick={() => { setFiltre(cle); setChoisis(new Set()); }}>
            <span>{libelle}</span><strong>{donnees.dossiers.filter(test).length}</strong>
          </button>
        ))}
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>{FILTRES.find(([c]) => c === filtre)[1]} <span className="entete-carte-compteur">{liste.length}</span></h2>
          <button type="button" className="bouton-texte" onClick={() => { setFiltre('tous'); setChoisis(new Set()); }}>Voir tous les dossiers</button>
        </div>
        <div className="barre-outils envoi-groupe-barre">
          <label className="champ-recherche"><IconSearch /><input type="search" placeholder="Nom, numéro ou e-mail…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un dossier" /></label>
          <select className="filtre-select" value={profil} onChange={(e) => setProfil(e.target.value)} aria-label="Profil">
            <option value="">Tous les profils</option>
            {Object.entries(PROFILS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {choisis.size > 0 && <span className="badge bleu">{choisis.size} sélectionné{choisis.size > 1 ? 's' : ''}</span>}
        </div>
        {choisis.size > 0 && (
          <div className="actions-lot">
            <button type="button" className="primaire" onClick={() => setLot('acceptee')}>Accepter ({choisis.size})</button>
            <button type="button" className="secondaire" onClick={() => setLot('en_examen')}>Mettre en étude</button>
            <button type="button" className="secondaire" onClick={() => setLot('liste_attente')}>Liste d’attente</button>
            <button type="button" className="secondaire danger" onClick={() => setLot('refusee')}>Refuser</button>
          </div>
        )}
        {liste.length === 0 ? <div className="vide">Aucun dossier dans cette catégorie.</div> : (
          <div className="table-scroll"><table>
            <thead><tr>
              <th style={{ width: 40 }}><input type="checkbox" aria-label="Tout sélectionner" checked={tousCoches} onChange={() => setChoisis(tousCoches ? new Set() : new Set(liste.map((d) => d.id)))} /></th>
              <th>N° de dossier</th><th>Candidat</th><th>Profil</th><th>Niveau demandé</th><th>Formation</th><th>Parcours</th><th className="cellule-nombre">Pièces</th><th>Déposé le</th><th>Statut</th><th aria-label="Ouvrir" />
            </tr></thead>
            <tbody>{liste.map((d) => {
              const f = formation(d.formationId);
              return (
                <tr key={d.id}>
                  <td><input type="checkbox" aria-label={`Sélectionner ${d.prenom} ${d.nom}`} checked={choisis.has(d.id)} onChange={() => basculer(d.id)} /></td>
                  <td className="mono">{d.numero}</td>
                  <td className="cellule-nom">{String(d.nom).toUpperCase()} {d.prenom}</td>
                  <td>{PROFILS[d.profil] || 'Non précisé'}</td>
                  <td>{d.niveauDemande}</td>
                  <td>{f ? [f.mention, f.parcours].filter(Boolean).join(', ') : ''}</td>
                  <td>{parcoursDe(d)}</td>
                  <td className="cellule-nombre">{d.pieces.length}</td>
                  <td>{dateFr(d.createdAt)}</td>
                  <td><span className={`badge ${STATUTS[d.statut]?.[1] || 'gris'}`}>{STATUTS[d.statut]?.[0] || d.statut}</span></td>
                  <td className="cellule-actions"><button type="button" className="secondaire" onClick={() => setOuvert(d)}>Ouvrir</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>

      {ouvert && <Dossier d={ouvert} formation={formation(ouvert.formationId)} classes={classes} onFermer={() => setOuvert(null)} onFait={fini} />}
      {lot && <DecisionLot statut={lot} ids={[...choisis]} classes={classes} onFermer={() => setLot(null)} onFait={fini} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

// Champs de décision partagés (dossier seul ou lot).
function ChampsAcceptation({ classes, valeurs, onChange }) {
  return (
    <div className="ligne-champs">
      <div className="champ"><label htmlFor="cand-classe">Classe d’inscription</label>
        <select id="cand-classe" value={valeurs.classeId} onChange={(e) => onChange({ ...valeurs, classeId: e.target.value })}>
          <option value="">Choisir une classe</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
        </select>
      </div>
      <div className="champ" style={{ maxWidth: 220 }}><label htmlFor="cand-frais">Frais d’inscription (FCFA)</label><input id="cand-frais" type="number" min="0" placeholder="0 si aucun" value={valeurs.fraisInscription} onChange={(e) => onChange({ ...valeurs, fraisInscription: e.target.value })} /></div>
    </div>
  );
}

function Dossier({ d, formation, classes, onFermer, onFait }) {
  const [action, setAction] = useState('');
  const [valeurs, setValeurs] = useState({ classeId: d.classeId ? String(d.classeId) : '', fraisInscription: d.fraisInscription != null ? String(d.fraisInscription) : '', commentaire: '', pieceDemandee: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const termine = d.statut === 'inscrite';

  async function valider() {
    if (action === 'acceptee' && !valeurs.classeId) { setErreur('choisissez la classe d’inscription'); return; }
    if (action === 'piece_demandee' && !valeurs.pieceDemandee.trim()) { setErreur('précisez la pièce demandée'); return; }
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/preinscriptions/${d.id}`, { statut: action, ...valeurs });
      onFait({ acceptee: 'Dossier accepté : le candidat reçoit le lien pour s’inscrire en ligne.', piece_demandee: 'Pièce demandée : le candidat est prévenu par e-mail.', liste_attente: 'Dossier placé sur liste d’attente.', refusee: 'Dossier refusé : le candidat est prévenu.', en_examen: 'Dossier mis en étude.' }[action]);
    } catch (err) {
      setErreur(messageErreur(err, 'action impossible'));
      setEnCours(false);
    }
  }
  async function inscrireDirectement() {
    setEnCours(true);
    try { await client.post(`/preinscriptions/${d.id}/inscrire`, { classeId: valeurs.classeId }); onFait(`${d.prenom} ${d.nom} est inscrit(e) : compte et matricule créés.`); } catch (err) { setErreur(messageErreur(err, 'inscription impossible')); setEnCours(false); }
  }

  return (
    <Modal titre={`${d.prenom} ${String(d.nom).toUpperCase()}`} onFermer={onFermer} largeur={760}>
      <div className="formulaire">
        <div className="suivi-tete">
          <p className="note-secondaire" style={{ margin: 0 }}>Dossier <span className="mono">{d.numero}</span> · déposé le {dateFr(d.createdAt)} · {PROFILS[d.profil] || 'Profil non précisé'}</p>
          <span className={`badge ${STATUTS[d.statut]?.[1]}`}>{STATUTS[d.statut]?.[0]}</span>
        </div>
        <h3 style={{ margin: '4px 0 0' }}>Candidature</h3>
        <dl className="fiche-dossier">
          <div><dt>Niveau demandé</dt><dd>{d.niveauDemande}</dd></div>
          <div><dt>Formation</dt><dd>{formation ? [formation.mention, formation.parcours].filter(Boolean).join(', ') : 'Non précisée'}</dd></div>
          <div><dt>E-mail</dt><dd>{d.email}</dd></div>
          <div><dt>Téléphone</dt><dd>{d.telephone || '-'}</dd></div>
          <div><dt>Naissance</dt><dd>{dateFr(d.dateNaissance) || '-'}{d.sexe ? ` (${d.sexe})` : ''}</dd></div>
          <div><dt>Nationalité, ville</dt><dd>{[d.nationalite, d.villeResidence].filter(Boolean).join(', ') || '-'}</dd></div>
        </dl>
        <h3 style={{ margin: '4px 0 0' }}>Parcours</h3>
        <dl className="fiche-dossier">
          {d.profil === 'bachelier' && <><div><dt>Baccalauréat</dt><dd>Série {d.serieBac || '-'}, {d.anneeDiplome || '-'}</dd></div><div><dt>Mention</dt><dd>{d.mentionDiplome || 'Sans mention'}</dd></div><div><dt>N° de table</dt><dd>{d.numeroTable || '-'}</dd></div><div><dt>Lycée</dt><dd>{d.etablissementOrigine || '-'}</dd></div></>}
          {d.profil === 'licence' && <><div><dt>Établissement actuel</dt><dd>{d.etablissementOrigine || '-'}</dd></div><div><dt>Filière</dt><dd>{d.filiereActuelle || '-'}</dd></div><div><dt>Dernier niveau validé</dt><dd>{d.dernierNiveauValide || '-'}</dd></div><div><dt>Crédits acquis</dt><dd>{d.creditsAcquis ?? '-'}</dd></div></>}
          {d.profil === 'master' && <><div><dt>Licence</dt><dd>{d.specialiteLicence || '-'}, {d.anneeDiplome || '-'}</dd></div><div><dt>Moyenne, mention</dt><dd>{d.moyenneDiplome != null ? `${String(d.moyenneDiplome).replace('.', ',')}/20` : '-'}{d.mentionDiplome ? `, ${d.mentionDiplome}` : ''}</dd></div><div><dt>Établissement</dt><dd>{d.etablissementOrigine || '-'}</dd></div></>}
          {!d.profil && <div><dt>Diplôme d’accès</dt><dd>{[d.diplomeAcces, d.anneeDiplome].filter(Boolean).join(', ') || '-'}</dd></div>}
        </dl>
        {d.motivation && <div className="encadre-texte"><strong>Motivation</strong><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{d.motivation}</p></div>}
        <h3 style={{ margin: '4px 0 0' }}>Pièces ({d.pieces.length})</h3>
        {d.pieces.length === 0 ? <p className="note-secondaire" style={{ margin: 0 }}>Aucune pièce jointe.</p> : (
          <div className="puces">{d.pieces.map((p) => <BoutonDocument key={p.id} className="secondaire" chemin={`/api/preinscriptions/pieces/${p.id}`} nomFichier={p.nomFichier}><IconDownload width={14} height={14} /> {PIECES[p.type] || p.type}</BoutonDocument>)}</div>
        )}
        {d.statut === 'piece_demandee' && d.pieceDemandee && <p className="note-secondaire" style={{ margin: 0 }}>Pièce demandée au candidat : {d.pieceDemandee}</p>}

        {!termine && (
          <>
            <h3 style={{ margin: '8px 0 0' }}>Décision</h3>
            <div className="choix-decision" role="radiogroup" aria-label="Décision">
              {[['acceptee', d.statut === 'acceptee' ? 'Renvoyer le lien' : 'Accepter'], ['piece_demandee', 'Demander une pièce'], ['liste_attente', 'Liste d’attente'], ['refusee', 'Refuser'], ['en_examen', 'Mettre en étude']].map(([cle, libelle]) => (
                <button key={cle} type="button" role="radio" aria-checked={action === cle} className={`decision ${action === cle ? 'choisi' : ''} ${cle === 'refusee' ? 'danger' : ''}`} onClick={() => { setAction(cle); setErreur(''); }}>{libelle}</button>
              ))}
            </div>
            {action === 'acceptee' && <ChampsAcceptation classes={classes} valeurs={valeurs} onChange={setValeurs} />}
            {action === 'piece_demandee' && <div className="champ"><label htmlFor="cand-piece">Pièce demandée</label><input id="cand-piece" placeholder="Relevé de notes de Licence 2 lisible" value={valeurs.pieceDemandee} onChange={(e) => setValeurs({ ...valeurs, pieceDemandee: e.target.value })} /></div>}
            {action && action !== 'en_examen' && <div className="champ"><label htmlFor="cand-com">{action === 'refusee' ? 'Motif (envoyé au candidat)' : 'Message au candidat (facultatif)'}</label><textarea id="cand-com" rows={2} value={valeurs.commentaire} onChange={(e) => setValeurs({ ...valeurs, commentaire: e.target.value })} /></div>}
            {d.statut === 'acceptee' && valeurs.classeId && <p className="note-secondaire" style={{ margin: 0 }}>Le candidat est venu sur place ? <button type="button" className="lien-texte" disabled={enCours} onClick={inscrireDirectement}>L’inscrire directement</button>.</p>}
          </>
        )}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions separees">
          <button type="button" className="secondaire" onClick={onFermer}>Fermer</button>
          {!termine && <button type="button" className={action === 'refusee' ? 'danger' : 'primaire'} disabled={!action || enCours} onClick={valider}>{enCours ? 'Enregistrement…' : 'Enregistrer la décision'}</button>}
        </div>
      </div>
    </Modal>
  );
}

const TITRES_LOT = { acceptee: 'Accepter les dossiers', en_examen: 'Mettre en étude', liste_attente: 'Placer sur liste d’attente', refusee: 'Refuser les dossiers' };

function DecisionLot({ statut, ids, classes, onFermer, onFait }) {
  const [valeurs, setValeurs] = useState({ classeId: '', fraisInscription: '', commentaire: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  async function valider() {
    if (statut === 'acceptee' && !valeurs.classeId) { setErreur('choisissez la classe d’inscription'); return; }
    setEnCours(true);
    setErreur('');
    try {
      const r = await client.post('/preinscriptions/lot', { ids, statut, ...valeurs });
      onFait(`${r.data.traites} dossier(s) traité(s)${r.data.echecs.length ? `, ${r.data.echecs.length} non traité(s) : ${r.data.echecs[0].message}` : ''}. Les candidats sont prévenus par e-mail.`);
    } catch (err) {
      setErreur(messageErreur(err, 'action impossible'));
      setEnCours(false);
    }
  }
  return (
    <Modal titre={`${TITRES_LOT[statut]} (${ids.length})`} onFermer={onFermer} largeur={560}>
      <div className="formulaire">
        <p style={{ margin: 0 }}>{ids.length} dossier{ids.length > 1 ? 's' : ''} sélectionné{ids.length > 1 ? 's' : ''}. Chaque candidat reçoit un e-mail{statut === 'acceptee' ? ' avec son lien personnel pour s’inscrire en ligne' : ''}.</p>
        {statut === 'acceptee' && <ChampsAcceptation classes={classes} valeurs={valeurs} onChange={setValeurs} />}
        {statut !== 'en_examen' && <div className="champ"><label htmlFor="lot-com">{statut === 'refusee' ? 'Motif (envoyé aux candidats)' : 'Message aux candidats (facultatif)'}</label><textarea id="lot-com" rows={2} value={valeurs.commentaire} onChange={(e) => setValeurs({ ...valeurs, commentaire: e.target.value })} /></div>}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions separees">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="button" className={statut === 'refusee' ? 'danger' : 'primaire'} disabled={enCours} onClick={valider}>{enCours ? 'Traitement…' : 'Confirmer'}</button>
        </div>
      </div>
    </Modal>
  );
}
