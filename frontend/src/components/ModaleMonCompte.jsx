import { useEffect, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import ChampMotDePasse from './ChampMotDePasse';
import { useAuth } from '../context/AuthContext';
import { IconInfo } from './icons';

// Symétrique de superadmin/MonProfil.jsx pour les autres rôles, en modale :
// Académie et Finance n'ont pas de page "profil" dans leur menu.
// L'étudiant (et son parent, qui ouvre le même compte) ne modifie rien : le
// mot de passe est le matricule, attribué par l'établissement.
export default function ModaleMonCompte({ onFermer }) {
  const { profil } = useAuth();
  return (
    <Modal titre="Mon compte" onFermer={onFermer} largeur={480}>
      {profil?.role === 'etudiant' ? <CompteEtudiant profil={profil} /> : <CompteModifiable />}
    </Modal>
  );
}

function CompteEtudiant({ profil }) {
  const [matricule, setMatricule] = useState(null);
  useEffect(() => {
    client.get('/eleves').then((res) => setMatricule(res.data.eleves[0]?.matricule || null)).catch(() => {});
  }, []);

  if (profil.modeParent) {
    return (
      <div className="formulaire">
        <dl className="fiche-compte">
          <div><dt>Élève suivi</dt><dd>{profil.prenom} {profil.nom}</dd></div>
          <div><dt>Votre identifiant</dt><dd>{profil.emailParent}</dd></div>
          <div><dt>Mot de passe</dt><dd className="mono">{matricule || '…'}</dd></div>
        </dl>
        <div className="encart-info">
          <IconInfo />
          <span>
            Vous vous connectez avec votre adresse e-mail et le matricule de votre enfant, qui ne se modifie pas. Pour
            changer d'adresse, adressez-vous au service de la scolarité.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="formulaire">
      <dl className="fiche-compte">
        <div><dt>Nom</dt><dd>{profil.prenom} {profil.nom}</dd></div>
        <div><dt>Adresse e-mail</dt><dd>{profil.email}</dd></div>
        <div><dt>Matricule</dt><dd className="mono">{matricule || '…'}</dd></div>
      </dl>
      <div className="encart-info">
        <IconInfo />
        <span>
          Ton mot de passe est ton matricule : il ne se modifie pas. En cas de problème de connexion, adresse-toi au
          service Académie de ton établissement.
        </span>
      </div>
    </div>
  );
}

function CompteModifiable() {
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
      setSucces('Compte mis à jour.');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'échec de la mise à jour');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={enregistrer}>
      <div className="champ"><label>Adresse e-mail</label><input value={profil?.email || ''} disabled /></div>
      <div className="ligne-champs">
        <div className="champ"><label>Prénom</label><input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
        <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
      </div>
      <div className="champ">
        <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
        <ChampMotDePasse autoComplete="new-password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} minLength={6} />
      </div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {succes && <div className="message-succes">{succes}</div>}
      <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}
