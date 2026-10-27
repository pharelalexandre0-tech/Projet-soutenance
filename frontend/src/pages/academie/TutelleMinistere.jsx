import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import BoutonDocument from '../../components/BoutonDocument';
import { messageErreur } from '../../utils/erreurs';
import { IconDownload, IconCheck } from '../../components/icons';
import {
  CYCLES, STATUTS_HABILITATION, NATURES_INSPECTION, STATUTS_INSPECTION, AVIS, STATUTS_RECO, NATURES_CALENDRIER, dateCourte,
} from '../ministere/commun';

// Tutelle du Ministère vue par l'établissement : formations habilitées,
// calendrier universitaire national (accusé de réception), inspections et
// réponses aux recommandations.
export default function TutelleMinistere() {
  const [donnees, setDonnees] = useState(null);
  const [reponse, setReponse] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/tutelle').then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || null));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true, domaines: ['ministere', 'tutelle'] });

  if (!donnees) return <div className="chargement">Chargement…</div>;
  const recos = donnees.inspections.flatMap((i) => (i.RecommandationInspections || []).map((r) => ({ ...r, inspection: i })));
  const ouvertes = recos.filter((r) => r.statut !== 'realisee');

  async function accuser() {
    try {
      await client.post('/tutelle/calendrier/accuse');
      setToast({ message: 'Accusé de réception transmis au Ministère', type: 'succes' });
      charger();
    } catch (e) {
      setToast({ message: messageErreur(e, 'accusé non transmis'), type: 'erreur' });
    }
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Formations habilitées</span></div><div className="valeur">{donnees.habilitations.filter((h) => h.statut !== 'retiree').length}</div></div>
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Inspections</span></div><div className="valeur">{donnees.inspections.length}</div></div>
        <div className={`stat-tile ${ouvertes.length ? 'tile-rouge' : 'tile-vert'}`}><div className="stat-tile-haut"><span className="libelle">Recommandations à traiter</span></div><div className="valeur">{ouvertes.length}</div></div>
        <div className={`stat-tile ${donnees.calendrier.evenements.length && !donnees.calendrier.accuseLe ? 'tile-or' : ''}`}><div className="stat-tile-haut"><span className="libelle">Calendrier {donnees.annee}</span></div><div className="valeur valeur-montant">{!donnees.calendrier.evenements.length ? 'Non publié' : donnees.calendrier.accuseLe ? 'Reçu' : 'À accuser'}</div></div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Calendrier universitaire national {donnees.annee}</h2>
          {donnees.calendrier.evenements.length > 0 && (donnees.calendrier.accuseLe
            ? <span className="badge vert">Réception accusée le {dateCourte(donnees.calendrier.accuseLe)}</span>
            : <button type="button" className="primaire" onClick={accuser}><IconCheck /> Accuser réception</button>)}
        </div>
        {donnees.calendrier.evenements.length === 0 ? <div className="vide">Le Ministère n’a pas encore publié le calendrier de cette année.</div> : (
          <ol className="frise-calendrier">
            {donnees.calendrier.evenements.map((ev) => (
              <li key={ev.id} className={`periode periode-${ev.nature}`}>
                <span className="periode-dates">{dateCourte(ev.dateDebut)}{ev.dateFin && ev.dateFin !== ev.dateDebut ? ` au ${dateCourte(ev.dateFin)}` : ''}</span>
                <span className="periode-texte"><small>{NATURES_CALENDRIER[ev.nature]}</small><strong>{ev.libelle}</strong></span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="carte">
        <div className="entete-carte"><h2>Recommandations d’inspection <span className="entete-carte-compteur">{recos.length}</span></h2></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Mission</th><th>Recommandation</th><th>Échéance</th><th>Suivi</th><th>Votre réponse</th><th aria-label="Répondre" /></tr></thead>
            <tbody>
              {recos.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.inspection.reference}</td>
                  <td className="cellule-texte-long">{r.texte}</td>
                  <td>{dateCourte(r.echeance)}</td>
                  <td><span className={`badge ${STATUTS_RECO[r.statut][1]}`}>{STATUTS_RECO[r.statut][0]}</span></td>
                  <td className="cellule-texte-long">{r.reponse || <span className="note-secondaire">Pas encore de réponse</span>}</td>
                  <td>{r.statut !== 'realisee' && <button type="button" className="secondaire petit" onClick={() => setReponse(r)}>Répondre</button>}</td>
                </tr>
              ))}
              {recos.length === 0 && <tr><td colSpan={6} className="vide">Aucune recommandation du Ministère.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte">
        <div className="entete-carte"><h2>Missions d’inspection</h2></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Référence</th><th>Nature</th><th>Objet</th><th>Date</th><th>Statut</th><th>Avis</th><th aria-label="Rapport" /></tr></thead>
            <tbody>
              {donnees.inspections.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.reference}</td>
                  <td>{NATURES_INSPECTION[i.nature]}</td>
                  <td className="cellule-texte-long">{i.objet}</td>
                  <td>{dateCourte(i.dateRealisee || i.datePrevue)}</td>
                  <td><span className={`badge ${STATUTS_INSPECTION[i.statut][1]}`}>{STATUTS_INSPECTION[i.statut][0]}</span></td>
                  <td>{i.avis ? <span className={`badge ${AVIS[i.avis][1]}`}>{AVIS[i.avis][0]}</span> : ''}</td>
                  <td>{i.dateRealisee && <BoutonDocument className="secondaire petit" chemin={`/api/tutelle/inspections/${i.id}/rapport`}><IconDownload width={14} height={14} /> Rapport</BoutonDocument>}</td>
                </tr>
              ))}
              {donnees.inspections.length === 0 && <tr><td colSpan={7} className="vide">Aucune mission d’inspection programmée.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte">
        <div className="entete-carte"><h2>Formations habilitées par le Ministère <span className="entete-carte-compteur">{donnees.habilitations.length}</span></h2></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Cycle</th><th>Domaine</th><th>Mention</th><th>Spécialité</th><th>N° de l’arrêté</th><th>Du</th><th>Au</th><th>Statut</th></tr></thead>
            <tbody>
              {donnees.habilitations.map((h) => (
                <tr key={h.id}>
                  <td>{CYCLES[h.cycle]}</td><td>{h.domaine}</td><td className="cellule-nom">{h.mention}</td><td>{h.specialite || ''}</td>
                  <td className="mono">{h.numeroArrete || ''}</td><td>{dateCourte(h.dateDebut)}</td><td>{dateCourte(h.dateFin)}</td>
                  <td><span className={`badge ${STATUTS_HABILITATION[h.statut][1]}`}>{STATUTS_HABILITATION[h.statut][0]}</span></td>
                </tr>
              ))}
              {donnees.habilitations.length === 0 && <tr><td colSpan={8} className="vide">Aucune formation habilitée enregistrée par le Ministère.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {reponse && <RepondreRecommandation reco={reponse} onFermer={() => setReponse(null)} onFait={() => { setReponse(null); charger(); setToast({ message: 'Réponse transmise au Ministère', type: 'succes' }); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function RepondreRecommandation({ reco, onFermer, onFait }) {
  const [form, setForm] = useState({ reponse: reco.reponse || '', statut: reco.statut === 'a_faire' ? 'en_cours' : reco.statut });
  const [erreur, setErreur] = useState('');
  async function valider(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.put(`/tutelle/recommandations/${reco.id}`, form);
      onFait();
    } catch (err) {
      setErreur(messageErreur(err, 'réponse non transmise'));
    }
  }
  return (
    <Modal titre="Répondre au Ministère" onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={valider}>
        <p className="confirmation-texte">{reco.texte}</p>
        <div className="champ"><label htmlFor="rr-texte">Mesures prises</label><textarea id="rr-texte" rows={4} required value={form.reponse} onChange={(e) => setForm({ ...form, reponse: e.target.value })} /></div>
        <div className="champ"><label htmlFor="rr-statut">Avancement</label>
          <select id="rr-statut" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
            <option value="en_cours">En cours</option>
            <option value="realisee">Réalisée</option>
          </select>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire">Transmettre</button>
        </div>
      </form>
    </Modal>
  );
}
