import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

function initiales(personne) {
  return `${personne.prenom?.[0] ?? ''}${personne.nom?.[0] ?? ''}`.toUpperCase();
}

export default function Salaires() {
  const [personnel, setPersonnel] = useState([]);
  const [personnelId, setPersonnelId] = useState('');
  const [fiche, setFiche] = useState(null);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modalePersonnelOuverte, setModalePersonnelOuverte] = useState(false);
  const [toast, setToast] = useState(null);

  function chargerPersonnel() {
    client.get('/finance/personnel').then((res) => setPersonnel(res.data.personnel));
  }
  useEffect(chargerPersonnel, []);

  function chargerFiche(id) {
    client.get(`/finance/personnel/${id}/fiche`).then((res) => setFiche(res.data));
  }

  useEffect(() => {
    if (personnelId) chargerFiche(personnelId);
    else setFiche(null);
  }, [personnelId]);

  function surVersementReussi() {
    setModaleOuverte(false);
    chargerFiche(personnelId);
    setToast({ message: 'Versement enregistré.', type: 'succes' });
  }

  function surPersonnelCree(nouveau) {
    setModalePersonnelOuverte(false);
    chargerPersonnel();
    setPersonnelId(String(nouveau.id));
    setToast({ message: `${nouveau.prenom} ${nouveau.nom} ajouté(e) au personnel.`, type: 'succes' });
  }

  const personne = fiche?.personnel;

  return (
    <div className="maitre-detail">
      <div className="carte">
        <div className="entete-carte">
          <h2>Personnel</h2>
          <button className="secondaire" onClick={() => setModalePersonnelOuverte(true)}>+ Ajouter</button>
        </div>
        <div className="liste-personnel">
          {personnel.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`personnel-item ${String(p.id) === personnelId ? 'actif' : ''}`}
              onClick={() => setPersonnelId(String(p.id))}
            >
              <span className="personnel-avatar">{initiales(p)}</span>
              <span className="personnel-texte">
                <strong>{p.prenom} {p.nom}</strong>
                <small>{p.poste}</small>
              </span>
            </button>
          ))}
          {personnel.length === 0 && <div className="vide">Aucun personnel enregistré</div>}
        </div>
      </div>

      <div className="carte">
        {!personne && <div className="vide">Sélectionne un membre du personnel pour voir sa fiche de paie</div>}
        {personne && (
          <>
            <div className="fiche-paie-entete">
              <div className="fiche-paie-identite">
                <span className="fiche-paie-avatar">{initiales(personne)}</span>
                <div>
                  <h3>{personne.prenom} {personne.nom}</h3>
                  <p>{personne.poste}{personne.salaireBase ? ` · salaire de base ${personne.salaireBase.toLocaleString('fr-FR')} FCFA` : ''}</p>
                </div>
              </div>
              <button className="primaire" onClick={() => setModaleOuverte(true)}>Nouveau versement</button>
            </div>

            <div className="table-scroll">
              <table>
                <thead><tr><th>Période</th><th>Montant</th><th>Statut</th><th>Date de versement</th></tr></thead>
                <tbody>
                  {fiche.salaires.map((s) => (
                    <tr key={s.id}>
                      <td>{s.periode}</td>
                      <td>{s.montant.toLocaleString('fr-FR')} FCFA</td>
                      <td><span className={`badge ${s.statut === 'verse' ? 'vert' : 'gris'}`}>{s.statut === 'verse' ? 'versé' : 'prévu'}</span></td>
                      <td>{s.dateVersement ?? '—'}</td>
                    </tr>
                  ))}
                  {fiche.salaires.length === 0 && <tr><td colSpan={4} className="vide">Aucun versement enregistré</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modaleOuverte && personne && (
        <FormulaireVersement personne={personne} onFermer={() => setModaleOuverte(false)} onReussi={surVersementReussi} />
      )}
      {modalePersonnelOuverte && (
        <FormulairePersonnel onFermer={() => setModalePersonnelOuverte(false)} onReussi={surPersonnelCree} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function FormulairePersonnel({ onFermer, onReussi }) {
  const [form, setForm] = useState({ nom: '', prenom: '', poste: '', salaireBase: '', dateEmbauche: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/finance/personnel', { ...form, salaireBase: form.salaireBase ? Number(form.salaireBase) : null });
      onReussi(res.data.personnel);
    } catch (err) {
      setErreur(err.response?.data?.erreur || "impossible d'ajouter ce membre du personnel");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Nouveau membre du personnel" onFermer={onFermer}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
        </div>
        <div className="champ">
          <label>Poste</label>
          <input placeholder="ex. Professeur, Surveillant général, Comptable" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Salaire de base (FCFA)</label><input type="number" min="0" value={form.salaireBase} onChange={(e) => setForm({ ...form, salaireBase: e.target.value })} /></div>
          <div className="champ"><label>Date d'embauche</label><input type="date" value={form.dateEmbauche} onChange={(e) => setForm({ ...form, dateEmbauche: e.target.value })} /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</button>
      </form>
    </Modal>
  );
}

function FormulaireVersement({ personne, onFermer, onReussi }) {
  const [form, setForm] = useState({ montant: personne.salaireBase ?? '', periode: '', dateVersement: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/finance/salaires', { personnelId: personne.id, montant: Number(form.montant), periode: form.periode, dateVersement: form.dateVersement });
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible d\'enregistrer le versement');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Nouveau versement — ${personne.prenom} ${personne.nom}`} onFermer={onFermer}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="champ">
          <label>Période</label>
          <input placeholder="Septembre 2026" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Montant (FCFA)</label><input type="number" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ"><label>Date de versement</label><input type="date" value={form.dateVersement} onChange={(e) => setForm({ ...form, dateVersement: e.target.value })} required /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer le versement'}</button>
      </form>
    </Modal>
  );
}
