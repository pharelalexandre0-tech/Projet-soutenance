import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { IconKey } from '../../components/icons';

// Volontairement limité aux seuls comptes superadmin : la gestion des
// comptes d'une école (académie/finance/parent) se fait depuis la fiche de
// cet établissement, jamais depuis un annuaire global qui exposerait les
// données personnelles de toutes les écoles en un seul endroit.
export default function Superadmins() {
  const [comptes, setComptes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modaleAjoutOuverte, setModaleAjoutOuverte] = useState(false);
  const [toast, setToast] = useState(null);

  function charger() {
    setChargement(true);
    client.get('/superadmin/superadmins').then((res) => {
      setComptes(res.data.comptes);
      setChargement(false);
    });
  }
  useEffect(charger, []);

  function surAjoutReussi() {
    setModaleAjoutOuverte(false);
    charger();
    setToast({ message: 'Nouveau compte superadmin créé.', type: 'succes' });
  }

  return (
    <>
      <div className="carte">
        <div className="entete-carte">
          <h2><span className="puce-icone petite" style={{ marginRight: 10, verticalAlign: 'middle' }}><IconKey width={16} height={16} /></span>Comptes superadmin</h2>
          <button className="primaire" onClick={() => setModaleAjoutOuverte(true)}>+ Ajouter un superadmin</button>
        </div>
        <p className="note-secondaire" style={{ marginTop: -8, marginBottom: 18 }}>
          Les comptes des établissements (académie, finance, parent) se gèrent depuis la fiche de leur école, dans l'onglet "Établissements".
        </p>

        {chargement && <div className="chargement">Chargement…</div>}
        {!chargement && (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nom</th><th>E-mail</th></tr></thead>
              <tbody>
                {comptes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.prenom} {c.nom}</td>
                    <td className="note-secondaire">{c.email}</td>
                  </tr>
                ))}
                {comptes.length === 0 && <tr><td colSpan={2} className="vide">Aucun compte superadmin</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modaleAjoutOuverte && (
        <FormulaireSuperadmin onFermer={() => setModaleAjoutOuverte(false)} onReussi={surAjoutReussi} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireSuperadmin({ onFermer, onReussi }) {
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', motDePasse: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/superadmin/comptes', form);
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de créer ce compte');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Ajouter un superadmin" onFermer={onFermer} largeur={440}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
        </div>
        <div className="champ"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="champ"><label>Mot de passe</label><input type="password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} minLength={6} required /></div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Création…' : 'Créer le compte'}</button>
      </form>
    </Modal>
  );
}
