import { useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { IconSettings } from '../../components/icons';

// Le superadmin gère son propre compte comme n'importe quel autre — nom,
// prénom, et mot de passe s'il le souhaite (laissé vide = inchangé).
export default function MonProfil() {
  const { profil, mettreAJourProfil } = useAuth();
  const [form, setForm] = useState({ nom: profil?.nom || '', prenom: profil?.prenom || '', motDePasse: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [toast, setToast] = useState(null);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const payload = { nom: form.nom, prenom: form.prenom };
      if (form.motDePasse) payload.motDePasse = form.motDePasse;
      const res = await client.put('/superadmin/mon-profil', payload);
      mettreAJourProfil(res.data.profil);
      setForm({ ...form, motDePasse: '' });
      setToast({ message: 'Profil mis à jour.', type: 'succes' });
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'échec de la mise à jour');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte" style={{ maxWidth: 480 }}>
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconSettings width={16} height={16} /></span>
          <h2>Mon profil</h2>
        </div>
      </div>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="champ"><label>E-mail</label><input value={profil?.email || ''} disabled /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
        </div>
        <div className="champ">
          <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
          <input type="password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} minLength={6} />
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
