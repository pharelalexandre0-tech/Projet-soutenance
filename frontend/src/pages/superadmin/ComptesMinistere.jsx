import { useEffect, useState } from 'react';
import client from '../../api/client';
import ChampMotDePasse from '../../components/ChampMotDePasse';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { motDePasseAleatoire } from '../../utils/excel';
import { dateCourte } from '../../utils/plateforme';

const VIDE = { prenom: '', nom: '', email: '', fonction: '', motDePasse: '' };

// Comptes des agents du Ministère de l'Enseignement supérieur : création,
// verrouillage, réinitialisation de l'application d'authentification.
export default function ComptesMinistere() {
  const [comptes, setComptes] = useState(null);
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [cree, setCree] = useState(null);
  const [action, setAction] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/superadmin/comptes-ministere').then((r) => setComptes(r.data.comptes)).catch(() => setComptes([]));
  useEffect(() => { charger(); }, []);

  async function creer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/superadmin/comptes-ministere', form);
      setCree({ email: form.email, motDePasse: form.motDePasse });
      setForm(VIDE);
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'création impossible'));
    } finally {
      setEnCours(false);
    }
  }

  async function executer() {
    await client.patch(`/superadmin/comptes-ministere/${action.compte.id}`, action.corps);
    setToast({ message: action.message, type: 'succes' });
    setAction(null);
    charger();
  }

  return (
    <div className="grille-2">
      <section className="carte">
        <h2>Agents du Ministère</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Nom</th><th>Fonction</th><th>E-mail</th><th>Créé le</th><th>Statut</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {(comptes || []).map((c) => (
                <tr key={c.id}>
                  <td className="cellule-nom">{c.prenom} {c.nom}</td>
                  <td>{c.fonction || ''}</td>
                  <td>{c.email}</td>
                  <td>{dateCourte(c.createdAt)}</td>
                  <td>{c.statut === 'verrouille' ? <span className="badge rouge">Verrouillé</span> : <span className="badge vert">Actif</span>}</td>
                  <td className="cellule-actions">
                    <button type="button" className="secondaire petit" onClick={() => setAction({ compte: c, corps: { statut: c.statut === 'verrouille' ? 'actif' : 'verrouille' }, titre: c.statut === 'verrouille' ? 'Réactiver le compte' : 'Verrouiller le compte', message: c.statut === 'verrouille' ? 'Compte réactivé' : 'Compte verrouillé, sessions fermées' })}>
                      {c.statut === 'verrouille' ? 'Réactiver' : 'Verrouiller'}
                    </button>
                    <button type="button" className="secondaire petit" onClick={() => setAction({ compte: c, corps: { statut: c.statut, reinitialiserApplication: true }, titre: 'Réinitialiser la double authentification', message: 'Application à reconfigurer à la prochaine connexion' })}>Téléphone perdu</button>
                  </td>
                </tr>
              ))}
              {comptes && comptes.length === 0 && <tr><td colSpan={6} className="vide">Aucun compte ministère pour l’instant.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="carte">
        <h2>Nouveau compte ministère</h2>
        <form className="formulaire" onSubmit={creer}>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="m-prenom">Prénom</label><input id="m-prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
            <div className="champ"><label htmlFor="m-nom">Nom</label><input id="m-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
          </div>
          <div className="champ"><label htmlFor="m-fonction">Fonction</label><input id="m-fonction" value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} placeholder="Ex. Directeur général de l’Enseignement supérieur" /></div>
          <div className="champ"><label htmlFor="m-email">Adresse e-mail professionnelle</label><input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="champ">
            <label htmlFor="m-mdp">Mot de passe provisoire</label>
            <div className="ligne-champs">
              <ChampMotDePasse id="m-mdp" autoComplete="new-password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} minLength={10} required />
              <button type="button" className="secondaire" onClick={() => setForm({ ...form, motDePasse: motDePasseAleatoire() })}>Générer</button>
            </div>
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          {cree && <div className="message-succes">Compte créé : {cree.email}, mot de passe provisoire <span className="mono">{cree.motDePasse}</span>. À la première connexion, l’agent configure son application d’authentification.</div>}
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Création…' : 'Créer le compte'}</button>
        </form>
      </section>
      {action && (
        <ConfirmModal titre={action.titre} boutonConfirmer="Confirmer" boutonEnCours="Enregistrement…" onConfirmer={executer} onAnnuler={() => setAction(null)}>
          {action.compte.prenom} {action.compte.nom} ({action.compte.email}). Les sessions ouvertes de ce compte seront fermées.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
