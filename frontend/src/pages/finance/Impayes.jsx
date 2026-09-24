import { useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import TableauDefilant from '../../components/TableauDefilant';
import { messageErreur } from '../../utils/erreurs';
import { totalElevesParNiveaux } from '../../utils/totaux';

const STYLE_STATUT = { impaye: 'rouge', partiel: 'or', du: 'gris', solde: 'vert', sans_frais: 'gris' };
const LIBELLE_STATUT = { impaye: 'impayé', partiel: 'partiel', du: 'dû', solde: 'à jour', sans_frais: 'sans frais' };

// Diagramme d'activité 9 : vérification quotidienne -> vue d'ensemble par
// niveau puis par classe -> relance -> escalade si besoin.
export default function Impayes() {
  const [niveaux, setNiveaux] = useState([]);
  const [dernierResultat, setDernierResultat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [enRelance, setEnRelance] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/finance/impayes/par-classe').then((res) => setNiveaux(res.data.niveaux));
  }
  useEffect(charger, []);

  async function verifier() {
    setEnCours(true);
    try {
      const res = await client.post('/finance/impayes/verifier');
      setDernierResultat(res.data);
      charger();
    } finally {
      setEnCours(false);
    }
  }

  async function relancer(eleve) {
    if (!eleve.fraisARelancerId) return;
    setEnRelance(eleve.id);
    try {
      await client.post(`/finance/impayes/${eleve.fraisARelancerId}/relance`);
      setToast({ message: `Relance envoyée pour ${eleve.prenom} ${eleve.nom}.`, type: 'succes' });
    } catch (err) {
      setToast({ message: messageErreur(err, "échec de l'envoi de la relance"), type: 'erreur' });
    } finally {
      setEnRelance(null);
    }
  }

  const totalEleves = totalElevesParNiveaux(niveaux);
  const totalImpayes = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.filter((e) => e.statutGlobal === 'impaye').length, 0), 0);

  return (
    <>
      <div className="carte">
        <h2>Suivi des impayés</h2>
        <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem' }}>
          En production, cette vérification tourne automatiquement chaque jour
          (<code>npm run check:impayes</code>). Le bouton ci-dessous permet de la déclencher manuellement.
        </p>
        <button className="primaire" onClick={verifier} disabled={enCours}>
          {enCours ? 'Vérification…' : 'Vérifier les échéances maintenant'}
        </button>
        {dernierResultat && (
          <div className="message-succes" style={{ marginTop: 10 }}>
            {dernierResultat.nombreMarquesImpayes} frais marqué(s) impayé(s) lors de cette vérification.
          </div>
        )}
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Vue d'ensemble par niveau et par classe</h2>
          <div className="entete-carte-compteur">{totalImpayes} impayé{totalImpayes > 1 ? 's' : ''} / {totalEleves} élève{totalEleves > 1 ? 's' : ''}</div>
        </div>

        {niveaux.length === 0 && <div className="vide">Aucune classe enregistrée</div>}

        {niveaux.map(({ niveau, classes }) => (
          <div className="roster-niveau" key={niveau}>
            <h3 className="roster-niveau-titre">{niveau}</h3>
            {classes.map((classe) => (
              <TableauDefilant
                key={classe.id}
                titre={classe.nom}
                compte={`${classe.eleves.length} élève${classe.eleves.length > 1 ? 's' : ''}`}
              >
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Élève</th><th>Reste dû</th><th className="chiffre">Statut</th><th></th></tr></thead>
                    <tbody>
                      {classe.eleves.map((eleve) => (
                        <tr key={eleve.id}>
                          <td>{eleve.prenom} {eleve.nom}</td>
                          <td className="note-secondaire">{eleve.resteDu > 0 ? `${eleve.resteDu.toLocaleString('fr-FR')} FCFA` : 'Soldé'}</td>
                          <td className="chiffre"><span className={`badge ${STYLE_STATUT[eleve.statutGlobal]}`}>{LIBELLE_STATUT[eleve.statutGlobal]}</span></td>
                          <td className="chiffre">
                            {eleve.fraisARelancerId && (
                              <button className="secondaire" disabled={enRelance === eleve.id} onClick={() => relancer(eleve)}>
                                {enRelance === eleve.id ? 'Envoi…' : 'Relancer'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {classe.eleves.length === 0 && <tr><td colSpan={4} className="vide">Aucun élève dans cette classe</td></tr>}
                    </tbody>
                  </table>
                </div>
              </TableauDefilant>
            ))}
          </div>
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
