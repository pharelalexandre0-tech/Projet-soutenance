import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconMegaphone, IconChevronRight, IconBuilding } from '../../components/icons';

const PRIORITES = { information: ['Information', 'gris'], instruction: ['Instruction', 'bleu'], urgent: ['Urgent', 'rouge'] };
const TONS_AGREMENT = { agree: 'vert', provisoire: 'bleu', en_instruction: 'or', suspendu: 'rouge', retire: 'rouge' };
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Circulaires du Ministère de l'Enseignement supérieur reçues par
// l'établissement, situation d'agrément, lecture et accusé de réception.
export default function CirculairesRecues() {
  const [donnees, setDonnees] = useState(null);
  const [ouverte, setOuverte] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/circulaires').then((r) => setDonnees(r.data)).catch(() => setDonnees((d) => d || { circulaires: [], nonLues: 0 }));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true });

  async function ouvrir(c) {
    setOuverte(c);
    if (!c.lueLe) await client.post(`/circulaires/${c.id}/lue`).then(charger).catch(() => {});
  }

  async function accuser() {
    try {
      const r = await client.post(`/circulaires/${ouverte.id}/accuse`);
      setOuverte({ ...ouverte, ...r.data });
      setToast({ message: 'Accusé de réception transmis au Ministère', type: 'succes' });
      charger();
    } catch (e) {
      setToast({ message: messageErreur(e, 'accusé non transmis'), type: 'erreur' });
    }
  }

  const ag = donnees?.agrement;
  return (
    <>
      {ag && (
        <section className="carte bandeau-agrement">
          <span className="tuile-fonctionnalite"><IconBuilding /></span>
          <div>
            <h2>Agrément de l’établissement</h2>
            <p>
              <span className={`badge ${TONS_AGREMENT[ag.statut] || 'gris'}`}>{ag.libelle}</span>
              {ag.numero && <span className="mono"> {ag.numero}</span>}
              {ag.expiration && <span className="note-secondaire"> · valable jusqu’au {dateFr(ag.expiration)}</span>}
            </p>
          </div>
        </section>
      )}
      <section className="carte">
        <div className="entete-carte"><h2>Circulaires du Ministère <span className="entete-carte-compteur">{donnees?.circulaires.length ?? 0}</span></h2>{donnees?.nonLues > 0 && <span className="badge rouge">{donnees.nonLues} non lue(s)</span>}</div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Référence</th><th>Titre</th><th>Priorité</th><th>Reçue le</th><th>Échéance</th><th>Suivi</th><th aria-label="Ouvrir" /></tr></thead>
            <tbody>
              {(donnees?.circulaires || []).map((c) => (
                <tr key={c.id} className={`ligne-cliquable ${c.lueLe ? '' : 'ligne-non-lue'}`} onClick={() => ouvrir(c)}>
                  <td className="mono">{c.reference}</td>
                  <td className="cellule-nom">{c.titre}</td>
                  <td><span className={`badge ${PRIORITES[c.priorite][1]}`}>{PRIORITES[c.priorite][0]}</span></td>
                  <td>{dateFr(c.publieeLe)}</td>
                  <td>{dateFr(c.echeance)}</td>
                  <td>{c.accuseLe ? <span className="badge vert">Accusé de réception</span> : c.lueLe ? <span className="badge or">Lue</span> : <span className="badge gris">Nouvelle</span>}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {donnees && donnees.circulaires.length === 0 && <tr><td colSpan={7} className="vide">Aucune circulaire reçue.</td></tr>}
              {!donnees && <tr><td colSpan={7} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {ouverte && (
        <Tiroir
          titre={ouverte.titre}
          sousTitre={`${ouverte.reference} · ${dateFr(ouverte.publieeLe)}`}
          icone={<span className="tuile-fonctionnalite"><IconMegaphone /></span>}
          onFermer={() => setOuverte(null)}
          pied={ouverte.accuseLe
            ? <span className="badge vert">Accusé de réception transmis le {dateFr(ouverte.accuseLe)}</span>
            : <button type="button" className="primaire" onClick={accuser}>Accuser réception</button>}
        >
          <section className="tiroir-section">
            <p className="note-secondaire">Ministère de l’Enseignement supérieur · {PRIORITES[ouverte.priorite][0]}{ouverte.echeance ? ` · réponse attendue avant le ${dateFr(ouverte.echeance)}` : ''}</p>
            {ouverte.objet && <p><strong>Objet :</strong> {ouverte.objet}</p>}
            <div className="texte-circulaire">{ouverte.contenu.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
            <p className="note-secondaire">Signataire : {ouverte.signataire}</p>
          </section>
        </Tiroir>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
