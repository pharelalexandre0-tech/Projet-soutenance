import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconPlus, IconTrash, IconSend } from '../../components/icons';
import { NATURES_CALENDRIER, dateCourte } from './commun';

function anneeCourante() {
  const d = new Date();
  const debut = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}
const decaler = (annee, n) => {
  const debut = Number(annee.slice(0, 4)) + n;
  return `${debut}-${debut + 1}`;
};

// Calendrier universitaire national : périodes fixées par le Ministère,
// publiées à tous les établissements, qui en accusent réception.
export default function Calendrier() {
  const [annee, setAnnee] = useState(anneeCourante());
  const [donnees, setDonnees] = useState(null);
  const [form, setForm] = useState({ nature: 'rentree', libelle: '', dateDebut: '', dateFin: '' });
  const [erreur, setErreur] = useState('');
  const [publication, setPublication] = useState(false);
  const [toast, setToast] = useState(null);

  const charger = () => client.get(`/ministere/calendrier?annee=${annee}`).then((r) => setDonnees(r.data)).catch(() => {});
  useEffect(() => { setDonnees(null); charger(); }, [annee]);
  useActualisation(charger, { domaines: ['ministere', 'tutelle'] });

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/ministere/calendrier', { ...form, anneeUniversitaire: annee });
      setForm({ nature: form.nature, libelle: '', dateDebut: '', dateFin: '' });
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'période non ajoutée'));
    }
  }

  const accuses = donnees?.accuses || [];
  const nbAccuses = accuses.filter((a) => a.accuseLe).length;

  return (
    <>
      <section className="carte">
        <div className="entete-carte">
          <div className="selecteur-annee" role="group" aria-label="Année universitaire">
            <button type="button" className="secondaire petit" onClick={() => setAnnee(decaler(annee, -1))} aria-label="Année précédente">‹</button>
            <h2>Calendrier universitaire {annee}</h2>
            <button type="button" className="secondaire petit" onClick={() => setAnnee(decaler(annee, 1))} aria-label="Année suivante">›</button>
          </div>
          <div className="entete-actions">
            {donnees?.publie ? <span className="badge vert">Publié</span> : <span className="badge gris">Brouillon</span>}
            <button type="button" className="primaire" disabled={!donnees?.evenements.length} onClick={() => setPublication(true)}><IconSend /> {donnees?.publie ? 'Republier' : 'Publier aux établissements'}</button>
          </div>
        </div>
        {!donnees && <div className="chargement">Chargement…</div>}
        {donnees && donnees.evenements.length === 0 && <div className="vide">Aucune période pour {annee}. Ajoutez la rentrée, les examens, les délibérations et les vacances.</div>}
        {donnees && donnees.evenements.length > 0 && (
          <ol className="frise-calendrier">
            {donnees.evenements.map((ev) => (
              <li key={ev.id} className={`periode periode-${ev.nature}`}>
                <span className="periode-dates">{dateCourte(ev.dateDebut)}{ev.dateFin && ev.dateFin !== ev.dateDebut ? ` au ${dateCourte(ev.dateFin)}` : ''}</span>
                <span className="periode-texte"><small>{NATURES_CALENDRIER[ev.nature]}</small><strong>{ev.libelle}</strong></span>
                <button type="button" className="bouton-icone" aria-label={`Retirer ${ev.libelle}`} onClick={async () => { await client.delete(`/ministere/calendrier/${ev.id}`); charger(); }}><IconTrash /></button>
              </li>
            ))}
          </ol>
        )}
        <form className="ajout-periode" onSubmit={ajouter}>
          <div className="champ"><label htmlFor="cl-nature">Nature</label>
            <select id="cl-nature" value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>{Object.entries(NATURES_CALENDRIER).map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
          </div>
          <div className="champ"><label htmlFor="cl-lib">Libellé</label><input id="cl-lib" required value={form.libelle} placeholder="Ex. Examens du premier semestre" onChange={(e) => setForm({ ...form, libelle: e.target.value })} /></div>
          <div className="champ"><label htmlFor="cl-debut">Du</label><input id="cl-debut" type="date" required value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} /></div>
          <div className="champ"><label htmlFor="cl-fin">Au (facultatif)</label><input id="cl-fin" type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} /></div>
          <button type="submit" className="secondaire"><IconPlus /> Ajouter</button>
        </form>
        {erreur && <div className="message-erreur">{erreur}</div>}
      </section>

      {donnees?.publie && (
        <section className="carte">
          <div className="entete-carte"><h2>Accusés de réception <span className="entete-carte-compteur">{nbAccuses} / {accuses.length}</span></h2></div>
          <div className="table-scroll">
            <table className="table-ministere">
              <thead><tr><th>Établissement</th><th>Province</th><th>Accusé le</th><th>Par</th></tr></thead>
              <tbody>
                {accuses.map((a) => (
                  <tr key={a.id}>
                    <td className="cellule-nom">{a.nom}</td>
                    <td>{a.province || ''}</td>
                    <td>{a.accuseLe ? dateCourte(a.accuseLe) : <span className="badge or">En attente</span>}</td>
                    <td>{a.accuseParNom || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {publication && (
        <ConfirmModal
          titre={`Publier le calendrier ${annee}`}
          boutonConfirmer="Publier"
          boutonEnCours="Publication…"
          onConfirmer={async () => {
            await client.post('/ministere/calendrier/publier', { anneeUniversitaire: annee });
            setPublication(false);
            charger();
            setToast({ message: 'Calendrier publié à tous les établissements', type: 'succes' });
          }}
          onAnnuler={() => setPublication(false)}
        >
          Tous les établissements recevront le calendrier et devront en accuser réception{donnees?.publie ? ' à nouveau' : ''}.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
