import { useEffect, useRef, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel } from '../../utils/excel';
import { NIVEAUX } from '../../utils/niveaux';
import { messageErreur } from '../../utils/erreurs';
import ConfirmModal from '../../components/ConfirmModal';
import Modal from '../../components/Modal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import ChampParent from '../../components/ChampParent';
import {
  IconUsers, IconSchool, IconUserPlus, IconUpload, IconPlus, IconSearch, IconEdit, IconChevronRight,
  IconCopy, IconKey, IconTrash, IconGraduationCap, IconUserCog, IconInfo, IconClose,
} from '../../components/icons';

const ELEVE_VIDE = {
  nom: '', prenom: '', classeId: '', email: '',
  parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '',
};
const RATTACHER_PARENT_VIDE = { parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };
// sessionStorage (pas useState seul) : changer d'onglet du tableau de bord
// démonte ce composant, ce qui vidait le journal des identifiants même si
// l'Académie n'avait fait que jeter un œil ailleurs entre-temps. Un vrai
// mot de passe ne remonte jamais du serveur : seule cette copie tenue en
// mémoire par l'onglet du navigateur existe, perdue à la fermeture.
const CLE_IDENTIFIANTS = 'es_identifiants_session';
function chargerIdentifiantsSession() {
  try {
    const brut = JSON.parse(sessionStorage.getItem(CLE_IDENTIFIANTS) || '[]');
    return Array.isArray(brut) ? brut : [];
  } catch {
    return [];
  }
}
// Deux classes peuvent partager le même nom avec un niveau différent : le
// niveau accompagne toujours le nom.
function nomClasse(c) {
  return c ? `${c.nom} (${c.niveau})` : 'Classe inconnue';
}
// Abréviation du niveau sur les boutons de classe (Licence 1 -> L1).
function abregerNiveau(niveau) {
  const m = String(niveau || '').match(/^(Licence|Master)\s*(\d)/i);
  if (m) return `${m[1][0].toUpperCase()}${m[2]}`;
  return niveau === 'Doctorat' ? 'Doct.' : niveau;
}
// Rendu fenêtré : un établissement peut compter des milliers d'élèves, on
// n'en dessine qu'une tranche (le filtrage reste instantané côté client).
const TRANCHE = 150;

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [parents, setParents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [toast, setToast] = useState(null);

  // Tous les identifiants générés pendant CETTE session (inscription,
  // import, rattachement de parent), tenus à part de la liste des élèves.
  const [identifiantsCrees, setIdentifiantsCrees] = useState(chargerIdentifiantsSession);
  const [rechercheIdentifiants, setRechercheIdentifiants] = useState('');
  useEffect(() => {
    try { sessionStorage.setItem(CLE_IDENTIFIANTS, JSON.stringify(identifiantsCrees)); } catch { /* stockage indisponible : reste en mémoire pour cette page */ }
  }, [identifiantsCrees]);

  const [classeChoisie, setClasseChoisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [rechercheClasse, setRechercheClasse] = useState('');
  const sectionEleves = useRef(null);
  const [limite, setLimite] = useState(TRANCHE);

  const [ficheId, setFicheId] = useState(null);
  const [creationClasse, setCreationClasse] = useState(false);
  const [classeEditee, setClasseEditee] = useState(null);
  const [inscription, setInscription] = useState(false);
  const [importation, setImportation] = useState(false);
  const [eleveParentCible, setEleveParentCible] = useState(null);
  const [eleveASupprimer, setEleveASupprimer] = useState(null);
  const [compteAReinitialiser, setCompteAReinitialiser] = useState(null);
  const [parentADetacher, setParentADetacher] = useState(null);

  function charger() {
    return Promise.all([
      client.get('/classes').then((res) => setClasses(res.data.classes)),
      client.get('/eleves').then((res) => setEleves(res.data.eleves)),
      client.get('/parents').then((res) => setParents(res.data.parents)),
    ]).finally(() => setChargement(false));
  }
  useEffect(() => { charger(); }, []);

  function ajouterIdentifiants(nouveaux) {
    setIdentifiantsCrees((prev) => {
      const ids = new Set(nouveaux.map((n) => n.compteId));
      return [...prev.filter((p) => !ids.has(p.compteId)), ...nouveaux];
    });
  }

  const recherchee = recherche.trim().toLowerCase();
  const elevesFiltres = eleves
    .filter((e) => !classeChoisie || String(e.classeId) === classeChoisie)
    .filter((e) => !recherchee || `${e.prenom} ${e.nom} ${e.nom} ${e.prenom} ${e.matricule || ''} ${e.compteEtudiant?.email || ''}`.toLowerCase().includes(recherchee))
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
  const elevesAffiches = elevesFiltres.slice(0, limite);
  const classeCourante = classes.find((c) => String(c.id) === classeChoisie);
  const rechercheClasseNette = rechercheClasse.trim().toLowerCase();
  const classesAffichees = classes
    .filter((c) => !rechercheClasseNette || `${c.nom} ${c.niveau}`.toLowerCase().includes(rechercheClasseNette))
    .sort((a, b) => (NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(b.niveau)) || a.nom.localeCompare(b.nom, 'fr'));

  // Choisir une classe filtre la liste des élèves ; si celle-ci est hors
  // de l'écran, on y descend.
  function choisirClasse(id) {
    setClasseChoisie(id);
    setLimite(TRANCHE);
    const section = sectionEleves.current;
    if (section && section.getBoundingClientRect().top > window.innerHeight * 0.55) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const avecParent = eleves.filter((e) => e.parent).length;
  const fiche = eleves.find((e) => e.id === ficheId) || null;

  // Le mot de passe d'un étudiant est son matricule : on affiche toujours
  // celui du dossier actuel, jamais un ancien resté en mémoire.
  const matriculeParCompte = new Map(eleves.map((e) => [e.compteEtudiantId, e.matricule]));
  function motDePasseDe(entree) {
    return entree.role === 'Étudiant' ? (matriculeParCompte.get(entree.compteId) || entree.matricule || entree.motDePasse) : entree.motDePasse;
  }
  const rechercheIdNettoyee = rechercheIdentifiants.trim().toLowerCase();
  const identifiantsAffiches = identifiantsCrees
    .filter((it) => !rechercheIdNettoyee || `${it.prenom} ${it.nom} ${it.email} ${it.classeNom}`.toLowerCase().includes(rechercheIdNettoyee));

  async function copierAvecToast(texte, libelle) {
    const ok = await copier(texte);
    setToast(ok ? { message: `${libelle} copié.`, type: 'succes' } : { message: 'Copie impossible : sélectionne le texte à la main.', type: 'erreur' });
  }

  async function confirmerReinitialisation() {
    const cible = compteAReinitialiser;
    const res = await client.put(`/comptes/${cible.compteId}/mot-de-passe`);
    ajouterIdentifiants([{
      ...cible, id: `r-${cible.compteId}`, motDePasse: res.data.motDePasse, matricule: res.data.matricule ?? cible.matricule,
    }]);
    setCompteAReinitialiser(null);
    setToast({
      message: cible.role === 'Étudiant'
        ? `Mot de passe de ${cible.prenom} ${cible.nom} remis à son matricule.`
        : `Nouveau mot de passe généré pour ${cible.prenom} ${cible.nom} : il figure dans « Identifiants de connexion ».`,
      type: 'succes',
    });
  }

  async function confirmerSuppressionEleve() {
    await client.delete(`/eleves/${eleveASupprimer.id}`);
    setToast({ message: `${eleveASupprimer.prenom} ${eleveASupprimer.nom} a été retiré(e).`, type: 'succes' });
    setEleveASupprimer(null);
    setFicheId(null);
    charger();
  }

  async function confirmerDetachement() {
    await client.delete(`/eleves/${parentADetacher.id}/parent`);
    setParentADetacher(null);
    setToast({ message: 'Parent détaché de cet élève.', type: 'succes' });
    charger();
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Élèves inscrits</span><span className="puce-icone petite"><IconGraduationCap /></span></div>
          <div className="valeur">{chargement ? '…' : eleves.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Classes</span><span className="puce-icone petite"><IconSchool /></span></div>
          <div className="valeur">{chargement ? '…' : classes.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Élèves avec un parent rattaché</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{chargement ? '…' : avecParent}<small className="valeur-sur"> / {eleves.length}</small></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Identifiants créés (cette visite)</span><span className="puce-icone petite"><IconKey /></span></div>
          <div className="valeur">{identifiantsCrees.length}</div>
        </div>
      </div>

      <section className="carte carte-barre-classes">
        <div className="barre-classes">
          <h2>Classes <span className="entete-carte-compteur">{classes.length}</span></h2>
          <div className="puces-classes" role="group" aria-label="Filtrer les élèves par classe">
            {!rechercheClasseNette && (
              <button type="button" className={`puce-classe ${!classeChoisie ? 'active' : ''}`} aria-pressed={!classeChoisie} onClick={() => choisirClasse('')}>
                <strong>Toutes</strong>
                <span className="puce-classe-compte">{eleves.length}</span>
              </button>
            )}
            {classesAffichees.map((c) => {
              const active = classeChoisie === String(c.id);
              return (
                <button
                  key={c.id} type="button" className={`puce-classe ${active ? 'active' : ''}`} aria-pressed={active}
                  onClick={() => choisirClasse(String(c.id))} title={`${c.nom} (${c.niveau})`}
                >
                  <strong>{c.nom}</strong>
                  <span className="puce-classe-niveau">{abregerNiveau(c.niveau)}</span>
                  <span className="puce-classe-compte">{c.Eleves?.length ?? 0}</span>
                </button>
              );
            })}
            {!chargement && classes.length === 0 && <span className="note-secondaire">Aucune classe pour le moment.</span>}
            {!chargement && classes.length > 0 && classesAffichees.length === 0 && <span className="note-secondaire">Aucune classe ne correspond.</span>}
          </div>
          <label className="champ-recherche compact">
            <IconSearch />
            <input type="search" placeholder="Rechercher une classe…" value={rechercheClasse} onChange={(e) => setRechercheClasse(e.target.value)} aria-label="Rechercher une classe" />
          </label>
          <button type="button" className="primaire" onClick={() => setCreationClasse(true)}><IconPlus /> Nouvelle classe</button>
        </div>
      </section>

      <section className="carte" ref={sectionEleves}>
        <div className="entete-carte">
          <h2>
            {classeCourante ? `Élèves de ${nomClasse(classeCourante)}` : 'Tous les élèves'}
            <span className="entete-carte-compteur">{elevesFiltres.length}</span>
            {classeCourante && (
              <button type="button" className="puce-filtre" onClick={() => choisirClasse('')} title="Afficher toutes les classes">
                Toutes les classes <IconClose />
              </button>
            )}
          </h2>
          <div className="actions-carte">
            {classeCourante && (
              <button type="button" className="secondaire" onClick={() => setClasseEditee(classeCourante)}><IconEdit /> Gérer la classe</button>
            )}
            <button type="button" className="secondaire" onClick={() => setImportation(true)} disabled={classes.length === 0}><IconUpload /> Importer</button>
            <button type="button" className="primaire" onClick={() => setInscription(true)} disabled={classes.length === 0}><IconUserPlus /> Inscrire un élève</button>
          </div>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input
              type="search"
              placeholder="Rechercher un nom, un matricule, un e-mail…"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setLimite(TRANCHE); }}
              aria-label="Rechercher un élève"
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="table-eleves">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom et prénom</th>
                <th>E-mail</th>
                {!classeCourante && <th>Classe</th>}
                <th>Parent</th>
                <th aria-label="Ouvrir la fiche" />
              </tr>
            </thead>
            <tbody>
              {elevesAffiches.map((e) => (
                <tr key={e.id} className="ligne-cliquable" onClick={() => setFicheId(e.id)}>
                  <td className="mono">{e.matricule || 'En attente'}</td>
                  <td className="cellule-nom">{e.nom} {e.prenom}</td>
                  <td className="cellule-email">{e.compteEtudiant?.email || <span className="note-secondaire">Aucun compte</span>}</td>
                  {!classeCourante && <td>{e.Classe ? nomClasse(e.Classe) : ''}</td>}
                  <td>{e.parent ? `${e.parent.prenom} ${e.parent.nom}` : <span className="note-secondaire">Aucun</span>}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {!chargement && elevesFiltres.length === 0 && (
                <tr><td colSpan={6} className="vide">{eleves.length === 0 ? 'Aucun élève inscrit pour le moment.' : 'Aucun élève ne correspond.'}</td></tr>
              )}
              {chargement && <tr><td colSpan={6} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
        {elevesFiltres.length > limite && (
          <div className="pied-liste">
            <span>{limite} élèves affichés sur {elevesFiltres.length}</span>
            <button type="button" className="secondaire" onClick={() => setLimite((l) => l + TRANCHE)}>Afficher la suite</button>
          </div>
        )}
      </section>

      <section className="carte">
        <div className="entete-carte">
          <h2>Identifiants de connexion <span className="entete-carte-compteur">{identifiantsCrees.length}</span></h2>
          <div className="actions-carte">
            <label className="champ-recherche compact">
              <IconSearch />
              <input type="search" placeholder="Rechercher…" value={rechercheIdentifiants} onChange={(e) => setRechercheIdentifiants(e.target.value)} aria-label="Rechercher un identifiant" />
            </label>
            {identifiantsCrees.length > 0 && <button type="button" className="secondaire" onClick={() => setIdentifiantsCrees([])}>Vider la liste</button>}
          </div>
        </div>
        <div className="encart-info" style={{ marginBottom: 18 }}>
          <IconInfo />
          <span>
            Comptes créés ou réinitialisés pendant cette visite, à transmettre maintenant. Le mot de passe d'un étudiant
            est toujours son matricule actuel ; celui d'un parent n'est plus affiché une fois l'onglet fermé.
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Rôle</th><th>Nom et prénom</th><th>Classe</th><th>Identifiant (e-mail)</th><th>Mot de passe</th><th /></tr></thead>
            <tbody>
              {identifiantsAffiches.map((entree) => (
                <tr key={entree.compteId ?? entree.id}>
                  <td><span className={`badge sans-point ${entree.role === 'Parent' ? 'or' : 'bleu'}`}>{entree.role}</span></td>
                  <td className="cellule-nom">{entree.nom} {entree.prenom}</td>
                  <td>{entree.classeNom}</td>
                  <td className="mono">{entree.email}</td>
                  <td className="mono">{motDePasseDe(entree)}</td>
                  <td className="cellule-actions">
                    <button type="button" className="bouton-icone-texte" onClick={() => copierAvecToast(`${entree.email} / ${motDePasseDe(entree)}`, 'Identifiant et mot de passe')}>
                      <IconCopy /> Copier
                    </button>
                  </td>
                </tr>
              ))}
              {identifiantsAffiches.length === 0 && (
                <tr><td colSpan={6} className="vide">{identifiantsCrees.length === 0 ? 'Aucun identifiant créé pendant cette visite.' : 'Aucun résultat pour cette recherche.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {fiche && (
        <Tiroir
          titre={`${fiche.prenom} ${fiche.nom}`}
          sousTitre={fiche.Classe ? nomClasse(fiche.Classe) : undefined}
          icone={<span className="avatar-initiales">{`${fiche.prenom?.[0] ?? ''}${fiche.nom?.[0] ?? ''}`.toUpperCase()}</span>}
          onFermer={() => setFicheId(null)}
          pied={<button type="button" className="secondaire danger" onClick={() => setEleveASupprimer(fiche)}><IconTrash /> Retirer l'élève</button>}
        >
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Dossier</h3>
            <dl className="fiche-compte">
              <div><dt>Matricule</dt><dd className="mono">{fiche.matricule || 'En attente'}</dd></div>
              <div><dt>Nom</dt><dd>{fiche.nom}</dd></div>
              <div><dt>Prénom</dt><dd>{fiche.prenom}</dd></div>
              <div><dt>Classe</dt><dd>{fiche.Classe ? nomClasse(fiche.Classe) : 'Non renseignée'}</dd></div>
            </dl>
          </section>
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Connexion à l'espace étudiant</h3>
            <dl className="fiche-compte">
              <div><dt>Identifiant</dt><dd>{fiche.compteEtudiant?.email || 'Aucun compte'}</dd></div>
              <div><dt>Mot de passe</dt><dd className="mono">{fiche.matricule || 'En attente'}</dd></div>
            </dl>
            <div className="actions-fiche">
              {fiche.compteEtudiant?.email && fiche.matricule && (
                <button type="button" className="secondaire" onClick={() => copierAvecToast(`${fiche.compteEtudiant.email} / ${fiche.matricule}`, 'Identifiant et mot de passe')}>
                  <IconCopy /> Copier les identifiants
                </button>
              )}
              {fiche.compteEtudiantId && (
                <button
                  type="button" className="secondaire"
                  onClick={() => setCompteAReinitialiser({
                    compteId: fiche.compteEtudiantId, role: 'Étudiant', prenom: fiche.prenom, nom: fiche.nom,
                    email: fiche.compteEtudiant?.email ?? null, classeId: fiche.classeId, classeNom: nomClasse(fiche.Classe), matricule: fiche.matricule,
                  })}
                >
                  <IconKey /> Réinitialiser le mot de passe
                </button>
              )}
            </div>
          </section>
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Parent</h3>
            {fiche.parent ? (
              <>
                <dl className="fiche-compte">
                  <div><dt>Nom</dt><dd>{fiche.parent.prenom} {fiche.parent.nom}</dd></div>
                  <div><dt>Identifiant</dt><dd>{fiche.parent.email}</dd></div>
                </dl>
                <div className="actions-fiche">
                  <button
                    type="button" className="secondaire"
                    onClick={() => setCompteAReinitialiser({
                      compteId: fiche.parent.id, role: 'Parent', prenom: fiche.parent.prenom, nom: fiche.parent.nom,
                      email: fiche.parent.email, classeId: fiche.classeId, classeNom: nomClasse(fiche.Classe),
                    })}
                  >
                    <IconKey /> Nouveau mot de passe
                  </button>
                  <button type="button" className="secondaire danger" onClick={() => setParentADetacher(fiche)}>Détacher</button>
                </div>
              </>
            ) : (
              <div className="fiche-vide">
                <span>Aucun parent rattaché : il ne peut pas suivre les notes et absences de cet élève.</span>
                <button type="button" className="secondaire" onClick={() => setEleveParentCible(fiche)}><IconUserCog /> Rattacher un parent</button>
              </div>
            )}
          </section>
        </Tiroir>
      )}

      {creationClasse && (
        <NouvelleClasse
          onFermer={() => setCreationClasse(false)}
          onCree={(c) => { setCreationClasse(false); setToast({ message: `Classe ${c.nom} (${c.niveau}) créée.`, type: 'succes' }); charger(); }}
        />
      )}
      {classeEditee && (
        <GestionClasse
          classe={classeEditee}
          onFermer={() => setClasseEditee(null)}
          onModifiee={() => { setClasseEditee(null); setToast({ message: 'Classe mise à jour.', type: 'succes' }); charger(); }}
          onSupprimee={(c) => {
            setClasseEditee(null);
            if (classeChoisie === String(c.id)) setClasseChoisie('');
            setToast({ message: `Classe ${c.nom} supprimée.`, type: 'succes' });
            charger();
          }}
        />
      )}
      {inscription && (
        <InscriptionEleve
          classes={classes}
          parents={parents}
          classeParDefaut={classeChoisie}
          onFermer={() => setInscription(false)}
          onInscrit={(nouveaux, matricule) => {
            ajouterIdentifiants(nouveaux);
            setToast({ message: `Élève inscrit avec le matricule ${matricule}, qui est aussi son mot de passe.`, type: 'succes' });
            charger();
          }}
        />
      )}
      {importation && (
        <ImportEleves
          classes={classes}
          classeParDefaut={classeChoisie}
          onFermer={() => setImportation(false)}
          onImporte={(nouveaux) => { ajouterIdentifiants(nouveaux); charger(); }}
        />
      )}
      {eleveParentCible && (
        <RattacherParent
          eleve={eleveParentCible}
          parents={parents}
          onFermer={() => setEleveParentCible(null)}
          onRattache={(entree) => {
            if (entree) ajouterIdentifiants([{ ...entree, classeId: eleveParentCible.classeId, classeNom: nomClasse(eleveParentCible.Classe) }]);
            setEleveParentCible(null);
            setToast({ message: 'Parent rattaché.', type: 'succes' });
            charger();
          }}
        />
      )}
      {eleveASupprimer && (
        <ConfirmModal titre="Retirer cet élève ?" boutonConfirmer="Retirer" onAnnuler={() => setEleveASupprimer(null)} onConfirmer={confirmerSuppressionEleve}>
          {eleveASupprimer.prenom} {eleveASupprimer.nom} sera retiré(e) de l'établissement, avec son compte étudiant, ses notes
          et ses absences. Cette action est irréversible.
        </ConfirmModal>
      )}
      {parentADetacher && (
        <ConfirmModal titre="Détacher ce parent ?" boutonConfirmer="Détacher" boutonEnCours="Détachement…" onAnnuler={() => setParentADetacher(null)} onConfirmer={confirmerDetachement}>
          {parentADetacher.parent.prenom} {parentADetacher.parent.nom} ne pourra plus suivre {parentADetacher.prenom} {parentADetacher.nom}.
          Son compte reste actif s'il suit d'autres enfants.
        </ConfirmModal>
      )}
      {compteAReinitialiser && (
        <ConfirmModal
          titre="Réinitialiser le mot de passe ?"
          onAnnuler={() => setCompteAReinitialiser(null)}
          onConfirmer={confirmerReinitialisation}
          boutonConfirmer="Réinitialiser"
          boutonEnCours="Réinitialisation…"
        >
          {compteAReinitialiser.role === 'Étudiant'
            ? `Le mot de passe de ${compteAReinitialiser.prenom} ${compteAReinitialiser.nom} redeviendra son matricule.`
            : `Un nouveau mot de passe sera généré pour ${compteAReinitialiser.prenom} ${compteAReinitialiser.nom} (parent). L'ancien cessera immédiatement de fonctionner.`}
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function NouvelleClasse({ onFermer, onCree }) {
  const [form, setForm] = useState({ nom: '', niveau: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/classes', form);
      onCree(form);
    } catch (err) {
      setErreur(messageErreur(err, 'impossible de créer la classe'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Nouvelle classe" onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={creer}>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="nc-nom">Nom de la classe</label>
            <input id="nc-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. IA & Big Data A" required autoFocus />
          </div>
          <div className="champ">
            <label htmlFor="nc-niveau">Niveau</label>
            <select id="nc-niveau" value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} required>
              <option value="">Choisir un niveau</option>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Création…' : 'Créer la classe'}</button>
        </div>
      </form>
    </Modal>
  );
}

function GestionClasse({ classe, onFermer, onModifiee, onSupprimee }) {
  const [form, setForm] = useState({ nom: classe.nom, niveau: classe.niveau });
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const effectif = classe.Eleves?.length ?? 0;

  useEffect(() => {
    client.get(`/classes/${classe.id}/statistiques`).then((res) => setStats(res.data)).catch(() => setStats(null));
  }, [classe.id]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/classes/${classe.id}`, form);
      onModifiee();
    } catch (err) {
      setErreur(messageErreur(err, 'impossible de modifier la classe'));
      setEnCours(false);
    }
  }

  if (suppression) {
    return (
      <ConfirmModal
        titre="Supprimer cette classe ?"
        onAnnuler={() => setSuppression(false)}
        onConfirmer={async () => { await client.delete(`/classes/${classe.id}`); onSupprimee(classe); }}
      >
        La classe {classe.nom} et ses {effectif} élève{effectif > 1 ? 's' : ''} seront supprimés, avec leurs comptes, notes,
        absences, bulletins et frais. Cette action est irréversible.
      </ConfirmModal>
    );
  }

  return (
    <Modal titre={`Classe ${classe.nom}`} onFermer={onFermer} largeur={560}>
      <dl className="chiffres-classe">
        <div><dt>Élèves</dt><dd>{effectif}</dd></div>
        <div><dt>Absences</dt><dd>{stats ? stats.absences.total : '…'}</dd></div>
        <div><dt>Non justifiées</dt><dd>{stats ? stats.absences.nonJustifiees : '…'}</dd></div>
      </dl>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="gc-nom">Nom</label>
            <input id="gc-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
          </div>
          <div className="champ">
            <label htmlFor="gc-niveau">Niveau</label>
            <select id="gc-niveau" value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })}>
              {form.niveau && !NIVEAUX.includes(form.niveau) && <option value={form.niveau}>{form.niveau}</option>}
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions separees">
          <button type="button" className="secondaire danger" onClick={() => setSuppression(true)}><IconTrash /> Supprimer la classe</button>
          <span className="espaceur" />
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function InscriptionEleve({ classes, parents, classeParDefaut, onFermer, onInscrit }) {
  const [form, setForm] = useState({ ...ELEVE_VIDE, classeId: classeParDefaut || '' });
  const [avecParent, setAvecParent] = useState(false);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [dernier, setDernier] = useState(null);
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  async function inscrire(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const payload = avecParent ? form : { ...form, parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };
      const res = await client.post('/eleves', payload);
      const classeNom = nomClasse(classes.find((c) => String(c.id) === String(form.classeId)));
      const matricule = res.data.eleve.matricule;
      const nouveaux = [{
        id: `e-${res.data.eleve.id}`, compteId: res.data.compteEtudiant.id, classeId: form.classeId, classeNom, role: 'Étudiant',
        prenom: form.prenom, nom: form.nom, email: form.email, motDePasse: matricule, matricule,
      }];
      if (res.data.compteParent && !res.data.parentReutilise) {
        nouveaux.push({
          id: `p-${res.data.compteParent.id}`, compteId: res.data.compteParent.id, classeId: form.classeId, classeNom, role: 'Parent',
          prenom: form.parentPrenom, nom: form.parentNom, email: form.parentEmail, motDePasse: form.parentMotDePasse,
        });
      }
      onInscrit(nouveaux, matricule);
      setDernier({ nom: `${form.prenom} ${form.nom}`, matricule, email: form.email });
      setForm({ ...ELEVE_VIDE, classeId: form.classeId });
      setAvecParent(false);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'inscrire cet élève"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Inscrire un élève" onFermer={onFermer} largeur={640}>
      {dernier && (
        <div className="message-succes" style={{ marginBottom: 18 }}>
          {dernier.nom} est inscrit(e). Identifiant : <strong>{dernier.email}</strong>, mot de passe : <strong className="mono">{dernier.matricule}</strong>.
          Vous pouvez inscrire l'élève suivant.
        </div>
      )}
      <form className="formulaire" onSubmit={inscrire} autoComplete="off">
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="ie-prenom">Prénom</label><input id="ie-prenom" value={form.prenom} onChange={maj('prenom')} required autoFocus /></div>
          <div className="champ"><label htmlFor="ie-nom">Nom</label><input id="ie-nom" value={form.nom} onChange={maj('nom')} required /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="ie-classe">Classe</label>
            <select id="ie-classe" value={form.classeId} onChange={maj('classeId')} required>
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{nomClasse(c)}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="ie-email">E-mail de l'élève</label>
            <input id="ie-email" type="email" autoComplete="off" value={form.email} onChange={maj('email')} required />
          </div>
        </div>
        <div className="encart-info">
          <IconInfo />
          <span>Le matricule est attribué automatiquement (par exemple IUSN-2N-0001). Il sert aussi de mot de passe et ne se modifie pas.</span>
        </div>
        <label className="case-a-cocher">
          <input type="checkbox" checked={avecParent} onChange={(e) => setAvecParent(e.target.checked)} />
          Rattacher un compte parent (suivi des notes, absences et bulletins)
        </label>
        {avecParent && (
          <ChampParent
            parents={parents}
            valeur={form}
            onChange={(champs) => setForm((v) => ({ ...v, ...champs }))}
            motDePasseVisible={motDePasseVisible}
            onBasculerMotDePasseVisible={() => setMotDePasseVisible((v) => !v)}
          />
        )}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Fermer</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Inscription…' : "Inscrire l'élève"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportEleves({ classes, classeParDefaut, onFermer, onImporte }) {
  const [classeId, setClasseId] = useState(classeParDefaut || '');
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState(null);
  const [resultat, setResultat] = useState(null);

  // Une ligne doit fournir au moins prénom, nom et e-mail ; le matricule
  // (donc le mot de passe) est attribué par le serveur.
  async function importer(e) {
    e.preventDefault();
    const fichier = e.target.elements.fichierEleves.files[0];
    if (!classeId || !fichier) return;
    const classeNom = nomClasse(classes.find((c) => String(c.id) === classeId));
    setEnCours(true);
    setResultat(null);
    const lignes = await lireFichierExcel(fichier);
    const reussis = [];
    const echecs = [];
    for (let i = 0; i < lignes.length; i += 1) {
      setProgression({ fait: i, total: lignes.length });
      const ligne = lignes[i];
      const prenom = ligne.prenom || ligne.prenoms;
      const nom = ligne.nom || ligne.noms;
      const email = ligne.email || ligne.mail || ligne.courriel;
      if (!prenom || !nom || !email) {
        echecs.push({ ligne: i + 2, raison: 'prénom, nom ou e-mail manquant' });
        continue;
      }
      try {
        const res = await client.post('/eleves', { nom, prenom, email, classeId, dateNaissance: ligne.datenaissance || undefined });
        const matricule = res.data.eleve.matricule;
        reussis.push({
          id: `i-${res.data.compteEtudiant.id}`, compteId: res.data.compteEtudiant.id, classeId, classeNom, role: 'Étudiant',
          prenom, nom, email, motDePasse: matricule, matricule,
        });
      } catch (err) {
        echecs.push({ ligne: i + 2, raison: messageErreur(err, 'erreur inconnue') });
      }
    }
    if (reussis.length) onImporte(reussis);
    setResultat({ reussis: reussis.length, echecs, classeNom });
    setProgression(null);
    setEnCours(false);
    e.target.reset();
  }

  return (
    <Modal titre="Importer une liste d'élèves" onFermer={enCours ? () => {} : onFermer} largeur={600}>
      <form className="formulaire" onSubmit={importer}>
        <div className="encart-info">
          <IconInfo />
          <span>Fichier Excel ou CSV avec les colonnes <strong>prénom</strong>, <strong>nom</strong>, <strong>email</strong> et, en option, la date de naissance.</span>
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="im-classe">Classe de destination</label>
            <select id="im-classe" value={classeId} onChange={(e) => setClasseId(e.target.value)} required>
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{nomClasse(c)}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="im-fichier">Fichier</label>
            <input id="im-fichier" type="file" name="fichierEleves" accept=".xlsx,.xls,.csv" required />
          </div>
        </div>
        {progression && <div className="note-secondaire">Import en cours : {progression.fait} / {progression.total} lignes…</div>}
        {resultat && (
          <>
            {resultat.reussis > 0 && (
              <div className="message-succes">
                {resultat.reussis} élève{resultat.reussis > 1 ? 's' : ''} importé{resultat.reussis > 1 ? 's' : ''} dans {resultat.classeNom}.
                Leurs identifiants figurent dans « Identifiants de connexion ».
              </div>
            )}
            {resultat.echecs.length > 0 && (
              <div className="message-erreur">
                {resultat.echecs.length} ligne{resultat.echecs.length > 1 ? 's' : ''} ignorée{resultat.echecs.length > 1 ? 's' : ''} :
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {resultat.echecs.map((ec) => <li key={ec.ligne}>ligne {ec.ligne} : {ec.raison}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer} disabled={enCours}>Fermer</button>
          <button type="submit" className="primaire" disabled={enCours || !classeId}><IconUpload /> {enCours ? 'Import…' : 'Importer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RattacherParent({ eleve, parents, onFermer, onRattache }) {
  const [form, setForm] = useState(RATTACHER_PARENT_VIDE);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function rattacher(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.put(`/eleves/${eleve.id}/parent`, form);
      // Compte réutilisé : le mot de passe tapé ici n'a servi à rien côté
      // serveur, on ne l'affiche donc jamais comme le sien.
      const entree = res.data.compteParent && !res.data.parentReutilise
        ? {
          id: `p-${res.data.compteParent.id}`, compteId: res.data.compteParent.id, role: 'Parent',
          prenom: form.parentPrenom, nom: form.parentNom, email: form.parentEmail, motDePasse: form.parentMotDePasse,
        }
        : null;
      onRattache(entree);
    } catch (err) {
      setErreur(messageErreur(err, 'impossible de rattacher ce parent'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Rattacher un parent à ${eleve.prenom} ${eleve.nom}`} onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={rattacher}>
        <p className="note-secondaire" style={{ margin: 0 }}>
          Un même parent peut suivre plusieurs enfants : choisissez-le dans la liste s'il a déjà un compte, sinon créez-le.
        </p>
        <ChampParent
          parents={parents}
          valeur={form}
          onChange={(champs) => setForm((v) => ({ ...v, ...champs }))}
          motDePasseVisible={motDePasseVisible}
          onBasculerMotDePasseVisible={() => setMotDePasseVisible((v) => !v)}
        />
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Rattachement…' : 'Rattacher'}</button>
        </div>
      </form>
    </Modal>
  );
}
