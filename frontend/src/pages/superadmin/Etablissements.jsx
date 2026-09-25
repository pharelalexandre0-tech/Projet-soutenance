import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import ChampLogo from '../../components/ChampLogo';
import { messageErreur } from '../../utils/erreurs';
import { IconBuilding, IconKey, IconAlertTriangle, IconDownload } from '../../components/icons';

const TRIS = {
  recent: { libelle: 'Plus récentes', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  nom: { libelle: 'Nom (A→Z)', fn: (a, b) => a.nom.localeCompare(b.nom) },
  ville: { libelle: 'Ville (A→Z)', fn: (a, b) => a.ville.localeCompare(b.ville) },
  comptes: { libelle: 'Le plus de comptes', fn: (a, b) => b.nbComptes - a.nbComptes },
};

// Échappe pour un CSV correct dès qu'une valeur contient un séparateur, un
// guillemet ou un retour à la ligne — sinon "Ville, Pays" éclaterait la
// ligne en deux colonnes à l'ouverture dans un tableur.
function celluleCsv(valeur) {
  const texte = String(valeur ?? '');
  return /[",\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

export default function Etablissements() {
  const [etablissements, setEtablissements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [etablissementSelectionneId, setEtablissementSelectionneId] = useState(null);
  const [toast, setToast] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [tri, setTri] = useState('recent');

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

  const rechercheNettoyee = recherche.trim().toLowerCase();
  const etablissementsAffiches = etablissements
    .filter((e) => !rechercheNettoyee || `${e.nom} ${e.ville}`.toLowerCase().includes(rechercheNettoyee))
    .filter((e) => !filtreStatut || e.statut === filtreStatut)
    .sort(TRIS[tri].fn);

  function exporterCsv() {
    const entetes = ['Nom', 'Sigle', 'Ville', 'Pays', 'Statut', 'Comptes', 'Comptes verrouillés', "Date d'affiliation"];
    const lignes = etablissementsAffiches.map((e) => [
      e.nom, e.sigle || '', e.ville, e.pays, e.statut, e.nbComptes, e.nbComptesVerrouilles,
      new Date(e.createdAt).toLocaleDateString('fr-FR'),
    ]);
    // ﻿ (BOM UTF-8) : sans lui, Excel sous Windows lit les accents du
    // fichier comme du Latin-1 et affiche "Ã©cole" à la place de "école".
    const contenu = '﻿' + [entetes, ...lignes].map((ligne) => ligne.map(celluleCsv).join(',')).join('\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
    lien.download = `etablissements-edusphere-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

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
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="secondaire"
              onClick={exporterCsv}
              disabled={etablissementsAffiches.length === 0}
              title="Exporter la liste affichée en CSV"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconDownload width={15} height={15} /> Exporter
            </button>
            <button className="primaire" onClick={() => setModaleCreationOuverte(true)}>+ Insérer une école</button>
          </div>
        </div>

        <div className="ligne-champs" style={{ marginBottom: 16 }}>
          <input
            type="search"
            placeholder="Rechercher par nom ou ville…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ flex: 2, minWidth: 200 }}
          />
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actives</option>
            <option value="suspendu">Verrouillées</option>
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ maxWidth: 190 }}>
            {Object.entries(TRIS).map(([id, { libelle }]) => <option key={id} value={id}>{libelle}</option>)}
          </select>
        </div>

        {chargement && <div className="chargement">Chargement…</div>}
        {!chargement && etablissements.length === 0 && <div className="vide">Aucun établissement inséré pour le moment</div>}
        {!chargement && etablissements.length > 0 && etablissementsAffiches.length === 0 && (
          <div className="vide">Aucun établissement ne correspond à cette recherche</div>
        )}

        <div className="grille-etablissements">
          {etablissementsAffiches.map((etab) => (
            <button key={etab.id} type="button" className="carte-etablissement" onClick={() => setEtablissementSelectionneId(etab.id)}>
              <div className="carte-etablissement-entete">
                {etab.logo ? (
                  <span className="puce-icone petite" style={{ background: 'var(--carte)', border: '1px solid var(--bordure)', padding: 3, overflow: 'hidden' }}>
                    <img src={etab.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </span>
                ) : (
                  <span className="puce-icone petite"><IconBuilding width={16} height={16} /></span>
                )}
                <span className={`badge ${etab.statut === 'actif' ? 'vert' : 'rouge'}`}>{etab.statut === 'actif' ? 'active' : 'verrouillée'}</span>
              </div>
              <strong>{etab.nom}</strong>
              <small>{etab.ville}, {etab.pays}</small>
              <div className="carte-etablissement-compteurs">
                <span>{etab.nbComptes} compte{etab.nbComptes !== 1 ? 's' : ''} système</span>
                {etab.nbComptesVerrouilles > 0 && <span style={{ color: 'var(--alerte)' }}>{etab.nbComptesVerrouilles} verrouillé(s)</span>}
              </div>
              <div className="note-secondaire" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                Affiliée le {new Date(etab.createdAt).toLocaleDateString('fr-FR')}
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
    nom: '', sigle: '', devise: '', ville: '', pays: 'République Gabonaise', boitePostale: '', telephone: '', email: '', logo: '',
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
      setErreur(messageErreur(err, "impossible d'insérer cette école"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Insérer une nouvelle école" onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={soumettre} autoComplete="off">
        <h3 style={{ marginBottom: -6 }}>Identité de l'établissement</h3>
        <ChampLogo valeur={form.logo} onChange={(logo) => setForm({ ...form, logo })} />
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
        <div className="champ"><label>E-mail de contact</label><input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

        <h3 style={{ marginTop: 8, marginBottom: -6 }}>Premier compte Académie</h3>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.academiePrenom} onChange={(e) => setForm({ ...form, academiePrenom: e.target.value })} required /></div>
          <div className="champ"><label>Nom</label><input value={form.academieNom} onChange={(e) => setForm({ ...form, academieNom: e.target.value })} required /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>E-mail</label><input type="email" autoComplete="off" value={form.academieEmail} onChange={(e) => setForm({ ...form, academieEmail: e.target.value })} required /></div>
          <div className="champ"><label>Mot de passe</label><input type="password" autoComplete="new-password" value={form.academieMotDePasse} onChange={(e) => setForm({ ...form, academieMotDePasse: e.target.value })} required /></div>
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
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [confirmationReinitAcademie, setConfirmationReinitAcademie] = useState(false);
  const [reinitEnCours, setReinitEnCours] = useState(false);
  const [reinitResultat, setReinitResultat] = useState(null);
  const [erreurReinit, setErreurReinit] = useState('');

  function charger() {
    client.get(`/superadmin/etablissements/${etablissementId}`).then((res) => {
      setDonnees(res.data);
      const e = res.data.etablissement;
      setForm({
        nom: e.nom || '', sigle: e.sigle || '', devise: e.devise || '', ville: e.ville || '',
        pays: e.pays || '', boitePostale: e.boitePostale || '', telephone: e.telephone || '', email: e.email || '',
        logo: e.logo || '',
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
      setErreur(messageErreur(err, 'échec de la mise à jour'));
    } finally {
      setEnCours(false);
    }
  }

  async function basculerStatutEcole() {
    const nouveauStatut = donnees.etablissement.statut === 'actif' ? 'suspendu' : 'actif';
    await client.patch(`/superadmin/etablissements/${etablissementId}/statut`, { statut: nouveauStatut });
    onModifie(nouveauStatut === 'suspendu' ? 'École verrouillée. Tous ses comptes ont perdu l\'accès.' : 'École réactivée.');
    onFermer();
  }

  async function confirmerSuppression() {
    await client.delete(`/superadmin/etablissements/${etablissementId}`);
    onModifie(`"${donnees.etablissement.nom}" a été supprimé du système.`);
    onFermer();
  }

  // Reste dans la modale (jamais onFermer) pour laisser le temps de relever
  // le mot de passe — comme partout ailleurs dans l'app, il ne redevient
  // plus jamais lisible une fois cet écran quitté.
  async function confirmerReinitAcademie() {
    setReinitEnCours(true);
    setErreurReinit('');
    try {
      const res = await client.put(`/superadmin/etablissements/${etablissementId}/reinitialiser-academie`);
      setReinitResultat(res.data);
      setConfirmationReinitAcademie(false);
    } catch (err) {
      setErreurReinit(messageErreur(err, 'échec de la réinitialisation'));
      setConfirmationReinitAcademie(false);
    } finally {
      setReinitEnCours(false);
    }
  }

  if (!donnees || !form) {
    return <Modal titre="Chargement…" onFermer={onFermer}><div className="chargement">Chargement…</div></Modal>;
  }

  return (
    <>
    <Modal titre={donnees.etablissement.nom} onFermer={onFermer} largeur={640}>
      <div className="ligne-champs" style={{ marginBottom: 18, alignItems: 'center' }}>
        <span className={`badge ${donnees.etablissement.statut === 'actif' ? 'vert' : 'rouge'}`}>
          {donnees.etablissement.statut === 'actif' ? 'école active' : 'école verrouillée'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="secondaire" onClick={() => setConfirmationReinitAcademie(true)} disabled={reinitEnCours}>
            {reinitEnCours ? 'Réinitialisation…' : "Réinitialiser l'accès Académie"}
          </button>
          <button type="button" className={donnees.etablissement.statut === 'actif' ? 'danger secondaire' : 'secondaire'} onClick={basculerStatutEcole}>
            {donnees.etablissement.statut === 'actif' ? 'Verrouiller cette école' : 'Réactiver cette école'}
          </button>
          <button type="button" className="danger secondaire" onClick={() => setConfirmationSuppression(true)}>Supprimer cette école</button>
        </div>
      </div>

      {erreurReinit && <div className="message-erreur" style={{ marginBottom: 16 }}>{erreurReinit}</div>}
      {reinitResultat && (
        <div className="carte" style={{ background: '#fbf3df', marginBottom: 18, boxShadow: 'none' }}>
          <strong>Nouvel accès généré pour {reinitResultat.email}</strong>
          <p className="note-secondaire" style={{ margin: '4px 0 8px' }}>
            À transmettre à l'école maintenant : ce mot de passe ne sera plus jamais affiché en clair une fois cette fenêtre fermée.
          </p>
          <div style={{ fontFamily: 'var(--police-mono)', fontSize: '0.95rem' }}>
            {reinitResultat.email} / {reinitResultat.motDePasse}
          </div>
        </div>
      )}

      <form className="formulaire" onSubmit={enregistrer}>
        <ChampLogo valeur={form.logo} onChange={(logo) => setForm({ ...form, logo })} />
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
    </Modal>
    {confirmationSuppression && (
      <ConfirmModal
        titre="Supprimer cette école ?"
        onAnnuler={() => setConfirmationSuppression(false)}
        onConfirmer={confirmerSuppression}
        boutonConfirmer="Confirmer la suppression"
        boutonEnCours="Suppression…"
      >
        Supprimer définitivement "{donnees.etablissement.nom}" : classes, élèves, notes, absences, frais et tous ses
        comptes compris ? Cette action est irréversible.
      </ConfirmModal>
    )}
    {confirmationReinitAcademie && (
      <ConfirmModal
        titre="Réinitialiser l'accès Académie ?"
        onAnnuler={() => setConfirmationReinitAcademie(false)}
        onConfirmer={confirmerReinitAcademie}
        boutonConfirmer="Réinitialiser"
        boutonEnCours="Réinitialisation…"
      >
        Un nouveau mot de passe sera généré pour le premier compte Académie de "{donnees.etablissement.nom}"
        (l'ancien cessera immédiatement de fonctionner). À utiliser en dépannage si l'école ne peut plus se
        connecter ni recevoir d'e-mail de réinitialisation.
      </ConfirmModal>
    )}
    </>
  );
}
