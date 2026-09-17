import { useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

// Symétrique de superadmin/MonProfil.jsx pour les trois autres rôles —
// jusqu'ici seul le superadmin pouvait changer son propre mot de passe
// depuis l'app (ex. après un mot de passe temporaire reçu par e-mail).
// En modale plutôt qu'un onglet dédié : Académie/Finance/Étudiant n'ont
// pas de section "Paramètres" personnels dans leur nav, seulement
// (pour l'Académie) une page d'identité de l'établissement, différente.
export default function ModaleMonCompte({ onFermer }) {
  const { profil, mettreAJourProfil } = useAuth();
  const [form, setForm] = useState({ nom: profil?.nom || '', prenom: profil?.prenom || '', motDePasse: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    setSucces('');
    try {
      const payload = { nom: form.nom, prenom: form.prenom };
      if (form.motDePasse) payload.motDePasse = form.motDePasse;
      const res = await client.put('/auth/mon-profil', payload);
      mettreAJourProfil(res.data.profil);
      setForm({ ...form, motDePasse: '' });
      setSucces('Profil mis à jour.');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'échec de la mise à jour');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Mon compte" onFermer={onFermer} largeur={440}>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="champ"><label>E-mail</label><input value={profil?.email || ''} disabled /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
        </div>
        <div className="champ">
          <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
          <input type="password" autoComplete="new-password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} minLength={6} />
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        {succes && <div className="message-succes">{succes}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </Modal>
  );
}
