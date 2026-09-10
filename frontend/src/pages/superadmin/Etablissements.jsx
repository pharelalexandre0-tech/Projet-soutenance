import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { IconBuilding, IconKey, IconAlertTriangle } from '../../components/icons';

const LIBELLE_ROLE = { academie: 'Académie', finance: 'Finance', parent: 'Parent' };

export default function Etablissements() {
  const [etablissements, setEtablissements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [etablissementSelectionneId, setEtablissementSelectionneId] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    setChargement(true);
    client.get('/superadmin/etablissements').then((res) => {
      setEtablissements(res.data.etablissements);
      setChargement(false);
    });
  }
  useEffect(charger, []);

  function surCreationReussie(etab) {
    setModaleCreationOuverte(false);
    charger();
    setToast({ message: `"${etab.nom}" a été inséré dans le système.`, type: 'succes' });
  }

  const totalEcoles = etablissements.length;
  const totalActives = etablissements.filter((e) => e.statut === 'actif').length;
  const totalComptes = etablissements.reduce((s, e) => s + e.nbComptes, 0);
  const totalVerrouilles = etablissements.reduce((s, e) => s + e.nbComptesVerrouilles, 0);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Établissements affiliés</span><span className="puce-icone petite"><IconBuilding width={16} height={16} /></span></div>
          <div className="valeur">{totalEcoles}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Écoles actives</span></div>
          <div className="valeur">{totalActives}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Comptes système</span><span className="puce-icone petite"><IconKey width={16} height={16} /></span></div>
          <div className="valeur">{totalComptes}</div>
        </div>
        <div className={`stat-tile ${totalVerrouilles > 0 ? 'tile-or' : 'tile-vert'}`}>
          <div className="stat-tile-haut"><span className="libelle">Comptes verrouillés</span><span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span></div>
          <div className="valeur">{totalVerrouilles}</div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Établissements affiliés au système</h2>
          <button className="primaire" onClick={() => setModaleCreationOuverte(true)}>+ Insérer une école</button>
        </div>

        {chargement && <div className="chargement">Chargement…</div>}
        {!chargement && etablissements.length === 0 && <div className="vide">Aucun établissement inséré pour le moment</div>}

        <div className="grille-etablissements">
          {etablissements.map((etab) => (
            <button key={etab.id} type="button" className="carte-etablissement" onClick={() => setEtablissementSelectionneId(etab.id)}>
              <div className="carte-etablissement-entete">
                <span className="puce-icone petite"><IconBuilding width={16} height={16} /></span>
                <span className={`badge ${etab.statut === 'actif' ? 'vert' : 'rouge'}`}>{etab.statut === 'actif' ? 'active' : 'verrouillée'}</span>
              </div>
              <strong>{etab.nom}</strong>
              <small>{etab.ville}, {etab.pays}</small>
              <div className="carte-etablissement-compteurs">
                <span>{etab.nbComptes} compte{etab.nbComptes !== 1 ? 's' : ''} système</span>
                {etab.nbComptesVerrouilles > 0 && <span style={{ color: 'var(--alerte)' }}>{etab.nbComptesVerrouilles} verrouillé(s)</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {modaleCreationOuverte && (
        <FormulaireCreationEcole onFermer={() => setModaleCreationOuverte(false)} onReussi={surCreationReussie} />
      )}
      {etablissementSelectionneId && (
        <DetailEtablissement
          etablissementId={etablissementSelectionneId}
          onFermer={() => setEtablissementSelectionneId(null)}
          onModifie={(msg) => { charger(); setToast({ message: msg || 'Établissement mis à jour.', type: 'succes' }); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireCreationEcole({ onFermer, onReussi }) {
  const [form, setForm] = useState({
    nom: '', sigle: '', devise: '', ville: '', pays: 'République Gabonaise', boitePostale: '', telephone: '', email: '',
    academieNom: '', academiePrenom: '', academieEmail: '', academieMotDePasse: '',
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/superadmin/etablissements', form);
      onReussi(res.data.etablissement);
    } catch (err) {
      setErreur(err.response?.data?.erreur || "impossible d'insérer cette école");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Insérer une nouvelle école" onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={soumettre}>
        <h3 style={{ marginBottom: -6 }}>Identité de l'établissement</h3>
        <div className="ligne-champs">
          <div className="champ"><label>Nom de l'établissement</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
          <div className="champ" style={{ maxWidth: 120 }}><label>Sigle</label><input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Ville</label><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
          <div className="champ"><label>Pays</label><input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} /></div>
        </div>
        <div className="champ"><label>Devise / slogan</label><input value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Boîte postale</label><input value={form.boitePostale} onChange={(e) => setForm({ ...form, boitePostale: e.target.value })} /></div>
          <div className="champ"><label>Téléphone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
        </div>
        <div className="champ"><label>E-mail de contact</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

        <h3 style={{ marginTop: 8, marginBottom: -6 }}>Premier compte Académie</h3>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.academiePrenom} onChange={(e) => setForm({ ...form, academiePrenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.academieNom} onChange={(e) => setForm({ ...form, academieNom: e.target.value })} required /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>E-mail</label><input type="email" value={form.academieEmail} onChange={(e) => setForm({ ...form, academieEmail: e.target.value })} required /></div>
          <div className="champ"><label>Mot de passe</label><input type="password" value={form.academieMotDePasse} onChange={(e) => setForm({ ...form, academieMotDePasse: e.target.value })} required /></div>
        </div>

        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Insertion…' : "Insérer l'école"}</button>
      </form>
    </Modal>
  );
}

function DetailEtablissement({ etablissementId, onFermer, onModifie }) {
  const [donnees, setDonnees] = useState(null);
  const [form, setForm] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [compteEnAction, setCompteEnAction] = useState(null);
  const [compteAReinitialiser, setCompteAReinitialiser] = useState(null);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');

  function charger() {
    client.get(`/superadmin/etablissements/${etablissementId}`).then((res) => {
      setDonnees(res.data);
      const e = res.data.etablissement;
      setForm({
        nom: e.nom || '', sigle: e.sigle || '', devise: e.devise || '', ville: e.ville || '',
        pays: e.pays || '', boitePostale: e.boitePostale || '', telephone: e.telephone || '', email: e.email || '',
      });
    });
  }
  useEffect(charger, [etablissementId]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/superadmin/etablissements/${etablissementId}`, form);
      onModifie('Établissement mis à jour.');
      onFermer();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'échec de la mise à jour');
    } finally {
      setEnCours(false);
    }
  }

  async function basculerStatutEcole() {
    const nouveauStatut = donnees.etablissement.statut === 'actif' ? 'suspendu' : 'actif';
    await client.patch(`/superadmin/etablissements/${etablissementId}/statut`, { statut: nouveauStatut });
    onModifie(nouveauStatut === 'suspendu' ? 'École verrouillée — tous ses comptes ont perdu l\'accès.' : 'École réactivée.');
    onFermer();
  }

  async function confirmerSuppression() {
    setSuppressionEnCours(true);
    setErreurSuppression('');
    try {
      await client.delete(`/superadmin/etablissements/${etablissementId}`);
      onModifie(`"${donnees.etablissement.nom}" a été supprimé du système.`);
      onFermer();
    } catch (err) {
      setErreurSuppression(err.response?.data?.erreur || 'échec de la suppression');
      setSuppressionEnCours(false);
    }
  }

  async function basculerStatutCompte(compte) {
    setCompteEnAction(compte.id);
    const nouveauStatut = compte.statut === 'actif' ? 'verrouille' : 'actif';
    await client.patch(`/superadmin/comptes/${compte.id}/statut`, { statut: nouveauStatut });
    setCompteEnAction(null);
    charger();
    // Les compteurs de la liste des écoles (en arrière-plan) doivent aussi
    // refléter ce changement sans attendre la fermeture de la modale.
    onModifie(nouveauStatut === 'verrouille' ? `${compte.prenom} ${compte.nom} verrouillé(e).` : `${compte.prenom} ${compte.nom} déverrouillé(e).`);
  }

  if (!donnees || !form) {
    return <Modal titre="Chargement…" onFermer={onFermer}><div className="chargement">Chargement…</div></Modal>;
  }

  return (
    <Modal titre={donnees.etablissement.nom} onFermer={onFermer} largeur={640}>
      <div className="ligne-champs" style={{ marginBottom: 18, alignItems: 'center' }}>
        <span className={`badge ${donnees.etablissement.statut === 'actif' ? 'vert' : 'rouge'}`}>
          {donnees.etablissement.statut === 'actif' ? 'école active' : 'école verrouillée'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className={donnees.etablissement.statut === 'actif' ? 'danger secondaire' : 'secondaire'} onClick={basculerStatutEcole}>
            {donnees.etablissement.statut === 'actif' ? 'Verrouiller cette école' : 'Réactiver cette école'}
          </button>
          {donnees.peutEtreSupprime && (
            <button type="button" className="danger secondaire" onClick={() => setConfirmationSuppression(true)}>Supprimer cette école</button>
          )}
        </div>
      </div>

      {confirmationSuppression && (
        <div className="message-erreur" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>Supprimer définitivement "{donnees.etablissement.nom}" et son compte Académie ? Cette action est irréversible.</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="secondaire" onClick={() => setConfirmationSuppression(false)} disabled={suppressionEnCours}>Annuler</button>
            <button type="button" className="danger secondaire" onClick={confirmerSuppression} disabled={suppressionEnCours}>
              {suppressionEnCours ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      )}
      {erreurSuppression && <div className="message-erreur" style={{ marginBottom: 18 }}>{erreurSuppression}</div>}

      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ"><label>Nom</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
          <div className="champ" style={{ maxWidth: 120 }}><label>Sigle</label><input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Ville</label><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
          <div className="champ"><label>Pays</label><input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours} style={{ alignSelf: 'flex-start' }}>{enCours ? 'Enregistrement…' : 'Enregistrer la mise à jour'}</button>
      </form>

      <h3 style={{ marginTop: 22 }}>Comptes système rattachés</h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Nom</th><th>Rôle</th><th>E-mail</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {donnees.comptes.map((c) => (
              <tr key={c.id}>
                <td>{c.prenom} {c.nom}</td>
                <td><span className="badge gris">{LIBELLE_ROLE[c.role] || c.role}</span></td>
                <td className="note-secondaire">{c.email}</td>
                <td><span className={`badge ${c.statut === 'actif' ? 'vert' : 'rouge'}`}>{c.statut === 'actif' ? 'actif' : 'verrouillé'}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondaire" disabled={compteEnAction === c.id} onClick={() => basculerStatutCompte(c)}>
                    {c.statut === 'actif' ? 'Verrouiller' : 'Déverrouiller'}
                  </button>
                  <button className="secondaire" onClick={() => setCompteAReinitialiser(c)}>Réinitialiser</button>
                </td>
              </tr>
            ))}
            {donnees.comptes.length === 0 && <tr><td colSpan={5} className="vide">Aucun compte pour cette école</td></tr>}
          </tbody>
        </table>
      </div>

      {compteAReinitialiser && (
        <FormulaireReinitialisation
          compte={compteAReinitialiser}
          onFermer={() => setCompteAReinitialiser(null)}
          onReussi={() => { setCompteAReinitialiser(null); onModifie(`Mot de passe de ${compteAReinitialiser.prenom} ${compteAReinitialiser.nom} réinitialisé.`); }}
        />
      )}
    </Modal>
  );
}

function FormulaireReinitialisation({ compte, onFermer, onReussi }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post(`/superadmin/comptes/${compte.id}/reinitialiser-mot-de-passe`, { nouveauMotDePasse: motDePasse });
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'échec de la réinitialisation');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Réinitialiser le mot de passe — ${compte.prenom} ${compte.nom}`} onFermer={onFermer} largeur={420}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="champ">
          <label>Nouveau mot de passe</label>
          <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} minLength={6} required />
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Réinitialisation…' : 'Réinitialiser'}</button>
      </form>
    </Modal>
  );
}
