import { useEffect, useState } from 'react';
import client from '../../api/client';

const STYLE_STATUT = { du: 'gris', partiel: 'or', solde: 'vert', impaye: 'rouge' };

// Diagramme 8 : enregistrerPaiement -> vérifier montant -> alt
// [valide]/[invalide] -> reçu PDF + notification si valide.
export default function Paiements() {
  const [eleves, setEleves] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [frais, setFrais] = useState([]);
  const [form, setForm] = useState({ fraisId: '', montant: '', modePaiement: 'especes' });
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => { client.get('/eleves').then((res) => setEleves(res.data.eleves)); }, []);
  useEffect(() => {
    if (eleveId) client.get(`/finance/frais/eleve/${eleveId}`).then((res) => setFrais(res.data.frais));
    else setFrais([]);
  }, [eleveId]);

  async function payer(e) {
    e.preventDefault();
    setErreur('');
    setResultat(null);
    try {
      const res = await client.post('/finance/paiements', { fraisId: Number(form.fraisId), montant: Number(form.montant), modePaiement: form.modePaiement });
      setResultat(res.data);
      client.get(`/finance/frais/eleve/${eleveId}`).then((r) => setFrais(r.data.frais));
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'erreur (montant incorrect)');
    }
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Enregistrer un paiement</h2>
        <form className="formulaire" onSubmit={payer}>
          <div className="champ">
            <label>Élève</label>
            <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
              <option value="">—</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Frais</label>
            <select value={form.fraisId} onChange={(e) => setForm({ ...form, fraisId: e.target.value })} required>
              <option value="">—</option>
              {frais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.libelle} — reste {(f.montant - f.montantRegle).toLocaleString('fr-FR')} FCFA
                </option>
              ))}
            </select>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Montant (FCFA)</label><input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
            <div className="champ">
              <label>Mode de paiement</label>
              <select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })}>
                <option value="especes">Espèces</option>
                <option value="mobile_money">Mobile money</option>
                <option value="virement">Virement</option>
              </select>
            </div>
          </div>
          <button className="primaire" type="submit">Enregistrer le paiement</button>
          {erreur && <div className="message-erreur">{erreur}</div>}
          {resultat && (
            <div className="message-succes">
              Paiement enregistré. Reçu {resultat.recu.numero}
              {resultat.recuEnvoyeA && <> — envoyé par e-mail à {resultat.recuEnvoyeA}</>}
              <div style={{ marginTop: 8 }}>
                <a href={resultat.recu.fichierPDF} target="_blank" rel="noreferrer" className="secondaire" style={{ display: 'inline-block', textDecoration: 'none', padding: '5px 12px' }}>
                  Télécharger le reçu (PDF)
                </a>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="carte">
        <h2>Frais de l'élève sélectionné</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Libellé</th><th>Montant</th><th>Réglé</th><th>Statut</th></tr></thead>
            <tbody>
              {frais.map((f) => (
                <tr key={f.id}>
                  <td>{f.libelle}</td>
                  <td>{f.montant.toLocaleString('fr-FR')}</td>
                  <td>{f.montantRegle.toLocaleString('fr-FR')}</td>
                  <td><span className={`badge ${STYLE_STATUT[f.statut]}`}>{f.statut}</span></td>
                </tr>
              ))}
              {frais.length === 0 && <tr><td colSpan={4} className="vide">Sélectionne un élève</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
