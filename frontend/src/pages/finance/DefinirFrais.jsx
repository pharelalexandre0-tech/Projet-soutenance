import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { IconBanknote } from '../../components/icons';

const STYLE_STATUT = { du: 'gris', partiel: 'or', solde: 'vert', impaye: 'rouge' };
const LIBELLE_STATUT = { du: 'dû', partiel: 'partiel', solde: 'soldé', impaye: 'impayé' };

export default function DefinirFrais() {
  const [eleves, setEleves] = useState([]);
  const [eleveId, setEleveId] = useState('');
  const [fraisExistants, setFraisExistants] = useState([]);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/eleves').then((res) => setEleves(res.data.eleves));
  }, []);

  function chargerFrais(id) {
    client.get(`/finance/frais/eleve/${id}`).then((res) => setFraisExistants(res.data.frais));
  }

  useEffect(() => {
    if (eleveId) chargerFrais(eleveId);
    else setFraisExistants([]);
  }, [eleveId]);

  const eleveSelectionne = eleves.find((e) => String(e.id) === eleveId);

  function surFraisDefini() {
    setModaleOuverte(false);
    if (eleveId) chargerFrais(eleveId);
    setToast({ message: 'Frais défini avec succès.', type: 'succes' });
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconBanknote width={16} height={16} /></span>
          <h2>Frais de scolarité</h2>
        </div>
        <button className="primaire" onClick={() => setModaleOuverte(true)}>+ Définir un frais</button>
      </div>

      <div className="ligne-champs">
        <div className="champ" style={{ maxWidth: 320 }}>
          <label>Élève</label>
          <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
            <option value="">—</option>
            {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}{el.Classe ? ` — ${el.Classe.nom}` : ''}</option>)}
          </select>
        </div>
      </div>

      {!eleveId && <div className="vide">Choisis un élève pour voir ses frais existants</div>}
      {eleveId && (
        <>
          <h3 style={{ marginTop: 4 }}>Frais de {eleveSelectionne?.prenom} {eleveSelectionne?.nom}</h3>
          <div className="table-scroll">
          <table>
            <thead><tr><th>Libellé</th><th>Montant</th><th>Échéance</th><th>Statut</th></tr></thead>
            <tbody>
              {fraisExistants.map((f) => (
                <tr key={f.id}>
                  <td>{f.libelle}</td>
                  <td>{f.montant.toLocaleString('fr-FR')} FCFA</td>
                  <td>{f.dateEcheance}</td>
                  <td><span className={`badge ${STYLE_STATUT[f.statut]}`}>{LIBELLE_STATUT[f.statut] ?? f.statut}</span></td>
                </tr>
              ))}
              {fraisExistants.length === 0 && <tr><td colSpan={4} className="vide">Aucun frais défini pour cet élève</td></tr>}
            </tbody>
          </table>
          </div>
        </>
      )}

      {modaleOuverte && (
        <FormulaireFrais
          eleves={eleves}
          eleveIdInitial={eleveId}
          onFermer={() => setModaleOuverte(false)}
          onReussi={surFraisDefini}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function FormulaireFrais({ eleves, eleveIdInitial, onFermer, onReussi }) {
  const [semestres, setSemestres] = useState([]);
  const [form, setForm] = useState({ eleveId: eleveIdInitial || '', semestreId: '', libelle: '', montant: '', dateEcheance: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/finance/frais', { ...form, eleveId: Number(form.eleveId), semestreId: Number(form.semestreId), montant: Number(form.montant) });
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de définir ce frais');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Définir un frais de scolarité" onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Élève</label>
            <select value={form.eleveId} onChange={(e) => setForm({ ...form, eleveId: e.target.value })} required>
              <option value="">—</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Semestre</label>
            <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
              <option value="">—</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label>Libellé</label>
          <input placeholder="ex. Frais de scolarité — Semestre 1" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Montant (FCFA)</label><input type="number" min="0" placeholder="150 000" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ"><label>Échéance</label><input type="date" value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} required /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Définir le frais'}</button>
      </form>
    </Modal>
  );
}
