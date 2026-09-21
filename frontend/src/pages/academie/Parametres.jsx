import { useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import ChampLogo from '../../components/ChampLogo';
import { IconDocument, IconKey } from '../../components/icons';
import { motDePasseAleatoire } from '../../utils/excel';

const CHAMPS_VIDES = { nom: '', sigle: '', devise: '', ville: '', pays: '', boitePostale: '', telephone: '', email: '', logo: '' };
const COMPTE_VIDE = { nom: '', prenom: '', email: '', motDePasse: '', role: 'finance', service: '', fonction: '' };

// EduSphere s'adapte à n'importe quel établissement : cette page est le
// point unique où l'identité de l'école (nom, ville, coordonnées…) est
// renseignée — jamais codée en dur dans l'application. Elle alimente
// directement l'en-tête du bulletin, du relevé et des reçus.
export default function Parametres() {
  const [form, setForm] = useState(CHAMPS_VIDES);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  // Comptes Académie/Finance : seul moyen d'en créer, aucune autre page ne
  // le propose — POST /auth/comptes existait déjà côté backend, sans écran.
  const [compteFormOuvert, setCompteFormOuvert] = useState(false);
  const [nouveauCompte, setNouveauCompte] = useState(COMPTE_VIDE);
  const [motDePasseCompteVisible, setMotDePasseCompteVisible] = useState(false);
  const [enCoursCompte, setEnCoursCompte] = useState(false);
  const [messageCompte, setMessageCompte] = useState('');
  const [dernierCompteCree, setDernierCompteCree] = useState(null);

  useEffect(() => {
    client.get('/etablissement').then((res) => {
      const e = res.data.etablissement;
      setForm({
        nom: e.nom || '', sigle: e.sigle || '', devise: e.devise || '',
        ville: e.ville || '', pays: e.pays || 'République Gabonaise',
        boitePostale: e.boitePostale || '', telephone: e.telephone || '', email: e.email || '',
        logo: e.logo || '',
      });
      setChargement(false);
    });
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    try {
      await client.put('/etablissement', form);
      setToast({ message: 'Établissement mis à jour — le bulletin, le relevé et les reçus utilisent désormais cette identité.', type: 'succes' });
    } catch (err) {
      setToast({ message: err.response?.data?.erreur || 'échec de la mise à jour', type: 'erreur' });
    } finally {
      setEnCours(false);
    }
  }

  async function creerCompte(e) {
    e.preventDefault();
    setMessageCompte('');
    setDernierCompteCree(null);
    setEnCoursCompte(true);
    try {
      const payload = {
        nom: nouveauCompte.nom, prenom: nouveauCompte.prenom, email: nouveauCompte.email,
        motDePasse: nouveauCompte.motDePasse, role: nouveauCompte.role,
        service: nouveauCompte.role === 'academie' ? nouveauCompte.service : undefined,
        fonction: nouveauCompte.role === 'finance' ? nouveauCompte.fonction : undefined,
      };
      await client.post('/auth/comptes', payload);
      setDernierCompteCree({ email: nouveauCompte.email, motDePasse: nouveauCompte.motDePasse, role: nouveauCompte.role });
      setNouveauCompte(COMPTE_VIDE);
      setMotDePasseCompteVisible(false);
    } catch (err) {
      setMessageCompte(err.response?.data?.erreur || "échec de la création du compte");
    } finally {
      setEnCoursCompte(false);
    }
  }

  return (
    <div className="grille-2">
    <div className="carte">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconDocument width={16} height={16} /></span>
          <h2>Identité de l'établissement</h2>
        </div>
      </div>
      <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -6 }}>
        EduSphere est conçu pour être déployé sur n'importe quel établissement. Ces informations — jamais codées en dur —
        apparaissent sur le bulletin, le relevé de notes, les reçus de paiement et l'emploi du temps téléchargeable.
      </p>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && (
        <form className="formulaire" onSubmit={enregistrer}>
          <ChampLogo valeur={form.logo} onChange={(logo) => setForm({ ...form, logo })} />
          <div className="ligne-champs">
            <div className="champ"><label>Nom de l'établissement</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
            <div className="champ" style={{ maxWidth: 140 }}><label>Sigle</label><input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} placeholder="ex. IUP" /></div>
          </div>
          <div className="champ">
            <label>Devise / slogan</label>
            <input value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} placeholder="ex. Savoir · Excellence · Avenir" />
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Ville</label><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
            <div className="champ"><label>Pays</label><input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Boîte postale</label><input value={form.boitePostale} onChange={(e) => setForm({ ...form, boitePostale: e.target.value })} /></div>
            <div className="champ"><label>Téléphone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
          </div>
          <div className="champ">
            <label>E-mail de contact</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>

    <div className="carte">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconKey width={16} height={16} /></span>
          <h2>Comptes du personnel</h2>
        </div>
      </div>
      <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -6 }}>
        Crée un compte Académie (un collègue) ou Finance pour cet établissement. L'Étudiant, lui, se crée
        toujours via l'inscription d'un élève — jamais isolément ici.
      </p>

      <div className="entete-section" style={{ marginTop: 14 }}>
        <h3>Nouveau compte</h3>
        <button type="button" className={compteFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setCompteFormOuvert((v) => !v)}>
          {compteFormOuvert ? 'Annuler' : '+ Créer un compte'}
        </button>
      </div>

      {compteFormOuvert && (
        <form className="formulaire" onSubmit={creerCompte} autoComplete="off">
          <div className="champ">
            <label>Rôle</label>
            <select value={nouveauCompte.role} onChange={(e) => setNouveauCompte({ ...nouveauCompte, role: e.target.value })}>
              <option value="finance">Finance</option>
              <option value="academie">Académie</option>
            </select>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Prénom</label>
              <input value={nouveauCompte.prenom} onChange={(e) => setNouveauCompte({ ...nouveauCompte, prenom: e.target.value })} required autoFocus />
            </div>
            <div className="champ">
              <label>Nom</label>
              <input value={nouveauCompte.nom} onChange={(e) => setNouveauCompte({ ...nouveauCompte, nom: e.target.value })} required />
            </div>
          </div>
          <div className="champ">
            <label>E-mail</label>
            <input type="email" autoComplete="off" value={nouveauCompte.email} onChange={(e) => setNouveauCompte({ ...nouveauCompte, email: e.target.value })} required />
          </div>
          {nouveauCompte.role === 'academie' ? (
            <div className="champ">
              <label>Service</label>
              <input value={nouveauCompte.service} onChange={(e) => setNouveauCompte({ ...nouveauCompte, service: e.target.value })} placeholder="ex. Scolarité" />
            </div>
          ) : (
            <div className="champ">
              <label>Fonction</label>
              <input value={nouveauCompte.fonction} onChange={(e) => setNouveauCompte({ ...nouveauCompte, fonction: e.target.value })} placeholder="ex. Comptable" />
            </div>
          )}
          <div className="ligne-champs">
            <div className="champ" style={{ flex: 1 }}>
              <label>Mot de passe</label>
              <input
                type={motDePasseCompteVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={nouveauCompte.motDePasse}
                onChange={(e) => setNouveauCompte({ ...nouveauCompte, motDePasse: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <button type="button" className="secondaire" style={{ alignSelf: 'flex-end', marginBottom: 1 }} onClick={() => setMotDePasseCompteVisible((v) => !v)}>
              {motDePasseCompteVisible ? 'Masquer' : 'Afficher'}
            </button>
            <button
              type="button" className="secondaire"
              style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => { setNouveauCompte({ ...nouveauCompte, motDePasse: motDePasseAleatoire() }); setMotDePasseCompteVisible(true); }}
            >
              Générer
            </button>
          </div>
          <button className="primaire" type="submit" disabled={enCoursCompte}>{enCoursCompte ? 'Création…' : 'Créer le compte'}</button>
          {messageCompte && <div className="message-erreur">{messageCompte}</div>}
        </form>
      )}

      {dernierCompteCree && (
        <div className="message-succes" style={{ marginTop: 12, lineHeight: 1.7 }}>
          Compte {dernierCompteCree.role === 'academie' ? 'Académie' : 'Finance'} créé — identifiants à relever maintenant, ils ne seront plus jamais affichés en clair :
          <br />
          <strong style={{ fontFamily: 'var(--police-mono)' }}>{dernierCompteCree.email} / {dernierCompteCree.motDePasse}</strong>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="secondaire" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => setDernierCompteCree(null)}>
              Compris, masquer
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
