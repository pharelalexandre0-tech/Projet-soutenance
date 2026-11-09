import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import BoutonDocument from '../../components/BoutonDocument';

const STATUTS = { en_attente: ['En attente', 'or'], reussi: ['Réussi', 'vert'], echoue: ['Échoué', 'rouge'], expire: ['Expiré', 'gris'] };
const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Finance : paiements mobile money faits par les étudiants et les parents.
// Un paiement réussi est déjà encaissé, avec son reçu certifié.
export default function PaiementsEnLigne() {
  const [liste, setListe] = useState(null);
  const [config, setConfig] = useState(null);
  const charger = () => client.get('/paiements-en-ligne/etablissement').then((r) => setListe(r.data.paiements)).catch(() => setListe([]));
  useEffect(() => { charger(); client.get('/paiements-en-ligne/configuration').then((r) => setConfig(r.data)).catch(() => {}); }, []);
  useActualisation(charger, { domaines: ['paiements-en-ligne', 'finance'] });

  const reussis = (liste || []).filter((p) => p.statut === 'reussi');
  return (
    <>
      {config?.modeTest && <div className="message-attente" style={{ marginBottom: 16 }}><strong>Mode test</strong> : les paiements ci-dessous sont simulés, aucun argent n’a été débité. Le paiement réel s’active dès que le compte marchand Airtel Money et Moov Money de l’établissement est branché.</div>}
      <dl className="usage-quotas">
        <div><dt>Paiements réussis</dt><dd>{reussis.length}</dd></div>
        <div><dt>Montant encaissé en ligne</dt><dd>{fcfa(reussis.reduce((s, p) => s + p.montant, 0))}</dd></div>
        <div><dt>En attente de validation</dt><dd>{(liste || []).filter((p) => p.statut === 'en_attente').length}</dd></div>
      </dl>
      <section className="carte">
        <h2>Paiements mobile money <span className="entete-carte-compteur">{liste?.length ?? 0}</span></h2>
        {!liste && <div className="chargement">Chargement…</div>}
        {liste && liste.length === 0 && <div className="vide">Aucun paiement en ligne pour le moment.</div>}
        {liste && liste.length > 0 && (
          <div className="table-scroll"><table>
            <thead><tr><th>Date</th><th>Étudiant</th><th>Frais</th><th className="chiffre">Montant</th><th>Opérateur</th><th>Téléphone</th><th>Statut</th><th>Reçu</th></tr></thead>
            <tbody>{liste.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="cellule-nom">{p.eleve?.prenom} {p.eleve?.nom}</td>
                <td>{p.frais?.libelle}</td>
                <td className="chiffre">{fcfa(p.montant)}</td>
                <td>{p.libelleOperateur}{p.fournisseur === 'test' ? ' (test)' : ''}</td>
                <td className="mono">{p.telephone}</td>
                <td><span className={`badge ${STATUTS[p.statut][1]}`}>{STATUTS[p.statut][0]}</span></td>
                <td>{p.recu ? <BoutonDocument chemin={p.recu.fichierPDF} className="secondaire" style={{ padding: '5px 12px' }}>{p.recu.numero}</BoutonDocument> : <span className="note-secondaire">-</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
