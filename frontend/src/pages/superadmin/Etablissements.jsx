import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import ChampLogo from '../../components/ChampLogo';
import ChampMotDePasse from '../../components/ChampMotDePasse';
import { messageErreur } from '../../utils/erreurs';
import { LIBELLES_ESPACES } from '../../utils/plateforme';
import {
  IconBuilding, IconKey, IconDownload, IconCheck, IconPlus, IconSearch, IconChevronRight, IconArrowLeft,
  IconToggle, IconLock, IconTrash,
} from '../../components/icons';
import { LIBELLES_TYPES, TuileFonctionnalite } from './Fonctionnalites';

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

function VignetteLogo({ logo }) {
  return (
    <span className="vignette-logo">
      {logo ? <img src={logo} alt="" /> : <IconBuilding />}
    </span>
  );
}

// Écoles affiliées : la liste, puis la fiche de chaque école (ses
// fonctionnalités, ses informations, ses accès) sur une vraie page plutôt
// que dans une fenêtre.
export default function Etablissements({ onNaviguer }) {
  const [etablissements, setEtablissements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [ecoleOuverte, setEcoleOuverte] = useState(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [toast, setToast] = useState(null);

  function charger(silencieux = false) {
    if (!silencieux) setChargement(true);
    return client.get('/superadmin/etablissements').then((res) => {
      setEtablissements(res.data.etablissements);
      setChargement(false);
    });
  }
  useEffect(() => { charger(); }, []);
  useActualisation(() => charger(true), { delai: 1500 });

  if (ecoleOuverte) {
    return (
      <FicheEtablissement
        etablissementId={ecoleOuverte}
        onRetour={() => { setEcoleOuverte(null); charger(); }}
        onNaviguer={onNaviguer}
        onSupprime={(nom) => {
          setEcoleOuverte(null);
          charger();
          setToast({ message: `« ${nom} » a été supprimée du système.`, type: 'succes' });
        }}
      />
    );
  }

  return (
    <>
      <ListeEtablissements
        etablissements={etablissements}
        chargement={chargement}
        onOuvrir={setEcoleOuverte}
        onCreer={() => setCreationOuverte(true)}
      />
      {creationOuverte && (
        <FormulaireCreationEcole
          onFermer={() => setCreationOuverte(false)}
          onReussi={(etab) => {
            setCreationOuverte(false);
            charger();
            setToast({ message: `« ${etab.nom} » a été affiliée à la plateforme.`, type: 'succes' });
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function ListeEtablissements({ etablissements, chargement, onOuvrir, onCreer }) {
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [tri, setTri] = useState('recent');

  const totalActives = etablissements.filter((e) => e.statut === 'actif').length;
  const totalComptes = etablissements.reduce((s, e) => s + e.nbComptes, 0);
  const totalVerrouilles = etablissements.reduce((s, e) => s + e.nbComptesVerrouilles, 0);

  const affiches = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return etablissements
      .filter((e) => !texte || `${e.nom} ${e.sigle || ''} ${e.ville}`.toLowerCase().includes(texte))
      .filter((e) => !filtreStatut || e.statut === filtreStatut)
      .sort(TRIS[tri].fn);
  }, [etablissements, recherche, filtreStatut, tri]);

  function exporterCsv() {
    const entetes = ['Nom', 'Sigle', 'Ville', 'Pays', 'Statut', 'Fonctionnalités', 'Comptes', 'Comptes verrouillés', "Date d'affiliation"];
    const lignes = affiches.map((e) => [
      e.nom, e.sigle || '', e.ville, e.pays, e.statut, e.nbFonctionnalites ?? '', e.nbComptes, e.nbComptesVerrouilles,
      new Date(e.createdAt).toLocaleDateString('fr-FR'),
    ]);
    // BOM UTF-8 en tête : sans lui, Excel sous Windows lit les accents du
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
          <div className="stat-tile-haut"><span className="libelle">Écoles affiliées</span><span className="puce-icone petite"><IconBuilding /></span></div>
          <div className="valeur">{etablissements.length}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Écoles actives</span><span className="puce-icone petite"><IconCheck /></span></div>
          <div className="valeur">{totalActives}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Comptes des écoles</span><span className="puce-icone petite"><IconKey /></span></div>
          <div className="valeur">{totalComptes}</div>
        </div>
        <div className={`stat-tile ${totalVerrouilles > 0 ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Comptes verrouillés</span><span className="puce-icone petite"><IconLock /></span></div>
          <div className="valeur">{totalVerrouilles}</div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Écoles affiliées</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="secondaire" onClick={exporterCsv} disabled={affiches.length === 0} title="Exporter la liste affichée en CSV">
              <IconDownload /> Exporter
            </button>
            <button className="primaire" onClick={onCreer}><IconPlus /> Affilier une école</button>
          </div>
        </div>

        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher par nom, sigle ou ville" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <div className="espaceur" />
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            <option value="actif">Actives</option>
            <option value="suspendu">Verrouillées</option>
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier">
            {Object.entries(TRIS).map(([id, { libelle }]) => <option key={id} value={id}>{libelle}</option>)}
          </select>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>École</th>
                <th>Sigle</th>
                <th>Ville</th>
                <th>Statut</th>
                <th className="chiffre">Fonctionnalités</th>
                <th className="chiffre">Comptes</th>
                <th className="chiffre">Verrouillés</th>
                <th>Affiliée le</th>
                <th aria-label="Ouvrir la fiche" />
              </tr>
            </thead>
            <tbody>
              {affiches.map((etab) => (
                <tr key={etab.id} className="ligne-cliquable" onClick={() => onOuvrir(etab.id)}>
                  <td className="cellule-nom"><span className="cellule-avec-logo"><VignetteLogo logo={etab.logo} />{etab.nom}</span></td>
                  <td>{etab.sigle || <span className="note-secondaire">Aucun</span>}</td>
                  <td>{etab.ville}</td>
                  <td><span className={`badge ${etab.statut === 'actif' ? 'vert' : 'rouge'}`}>{etab.statut === 'actif' ? 'Active' : 'Verrouillée'}</span></td>
                  <td className="chiffre">{etab.nbFonctionnalites ?? 0}</td>
                  <td className="chiffre">{etab.nbComptes}</td>
                  <td className="chiffre">{etab.nbComptesVerrouilles > 0 ? <span className="texte-alerte">{etab.nbComptesVerrouilles}</span> : 0}</td>
                  <td>{new Date(etab.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {chargement && <tr><td colSpan={9} className="chargement">Chargement…</td></tr>}
              {!chargement && affiches.length === 0 && (
                <tr><td colSpan={9} className="vide">{etablissements.length === 0 ? 'Aucune école affiliée pour le moment.' : 'Aucune école ne correspond à cette recherche.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function FicheEtablissement({ etablissementId, onRetour, onSupprime, onNaviguer }) {
  const [etablissement, setEtablissement] = useState(null);
  const [catalogue, setCatalogue] = useState(null);
  const [onglet, setOnglet] = useState('fonctionnalites');
  const [toast, setToast] = useState(null);

  function chargerEcole() {
    return client.get(`/superadmin/etablissements/${etablissementId}`).then((res) => setEtablissement(res.data.etablissement));
  }
  function chargerCatalogue() {
    return client.get('/superadmin/fonctionnalites').then((res) => setCatalogue(res.data.fonctionnalites));
  }
  useEffect(() => { chargerEcole(); chargerCatalogue(); }, [etablissementId]);
  useActualisation(() => { chargerEcole().catch(() => {}); chargerCatalogue().catch(() => {}); }, { delai: 1500 });

  if (!etablissement) return <div className="chargement">Chargement…</div>;

  const siennes = (catalogue || []).filter((f) => f.ecoles.includes(etablissementId));
  const notifier = (message, type = 'succes') => setToast({ message, type });

  return (
    <>
      <div className="retour-liste">
        <button className="bouton-texte" onClick={onRetour}><IconArrowLeft /> Toutes les écoles</button>
      </div>

      <div className="fiche-entete">
        <VignetteLogo logo={etablissement.logo} />
        <div className="fiche-entete-textes">
          <h2>
            {etablissement.nom}
            <span className={`badge ${etablissement.statut === 'actif' ? 'vert' : 'rouge'}`}>{etablissement.statut === 'actif' ? 'Active' : 'Verrouillée'}</span>
          </h2>
          <p>
            {etablissement.sigle ? `${etablissement.sigle} · ` : ''}{etablissement.ville}, {etablissement.pays}
            {' · '}Affiliée le {new Date(etablissement.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      <div className="onglets-secondaires" role="tablist">
        <button role="tab" aria-selected={onglet === 'fonctionnalites'} className={onglet === 'fonctionnalites' ? 'actif' : ''} onClick={() => setOnglet('fonctionnalites')}>
          Fonctionnalités <span className="compteur">{catalogue ? siennes.length : '…'}</span>
        </button>
        <button role="tab" aria-selected={onglet === 'informations'} className={onglet === 'informations' ? 'actif' : ''} onClick={() => setOnglet('informations')}>
          Informations
        </button>
        <button role="tab" aria-selected={onglet === 'acces'} className={onglet === 'acces' ? 'actif' : ''} onClick={() => setOnglet('acces')}>
          Accès et sécurité
        </button>
      </div>

      {onglet === 'fonctionnalites' && (
        <FonctionnalitesEcole
          etablissement={etablissement}
          catalogue={catalogue}
          siennes={siennes}
          onCatalogue={setCatalogue}
          onNaviguer={onNaviguer}
          notifier={notifier}
        />
      )}
      {onglet === 'informations' && (
        <InformationsEcole etablissement={etablissement} onEnregistre={(e) => { setEtablissement(e); notifier('Informations de l’école enregistrées.'); }} />
      )}
      {onglet === 'acces' && (
        <AccesEcole etablissement={etablissement} onStatut={(e) => setEtablissement(e)} onSupprime={onSupprime} notifier={notifier} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FonctionnalitesEcole({ etablissement, catalogue, siennes, onCatalogue, onNaviguer, notifier }) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [aRetirer, setARetirer] = useState(null);

  async function retirer() {
    const res = await client.delete(`/superadmin/etablissements/${etablissement.id}/fonctionnalites/${aRetirer.cle}`);
    onCatalogue(res.data.fonctionnalites);
    notifier(`« ${aRetirer.nom} » a été retirée de ${etablissement.nom}.`);
    setARetirer(null);
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Fonctionnalités de l'école</h2>
        <button className="primaire" onClick={() => setAjoutOuvert(true)} disabled={!catalogue}><IconPlus /> Ajouter une fonctionnalité</button>
      </div>
      <p className="note-secondaire texte-aide">
        Le socle (élèves, classes, unités d'enseignement, notes, bulletins et frais) est toujours inclus. Ajoute ici
        uniquement ce dont cette école a besoin : les onglets correspondants apparaissent dans ses espaces en moins d'une minute.
      </p>

      {!catalogue && <div className="chargement">Chargement…</div>}
      {catalogue && siennes.length === 0 && (
        <div className="vide">Aucune fonctionnalité optionnelle pour cette école. Ajoute celles dont elle a besoin.</div>
      )}
      {catalogue && siennes.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Fonctionnalité</th><th>Description</th><th>Type</th><th>Espaces</th><th aria-label="Retirer" /></tr></thead>
            <tbody>
              {siennes.map((f) => (
                <tr key={f.cle}>
                  <td className="cellule-nom"><span className="cellule-avec-logo"><TuileFonctionnalite fonctionnalite={f} />{f.nom}</span></td>
                  <td className="cellule-description">{f.description}</td>
                  <td><span className={`badge sans-point ${f.integree ? 'bleu' : 'gris'}`}>{LIBELLES_TYPES[f.type]}</span></td>
                  <td><div className="puces">{f.espaces.map((e) => <span key={e} className="puce">{LIBELLES_ESPACES[e] || e}</span>)}</div></td>
                  <td className="cellule-actions"><button className="secondaire" onClick={() => setARetirer(f)}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ajoutOuvert && (
        <AjoutFonctionnalites
          etablissement={etablissement}
          disponibles={catalogue.filter((f) => !f.ecoles.includes(etablissement.id))}
          onFermer={() => setAjoutOuvert(false)}
          onCreerNouvelle={() => { setAjoutOuvert(false); onNaviguer?.('fonctionnalites'); }}
          onAjoutees={(nouveauCatalogue, noms) => {
            setAjoutOuvert(false);
            onCatalogue(nouveauCatalogue);
            notifier(`${noms.length > 1 ? `${noms.length} fonctionnalités ajoutées` : `« ${noms[0]} » ajoutée`} à ${etablissement.nom}.`);
          }}
        />
      )}
      {aRetirer && (
        <ConfirmModal
          titre={`Retirer « ${aRetirer.nom} » ?`}
          boutonConfirmer="Retirer"
          boutonEnCours="Retrait…"
          onConfirmer={retirer}
          onAnnuler={() => setARetirer(null)}
        >
          L'onglet disparaîtra des espaces de {etablissement.nom}. Les données déjà saisies sont conservées et
          réapparaîtront si tu ajoutes de nouveau cette fonctionnalité.
        </ConfirmModal>
      )}
    </div>
  );
}

function AjoutFonctionnalites({ etablissement, disponibles, onFermer, onAjoutees, onCreerNouvelle }) {
  const [choix, setChoix] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const texte = recherche.trim().toLowerCase();
  const affichees = disponibles.filter((f) => !texte || `${f.nom} ${f.description}`.toLowerCase().includes(texte));

  function basculer(cle) {
    setChoix((c) => (c.includes(cle) ? c.filter((x) => x !== cle) : [...c, cle]));
  }

  async function ajouter() {
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post(`/superadmin/etablissements/${etablissement.id}/fonctionnalites`, { cles: choix });
      onAjoutees(res.data.fonctionnalites, disponibles.filter((f) => choix.includes(f.cle)).map((f) => f.nom));
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'ajouter ces fonctionnalités"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Ajouter à ${etablissement.nom}`} onFermer={onFermer} largeur={600}>
      {disponibles.length === 0 ? (
        <>
          <div className="vide" style={{ marginBottom: 16 }}>
            Cette école a déjà toutes les fonctionnalités du catalogue.
          </div>
          <div className="confirmation-actions">
            <button className="secondaire" onClick={onFermer}>Fermer</button>
            <button className="primaire" onClick={onCreerNouvelle}><IconToggle /> Créer une nouvelle fonctionnalité</button>
          </div>
        </>
      ) : (
        <div className="formulaire">
          <label className="champ-recherche">
            <IconSearch />
            <input autoFocus placeholder="Rechercher dans le catalogue" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <div className="liste-selection" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {affichees.length === 0 && <div className="palette-vide">Aucune fonctionnalité ne correspond.</div>}
            {affichees.map((f) => {
              const choisie = choix.includes(f.cle);
              return (
                <button key={f.cle} type="button" className={`option-selection ${choisie ? 'choisie' : ''}`} onClick={() => basculer(f.cle)} aria-pressed={choisie}>
                  <span className="case-choix-coche">{choisie && <IconCheck />}</span>
                  <TuileFonctionnalite fonctionnalite={f} />
                  <span className="textes">
                    <strong>{f.nom}</strong>
                    <small>{LIBELLES_TYPES[f.type]} · {f.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="note-secondaire" style={{ margin: 0, fontSize: 13 }}>
            Besoin d'autre chose ? <button type="button" className="lien-texte" onClick={onCreerNouvelle}>Crée une nouvelle fonctionnalité</button>.
          </p>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
            <button type="button" className="primaire" onClick={ajouter} disabled={choix.length === 0 || enCours}>
              {enCours ? 'Ajout…' : choix.length > 1 ? `Ajouter ${choix.length} fonctionnalités` : 'Ajouter'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InformationsEcole({ etablissement: e, onEnregistre }) {
  const [form, setForm] = useState({
    nom: e.nom || '', sigle: e.sigle || '', devise: e.devise || '', ville: e.ville || '', pays: e.pays || '',
    boitePostale: e.boitePostale || '', telephone: e.telephone || '', email: e.email || '', logo: e.logo || '',
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (ev) => setForm({ ...form, [champ]: ev.target.value });

  async function enregistrer(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.put(`/superadmin/etablissements/${e.id}`, form);
      onEnregistre(res.data.etablissement);
    } catch (err) {
      setErreur(messageErreur(err, 'échec de la mise à jour'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Identité et coordonnées</h2>
      <form className="formulaire" onSubmit={enregistrer} style={{ maxWidth: 760 }}>
        <ChampLogo valeur={form.logo} onChange={(logo) => setForm({ ...form, logo })} />
        <div className="ligne-champs">
          <div className="champ" style={{ flex: 3 }}><label>Nom de l'établissement</label><input value={form.nom} onChange={maj('nom')} required /></div>
          <div className="champ"><label>Sigle</label><input value={form.sigle} onChange={maj('sigle')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Ville</label><input value={form.ville} onChange={maj('ville')} required /></div>
          <div className="champ"><label>Pays</label><input value={form.pays} onChange={maj('pays')} /></div>
        </div>
        <div className="champ"><label>Devise</label><input value={form.devise} onChange={maj('devise')} /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Boîte postale</label><input value={form.boitePostale} onChange={maj('boitePostale')} /></div>
          <div className="champ"><label>Téléphone</label><input value={form.telephone} onChange={maj('telephone')} /></div>
          <div className="champ"><label>E-mail de contact</label><input type="email" value={form.email} onChange={maj('email')} /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}

function AccesEcole({ etablissement, onStatut, onSupprime, notifier }) {
  const [confirmation, setConfirmation] = useState(null); // 'reinit' | 'statut' | 'suppression'
  const [resultatReinit, setResultatReinit] = useState(null);
  const actif = etablissement.statut === 'actif';

  async function reinitialiser() {
    const res = await client.put(`/superadmin/etablissements/${etablissement.id}/reinitialiser-academie`);
    setResultatReinit(res.data);
    setConfirmation(null);
  }

  async function basculerStatut() {
    const res = await client.patch(`/superadmin/etablissements/${etablissement.id}/statut`, { statut: actif ? 'suspendu' : 'actif' });
    setConfirmation(null);
    onStatut(res.data.etablissement);
    notifier(actif ? `${etablissement.nom} est verrouillée : tous ses comptes ont perdu l'accès.` : `${etablissement.nom} est réactivée.`);
  }

  async function supprimer() {
    await client.delete(`/superadmin/etablissements/${etablissement.id}`);
    onSupprime(etablissement.nom);
  }

  return (
    <div className="carte">
      <h2>Accès et sécurité</h2>
      <div className="zone-risque">
        <div className="zone-risque-ligne">
          <div>
            <strong>Réinitialiser l'accès Académie</strong>
            <p>Génère un nouveau mot de passe pour le premier compte Académie de l'école, en dépannage si elle ne peut plus se connecter.</p>
            {resultatReinit && (
              <div className="resultat-acces">
                À transmettre maintenant (ne sera plus affiché) : <code>{resultatReinit.email}</code> / <code>{resultatReinit.motDePasse}</code>
              </div>
            )}
          </div>
          <button className="secondaire" onClick={() => setConfirmation('reinit')}><IconKey /> Réinitialiser</button>
        </div>
        <div className="zone-risque-ligne">
          <div>
            <strong>{actif ? "Verrouiller l'école" : "Réactiver l'école"}</strong>
            <p>{actif ? 'Coupe immédiatement l’accès de tous les comptes de l’école, sans supprimer ses données.' : 'Rend l’accès à tous les comptes de l’école.'}</p>
          </div>
          <button className={`secondaire ${actif ? 'danger' : 'succes'}`} onClick={() => setConfirmation('statut')}>
            <IconLock /> {actif ? 'Verrouiller' : 'Réactiver'}
          </button>
        </div>
        <div className="zone-risque-ligne">
          <div>
            <strong>Supprimer l'école</strong>
            <p>Efface définitivement l'école et toutes ses données : classes, élèves, notes, absences, frais et comptes.</p>
          </div>
          <button className="secondaire danger" onClick={() => setConfirmation('suppression')}><IconTrash /> Supprimer</button>
        </div>
      </div>

      {confirmation === 'reinit' && (
        <ConfirmModal titre="Réinitialiser l'accès Académie ?" boutonConfirmer="Réinitialiser" boutonEnCours="Réinitialisation…" onConfirmer={reinitialiser} onAnnuler={() => setConfirmation(null)}>
          Un nouveau mot de passe sera généré pour le premier compte Académie de « {etablissement.nom} ». L'ancien cessera
          immédiatement de fonctionner.
        </ConfirmModal>
      )}
      {confirmation === 'statut' && (
        <ConfirmModal
          titre={actif ? `Verrouiller « ${etablissement.nom} » ?` : `Réactiver « ${etablissement.nom} » ?`}
          boutonConfirmer={actif ? 'Verrouiller' : 'Réactiver'}
          boutonEnCours="Enregistrement…"
          onConfirmer={basculerStatut}
          onAnnuler={() => setConfirmation(null)}
        >
          {actif ? 'Tous les comptes de cette école perdront l’accès immédiatement, jusqu’à sa réactivation.' : 'Tous les comptes de cette école retrouveront leur accès.'}
        </ConfirmModal>
      )}
      {confirmation === 'suppression' && (
        <ConfirmModal titre={`Supprimer « ${etablissement.nom} » ?`} boutonConfirmer="Supprimer définitivement" onConfirmer={supprimer} onAnnuler={() => setConfirmation(null)}>
          Classes, élèves, notes, absences, frais et tous les comptes de l'école seront supprimés. Cette action est irréversible.
        </ConfirmModal>
      )}
    </div>
  );
}

function FormulaireCreationEcole({ onFermer, onReussi }) {
  const [form, setForm] = useState({
    nom: '', sigle: '', devise: '', ville: '', pays: 'République Gabonaise', boitePostale: '', telephone: '', email: '', logo: '',
    academieNom: '', academiePrenom: '', academieEmail: '', academieMotDePasse: '',
  });
  const [catalogue, setCatalogue] = useState(null);
  const [choix, setChoix] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  useEffect(() => {
    client.get('/superadmin/fonctionnalites').then((res) => setCatalogue(res.data.fonctionnalites)).catch(() => setCatalogue([]));
  }, []);

  function basculer(cle) {
    setChoix((c) => (c.includes(cle) ? c.filter((x) => x !== cle) : [...c, cle]));
  }

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/superadmin/etablissements', { ...form, fonctionnalites: choix });
      onReussi(res.data.etablissement);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'affilier cette école"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Affilier une nouvelle école" onFermer={onFermer} largeur={680}>
      <form className="formulaire" onSubmit={soumettre} autoComplete="off">
        <h3>Identité de l'établissement</h3>
        <ChampLogo valeur={form.logo} onChange={(logo) => setForm({ ...form, logo })} />
        <div className="ligne-champs">
          <div className="champ" style={{ flex: 3 }}><label>Nom de l'établissement</label><input value={form.nom} onChange={maj('nom')} required /></div>
          <div className="champ"><label>Sigle</label><input value={form.sigle} onChange={maj('sigle')} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Ville</label><input value={form.ville} onChange={maj('ville')} required /></div>
          <div className="champ"><label>Pays</label><input value={form.pays} onChange={maj('pays')} /></div>
        </div>
        <div className="champ"><label>Devise</label><input value={form.devise} onChange={maj('devise')} /></div>
        <div className="ligne-champs">
          <div className="champ"><label>Boîte postale</label><input value={form.boitePostale} onChange={maj('boitePostale')} /></div>
          <div className="champ"><label>Téléphone</label><input value={form.telephone} onChange={maj('telephone')} /></div>
        </div>
        <div className="champ"><label>E-mail de contact</label><input type="email" autoComplete="off" value={form.email} onChange={maj('email')} /></div>

        <div className="separateur-section" style={{ margin: '4px 0' }} />
        <h3>Premier compte Académie</h3>
        <div className="ligne-champs">
          <div className="champ"><label>Prénom</label><input value={form.academiePrenom} onChange={maj('academiePrenom')} required /></div>
          <div className="champ"><label>Nom</label><input value={form.academieNom} onChange={maj('academieNom')} required /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>E-mail</label><input type="email" autoComplete="off" value={form.academieEmail} onChange={maj('academieEmail')} required /></div>
          <div className="champ"><label>Mot de passe</label><ChampMotDePasse autoComplete="new-password" value={form.academieMotDePasse} onChange={maj('academieMotDePasse')} required /></div>
        </div>

        <div className="separateur-section" style={{ margin: '4px 0' }} />
        <div className="entete-section" style={{ marginBottom: 0 }}>
          <h3>Fonctionnalités de l'école</h3>
          {catalogue && catalogue.length > 0 && (
            <button type="button" className="bouton-texte" onClick={() => setChoix(choix.length === catalogue.length ? [] : catalogue.map((f) => f.cle))}>
              {choix.length === catalogue.length ? 'Tout retirer' : 'Tout sélectionner'}
            </button>
          )}
        </div>
        <p className="note-secondaire" style={{ margin: '-8px 0 0', fontSize: 13 }}>
          Le socle (élèves, classes, notes, bulletins, frais) est toujours inclus. Choisis les fonctionnalités dont cette
          école a besoin ; tu pourras en ajouter ou en retirer à tout moment depuis sa fiche.
        </p>
        {!catalogue && <div className="chargement">Chargement du catalogue…</div>}
        {catalogue && (
          <div className="cases-choix">
            {catalogue.map((f) => {
              const choisie = choix.includes(f.cle);
              return (
                <button key={f.cle} type="button" className={`case-choix ${choisie ? 'choisie' : ''}`} onClick={() => basculer(f.cle)} aria-pressed={choisie} title={f.description}>
                  <span className="case-choix-coche">{choisie && <IconCheck />}</span>
                  <span>{f.nom}</span>
                </button>
              );
            })}
          </div>
        )}

        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Affiliation…' : "Affilier l'école"}</button>
        </div>
      </form>
    </Modal>
  );
}
