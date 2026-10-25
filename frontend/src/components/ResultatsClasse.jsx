import { useEffect, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import { noteFr, tonNote } from '../utils/seuils';
import BoutonDocument from './BoutonDocument';
import { IconDownload } from './icons';

// Résultats de la classe pour un semestre : ceux qui valident, ceux qui
// passent au rattrapage (mêmes règles que le bulletin). Un clic sur un
// étudiant ouvre son bulletin.
export default function ResultatsClasse({ classeId, semestreId, onChoisir }) {
  const [donnees, setDonnees] = useState(null);

  function charger() {
    if (!classeId || !semestreId) { setDonnees(null); return Promise.resolve(); }
    return client.get(`/bulletins/classe/${classeId}/${semestreId}`).then((res) => setDonnees(res.data)).catch(() => setDonnees(null));
  }
  useEffect(() => { setDonnees(null); charger(); }, [classeId, semestreId]);
  useActualisation(charger, { domaines: ['notes', 'comptes-ephemeres', 'unites-enseignement', 'matieres', 'eleves'] });

  if (!classeId || !semestreId) return null;
  if (!donnees) return <div className="chargement" style={{ marginTop: 16 }}>Calcul des résultats de la classe…</div>;
  const evalues = donnees.resultats.filter((r) => r.evalue);
  const valides = evalues.filter((r) => r.valide).sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
  const rattrapage = evalues.filter((r) => !r.valide).sort((a, b) => a.moyenneGenerale - b.moyenneGenerale);
  const seuil = donnees.regles?.seuil ?? 10;

  const tableau = (liste, ton, colonne) => (
    <div className="table-scroll resultats-classe-table">
      <table>
        <thead><tr><th>Étudiant</th><th>Moyenne</th><th>{colonne}</th></tr></thead>
        <tbody>
          {liste.map((r) => (
            <tr key={r.eleveId} className="ligne-cliquable" onClick={() => onChoisir?.(r.eleveId)}>
              <td>{r.prenom} {r.nom}</td>
              <td><span className={`badge-note ${tonNote(r.moyenneGenerale, donnees.regles || undefined)}`}>{noteFr(r.moyenneGenerale)}</span></td>
              <td>{ton === 'bonne' ? `${r.creditsValides} / ${r.creditsTotal}` : r.uesNonValidees.join(', ')}</td>
            </tr>
          ))}
          {liste.length === 0 && <tr><td colSpan={3} className="note-secondaire">Aucun étudiant</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="resultats-classe">
      <div className="resultats-classe-entete">
        <h3>Résultats de la classe</h3>
        <span className="note-secondaire">Semestre validé si toutes les UE atteignent {noteFr(seuil)}/20, sans note éliminatoire</span>
        <span className="resultats-classe-telechargements">
          <BoutonDocument className="secondaire" chemin={`/api/documents/resultats?classeId=${classeId}&semestreId=${semestreId}`} title="Procès-verbal : moyennes, mentions, résultats et décisions">
            <IconDownload width={15} height={15} /> PDF
          </BoutonDocument>
          <BoutonDocument className="secondaire" chemin={`/api/documents/resultats?classeId=${classeId}&semestreId=${semestreId}&format=xlsx`} title="Résultats et notes détaillées">
            <IconDownload width={15} height={15} /> Excel
          </BoutonDocument>
        </span>
      </div>
      <div className="resultats-classe-colonnes">
        <div className="resultats-classe-bloc bonne">
          <h4><i />Semestre validé <span className="entete-carte-compteur">{valides.length}</span></h4>
          {tableau(valides, 'bonne', 'Crédits')}
        </div>
        <div className="resultats-classe-bloc rattrapage">
          <h4><i />Non validé : rattrapage <span className="entete-carte-compteur">{rattrapage.length}</span></h4>
          {tableau(rattrapage, 'rattrapage', 'UE à rattraper')}
        </div>
      </div>
    </section>
  );
}
