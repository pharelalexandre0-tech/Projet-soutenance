import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel } from '../../utils/excel';
import { NIVEAUX } from '../../utils/niveaux';
import ConfirmModal from '../../components/ConfirmModal';
import Modal from '../../components/Modal';
import TableauDefilant from '../../components/TableauDefilant';
import ChampParent from '../../components/ChampParent';

const ELEVE_VIDE = {
  nom: '', prenom: '', classeId: '', email: '',
  parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '',
};
const RATTACHER_PARENT_VIDE = { parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };
// sessionStorage (pas useState seul) : changer d'onglet du tableau de bord
// démonte ce composant, ce qui vidait le journal des identifiants même si
// l'Académie n'avait fait que jeter un œil ailleurs entre-temps. Un vrai
// mot de passe ne remonte jamais du serveur — seule cette copie tenue en
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
// Deux classes peuvent partager le même nom avec un niveau différent (ex.
// deux promotions "IA & Big Data") — le niveau doit toujours accompagner le
// nom partout où une classe s'affiche, sinon impossible de les distinguer.
function nomClasse(c) {
  return c ? `${c.nom} (${c.niveau})` : 'Classe inconnue';
}
// Un établissement peut compter des milliers d'élèves — rendre tout d'un
// coup alourdit le navigateur pour rien, alors que l'API renvoie déjà tout
// (le filtrage par classe reste instantané côté client). Fenêtrage de
// l'affichage seulement, pas de la requête — et par CLASSE, jamais par
// ligne brute : paginer les lignes avant de grouper coupait une classe
// nombreuse en deux pages, son groupe réapparaissant plus loin entrecoupé
// d'autres classes.
const CLASSES_PAR_PAGE = 8;

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [nouvelleClasse, setNouvelleClasse] = useState({ nom: '', niveau: '' });
  const [nouvelEleve, setNouvelEleve] = useState(ELEVE_VIDE);
  const [parentMotDePasseVisible, setParentMotDePasseVisible] = useState(false);
  const [message, setMessage] = useState('');
  // Tous les identifiants générés pendant CETTE session (inscription
  // manuelle, import, rattachement de parent) — accumulés dans un tableau
  // à part, jamais mélangés à la liste des élèves, tant que la page reste
  // ouverte : le mot de passe redevient irrécupérable dès qu'on la quitte,
  // il n'existe plus qu'en haché côté serveur.
  const [identifiantsCrees, setIdentifiantsCrees] = useState(chargerIdentifiantsSession);
  const [rechercheIdentifiants, setRechercheIdentifiants] = useState('');
  const [compteAReinitialiser, setCompteAReinitialiser] = useState(null);
  useEffect(() => {
    try { sessionStorage.setItem(CLE_IDENTIFIANTS, JSON.stringify(identifiantsCrees)); } catch { /* stockage indisponible (navigation privée…) — tant pis, reste en mémoire pour cette page */ }
  }, [identifiantsCrees]);
  const [classeImportId, setClasseImportId] = useState('');
  const [importEnCours, setImportEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState(null);

  // Les formulaires de création restent cachés par défaut — ils
  // apparaissent au clic sur leur bouton d'action, pas en permanence sous
  // la liste qu'ils encombrent sinon.
  const [classeFormOuvert, setClasseFormOuvert] = useState(false);
  const [eleveFormOuvert, setEleveFormOuvert] = useState(false);
  const [avecParent, setAvecParent] = useState(false);
  const [importFormOuvert, setImportFormOuvert] = useState(false);

  // Détail d'une classe (voir/modifier/supprimer) : une seule ouverte à la
  // fois, dépliée sous sa ligne — pas une page séparée, pour rester dans le
  // même geste que la liste.
  const [classeOuverte, setClasseOuverte] = useState(null);
  const [statsClasse, setStatsClasse] = useState(null);
  const [editionClasse, setEditionClasse] = useState({ nom: '', niveau: '' });
  const [classeASupprimer, setClasseASupprimer] = useState(null);

  // Rattacher un parent à un élève déjà inscrit (import en masse, ou
  // affiliation oubliée à l'inscription) — même logique "réutilise si
  // l'e-mail existe déjà, sinon crée" que le formulaire d'inscription.
  const [eleveParentCible, setEleveParentCible] = useState(null);
  const [formRattacherParent, setFormRattacherParent] = useState(RATTACHER_PARENT_VIDE);
  const [rattacherParentMotDePasseVisible, setRattacherParentMotDePasseVisible] = useState(false);
  const [erreurRattacherParent, setErreurRattacherParent] = useState('');
  const [enCoursRattacherParent, setEnCoursRattacherParent] = useState(false);
  const [erreurClasse, setErreurClasse] = useState('');

  const [filtreClasse, setFiltreClasse] = useState('');
  const [rechercheNom, setRechercheNom] = useState('');
  const [pageEleves, setPageEleves] = useState(0);

  const [eleveASupprimer, setEleveASupprimer] = useState(null);
  const [parents, setParents] = useState([]);

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/eleves').then((res) => setEleves(res.data.eleves));
    client.get('/parents').then((res) => setParents(res.data.parents));
  }
  useEffect(charger, []);

  async function ouvrirClasse(c) {
    if (classeOuverte === c.id) { setClasseOuverte(null); return; }
    setClasseOuverte(c.id);
    setEditionClasse({ nom: c.nom, niveau: c.niveau });
    setErreurClasse('');
    setStatsClasse(null);
    const res = await client.get(`/classes/${c.id}/statistiques`);
    setStatsClasse(res.data);
  }

  async function enregistrerClasse(id) {
    setErreurClasse('');
    try {
      await client.put(`/classes/${id}`, editionClasse);
      charger();
    } catch (err) {
      setErreurClasse(err.response?.data?.erreur || 'erreur');
    }
  }

  async function confirmerSuppressionClasse() {
    await client.delete(`/classes/${classeASupprimer.id}`);
    setClasseASupprimer(null);
    setClasseOuverte(null);
    charger();
  }

  async function confirmerSuppressionEleve() {
    await client.delete(`/eleves/${eleveASupprimer.id}`);
    setEleveASupprimer(null);
    charger();
  }

  function ouvrirRattacherParent(eleve) {
    setEleveParentCible(eleve);
    setFormRattacherParent(RATTACHER_PARENT_VIDE);
    setRattacherParentMotDePasseVisible(false);
    setErreurRattacherParent('');
  }

  async function soumettreRattacherParent(e) {
    e.preventDefault();
    setErreurRattacherParent('');
    setEnCoursRattacherParent(true);
    try {
      const res = await client.put(`/eleves/${eleveParentCible.id}/parent`, formRattacherParent);
      // Compte réutilisé (déjà existant) : le mot de passe tapé ici n'a
      // servi à rien côté serveur, donc jamais l'ajouter comme si c'était
      // le sien — seulement pour un compte fraîchement créé.
      if (res.data.compteParent && !res.data.parentReutilise) {
        const classeNom = nomClasse(classes.find((c) => String(c.id) === String(eleveParentCible.classeId)));
        setIdentifiantsCrees((prev) => [...prev, {
          id: `p-${res.data.compteParent.id}`, compteId: res.data.compteParent.id,
          classeId: eleveParentCible.classeId, classeNom, role: 'Parent',
          prenom: formRattacherParent.parentPrenom, nom: formRattacherParent.parentNom,
          email: formRattacherParent.parentEmail, motDePasse: formRattacherParent.parentMotDePasse,
        }]);
      }
      setEleveParentCible(null);
      charger();
    } catch (err) {
      setErreurRattacherParent(err.response?.data?.erreur || 'erreur');
    } finally {
      setEnCoursRattacherParent(false);
    }
  }

  async function detacherParentAction(eleve) {
    await client.delete(`/eleves/${eleve.id}/parent`);
    charger();
  }

  // Une ligne doit fournir au moins prénom + nom + email — le mot de passe
  // du compte étudiant est généré s'il manque (un enseignant qui exporte sa
  // liste depuis son propre tableur n'a évidemment pas de colonne mot de
  // passe), et rapporté dans le résumé pour que l'Académie puisse le
  // communiquer.
  async function importerEleves(e) {
    e.preventDefault();
    if (!classeImportId) return;
    const fichier = e.target.elements.fichierEleves.files[0];
    if (!fichier) return;
    // Figé dès maintenant : si l'Académie change le sélecteur "Classe
    // cible" après coup, le récap déjà affiché ne doit pas se mettre à
    // mentir sur la classe dans laquelle l'import a réellement eu lieu.
    const classeImportNom = nomClasse(classes.find((c) => String(c.id) === classeImportId));
    setImportEnCours(true);
    setResultatImport(null);
    const lignes = await lireFichierExcel(fichier);
    const reussis = [];
    const echecs = [];
    for (let i = 0; i < lignes.length; i += 1) {
      const ligne = lignes[i];
      const prenom = ligne.prenom || ligne.prenoms;
      const nom = ligne.nom || ligne.noms;
      const email = ligne.email || ligne.mail || ligne.courriel;
      if (!prenom || !nom || !email) {
        echecs.push({ ligne: i + 2, raison: 'prénom, nom ou e-mail manquant' });
        continue;
      }
      try {
        const res = await client.post('/eleves', {
          nom, prenom, email,
          classeId: classeImportId,
          dateNaissance: ligne.datenaissance || undefined,
        });
        // Mot de passe de l'étudiant = son matricule, attribué par le serveur.
        const matricule = res.data.eleve.matricule;
        reussis.push({ nom, prenom, email, motDePasse: matricule, matricule, compteId: res.data.compteEtudiant.id });
      } catch (err) {
        echecs.push({ ligne: i + 2, raison: err.response?.data?.erreur || 'erreur inconnue' });
      }
    }
    if (reussis.length > 0) {
      const horodatage = Date.now();
      setIdentifiantsCrees((prev) => [...prev, ...reussis.map((r, i) => ({
        id: `i-${horodatage}-${i}`, compteId: r.compteId,
        classeId: classeImportId, classeNom: classeImportNom, role: 'Étudiant',
        prenom: r.prenom, nom: r.nom, email: r.email, motDePasse: r.motDePasse, matricule: r.matricule,
      }))]);
    }
    setResultatImport({ reussis, echecs, classeNom: classeImportNom });
    setImportEnCours(false);
    e.target.reset();
    charger();
  }

  async function creerClasse(e) {
    e.preventDefault();
    await client.post('/classes', nouvelleClasse);
    setNouvelleClasse({ nom: '', niveau: '' });
    setClasseFormOuvert(false);
    charger();
  }

  async function creerEleve(e) {
    e.preventDefault();
    setMessage('');
    try {
      // Champs parent ignorés si la case n'est pas cochée, même si
      // l'académie y avait tapé quelque chose puis décoché.
      const payload = avecParent
        ? nouvelEleve
        : { ...nouvelEleve, parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };
      const res = await client.post('/eleves', payload);
      const classeNom = nomClasse(classes.find((c) => String(c.id) === String(nouvelEleve.classeId)));
      const nouveaux = [{
        id: `e-${res.data.eleve.id}`, compteId: res.data.compteEtudiant.id,
        classeId: nouvelEleve.classeId, classeNom, role: 'Étudiant',
        prenom: nouvelEleve.prenom, nom: nouvelEleve.nom, email: nouvelEleve.email,
        motDePasse: res.data.eleve.matricule, matricule: res.data.eleve.matricule,
      }];
      // Compte parent réutilisé (déjà existant) : le mot de passe tapé ici
      // n'a servi à rien côté serveur, donc jamais l'ajouter comme si
      // c'était le sien — seulement pour un compte fraîchement créé.
      if (res.data.compteParent && !res.data.parentReutilise) {
        nouveaux.push({
          id: `p-${res.data.compteParent.id}`, compteId: res.data.compteParent.id,
          classeId: nouvelEleve.classeId, classeNom, role: 'Parent',
          prenom: nouvelEleve.parentPrenom, nom: nouvelEleve.parentNom,
          email: nouvelEleve.parentEmail, motDePasse: nouvelEleve.parentMotDePasse,
        });
      }
      setIdentifiantsCrees((prev) => [...prev, ...nouveaux]);
      setMessage(`Élève inscrit avec le matricule ${res.data.eleve.matricule}, qui est aussi son mot de passe. Identifiants dans le tableau « Identifiants de connexion » ci-dessous.`);
      setNouvelEleve(ELEVE_VIDE);
      setAvecParent(false);
      setParentMotDePasseVisible(false);
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  const rechercheNettoyee = rechercheNom.trim().toLowerCase();
  const elevesAffiches = eleves
    .filter((e) => !filtreClasse || String(e.classeId) === filtreClasse)
    .filter((e) => !rechercheNettoyee || `${e.prenom} ${e.nom}`.toLowerCase().includes(rechercheNettoyee));
  // Regroupement par classe sur la liste COMPLÈTE filtrée, trié par nom —
  // c'est seulement APRÈS ce groupement qu'on pagine (par classe entière,
  // pas par ligne), pour qu'une classe ne soit jamais coupée en deux pages.
  const groupesEleves = [...elevesAffiches.reduce((groupes, e) => {
    const cle = e.classeId;
    if (!groupes.has(cle)) groupes.set(cle, { classeId: cle, nom: nomClasse(e.Classe), eleves: [] });
    groupes.get(cle).eleves.push(e);
    return groupes;
  }, new Map()).values()].sort((a, b) => a.nom.localeCompare(b.nom));
  const totalPagesEleves = Math.max(1, Math.ceil(groupesEleves.length / CLASSES_PAR_PAGE));
  const pageEleveActuelle = Math.min(pageEleves, totalPagesEleves - 1);
  const elevesParClasse = groupesEleves
    .slice(pageEleveActuelle * CLASSES_PAR_PAGE, (pageEleveActuelle + 1) * CLASSES_PAR_PAGE)
    .map((g) => [g.classeId, g]);

  const rechercheIdentifiantsNettoyee = rechercheIdentifiants.trim().toLowerCase();
  const identifiantsAffiches = identifiantsCrees.filter((it) => (
    !rechercheIdentifiantsNettoyee || `${it.prenom} ${it.nom} ${it.email}`.toLowerCase().includes(rechercheIdentifiantsNettoyee)
  ));
  // Même logique de groupement que la liste des élèves, appliquée au journal
  // des identifiants — jamais une liste à plat non plus.
  const identifiantsParClasse = [...identifiantsAffiches.reduce((groupes, id) => {
    // classeId arrive tantôt en string (valeur d'un <select>), tantôt en
    // nombre (champ e.classeId déjà typé par l'API) selon l'endroit d'où
    // vient l'entrée — sans String(), "2" et 2 formaient deux groupes
    // séparés pour la même classe.
    const cle = String(id.classeId);
    if (!groupes.has(cle)) groupes.set(cle, { classeId: cle, nom: id.classeNom, entrees: [] });
    groupes.get(cle).entrees.push(id);
    return groupes;
  }, new Map()).values()].sort((a, b) => a.nom.localeCompare(b.nom));

  async function copierIdentifiant(entree) {
    try {
      await navigator.clipboard.writeText(`${entree.email} / ${entree.motDePasse}`);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée) — l'académie peut toujours sélectionner le texte à la main.
    }
  }

  // Déclenchable depuis le journal des identifiants (compte déjà présent)
  // OU directement depuis la liste des élèves pour un compte plus ancien,
  // jamais passé par ce journal — dans les deux cas, on retrouve/complète
  // sa ligne par compteId (la vraie identité du compte), pas par l'id
  // synthétique de rendu qui, lui, dépend de comment l'entrée est née.
  async function confirmerReinitialisation() {
    const res = await client.put(`/comptes/${compteAReinitialiser.compteId}/mot-de-passe`);
    setIdentifiantsCrees((prev) => {
      const existe = prev.some((it) => it.compteId === compteAReinitialiser.compteId);
      if (existe) {
        return prev.map((it) => (
          it.compteId === compteAReinitialiser.compteId ? { ...it, motDePasse: res.data.motDePasse, matricule: res.data.matricule ?? it.matricule } : it
        ));
      }
      return [...prev, { ...compteAReinitialiser, id: `r-${compteAReinitialiser.compteId}`, motDePasse: res.data.motDePasse, matricule: res.data.matricule ?? compteAReinitialiser.matricule }];
    });
    setCompteAReinitialiser(null);
  }

  return (
    <>
    <div className="grille-2">
      <div className="carte">
        <h2>Classes</h2>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 16 }}>
          Clique une classe pour voir son effectif, ses statistiques, la modifier ou la supprimer.
        </p>
        <div className="table-cadre">
        <table>
          <thead><tr><th>Nom</th><th>Niveau</th><th>Effectif</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <Fragment key={c.id}>
                <tr className="ligne-cliquable" onClick={() => ouvrirClasse(c)}>
                  <td>{c.nom}</td>
                  <td>{c.niveau}</td>
                  <td>{c.Eleves?.length ?? 0}</td>
                </tr>
                {classeOuverte === c.id && (
                  <tr>
                    <td colSpan={3} style={{ padding: 0 }}>
                      <div className="detail-classe">
                        {!statsClasse ? (
                          <div className="vide">Chargement…</div>
                        ) : (
                          <div className="detail-classe-stats">
                            {/* Effectif/statut viennent de "classes" (c), pas de statsClasse : c'est déjà
                                réactualisé par charger() après chaque inscription/import/retrait, alors que
                                statsClasse n'est chargé qu'une fois à l'ouverture du panneau et restait
                                bloqué sur un ancien total tant qu'on ne le refermait/rouvrait pas. */}
                            <div className="detail-classe-chiffre">
                              <strong>{c.Eleves?.length ?? 0}</strong>
                              <span>élève(s)</span>
                            </div>
                            <span className={`badge ${(c.Eleves?.length ?? 0) > 0 ? 'vert' : 'gris'}`}>
                              {(c.Eleves?.length ?? 0) > 0 ? 'Active' : 'Vide'}
                            </span>
                            <div className="detail-classe-chiffre">
                              <strong>{statsClasse.absences.total}</strong>
                              <span>absence(s) : {statsClasse.absences.justifiees} justifiée(s), {statsClasse.absences.nonJustifiees} non justifiée(s)</span>
                            </div>
                          </div>
                        )}
                        <div className="ligne-champs" style={{ marginTop: 14 }}>
                          <div className="champ">
                            <label>Nom</label>
                            <input value={editionClasse.nom} onChange={(e) => setEditionClasse({ ...editionClasse, nom: e.target.value })} />
                          </div>
                          <div className="champ">
                            <label>Niveau</label>
                            <select value={editionClasse.niveau} onChange={(e) => setEditionClasse({ ...editionClasse, niveau: e.target.value })}>
                              {/* Une classe plus ancienne peut porter un niveau hors de la liste
                                  actuelle (ex. saisi librement avant ce formulaire) — on le garde
                                  comme option tant qu'elle n'est pas explicitement changée, plutôt
                                  que de le faire disparaître silencieusement du champ. */}
                              {editionClasse.niveau && !NIVEAUX.includes(editionClasse.niveau) && (
                                <option value={editionClasse.niveau}>{editionClasse.niveau}</option>
                              )}
                              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        </div>
                        {erreurClasse && <div className="message-erreur" style={{ marginTop: 10 }}>{erreurClasse}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="secondaire succes" onClick={() => enregistrerClasse(c.id)}>Enregistrer</button>
                          <button className="secondaire danger" onClick={() => setClasseASupprimer(c)}>Supprimer</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {classes.length === 0 && <tr><td colSpan={3} className="vide">Aucune classe</td></tr>}
          </tbody>
        </table>
        </div>
        <div className="entete-section">
          <h3>Créer une classe</h3>
          <button type="button" className={classeFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setClasseFormOuvert((v) => !v)}>
            {classeFormOuvert ? 'Annuler' : '+ Nouvelle classe'}
          </button>
        </div>
        {classeFormOuvert && (
          <form className="formulaire" onSubmit={creerClasse}>
            <div className="ligne-champs">
              <div className="champ">
                <label>Nom</label>
                <input value={nouvelleClasse.nom} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, nom: e.target.value })} required autoFocus />
              </div>
              <div className="champ">
                <label>Niveau</label>
                <select value={nouvelleClasse.niveau} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, niveau: e.target.value })} required>
                  <option value="">Choisir un niveau</option>
                  {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <button className="primaire" type="submit">Ajouter la classe</button>
          </form>
        )}
      </div>

      <div className="carte">
        <h2>Élèves</h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Liste ({elevesAffiches.length})</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <input
              type="search"
              placeholder="Rechercher un nom…"
              value={rechercheNom}
              onChange={(e) => { setRechercheNom(e.target.value); setPageEleves(0); }}
              style={{ flex: '1 1 140px', minWidth: 0, maxWidth: 200 }}
            />
            <select value={filtreClasse} onChange={(e) => { setFiltreClasse(e.target.value); setPageEleves(0); }} style={{ flex: '1 1 140px', minWidth: 0, maxWidth: 200 }}>
              <option value="">Toutes les classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{nomClasse(c)}</option>)}
            </select>
          </div>
        </div>
        {/* Un tableau par classe plutôt qu'une liste à plat avec une colonne
            "Classe" répétée à chaque ligne — la classe se voit déjà dans le
            titre du groupe, pas besoin de la redire 50 fois. Chaque groupe
            est replié par défaut : sinon une classe à 50 élèves étire la
            page indéfiniment avant même d'atteindre la suivante. */}
        {elevesParClasse.map(([classeId, groupe]) => (
          <TableauDefilant key={classeId} titre={groupe.nom} compte={groupe.eleves.length}>
            <table>
              <thead><tr><th>Matricule</th><th>Élève</th><th>Parent</th><th></th></tr></thead>
              <tbody>
                {groupe.eleves.map((e) => (
                  <tr key={e.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{e.matricule || 'En attente'}</td>
                    <td>
                      {e.prenom} {e.nom}
                      <div>
                        <button
                          type="button" className="secondaire"
                          style={{ padding: '1px 8px', fontSize: '0.7rem', marginTop: 4 }}
                          onClick={() => setCompteAReinitialiser({
                            compteId: e.compteEtudiantId, role: 'Étudiant', prenom: e.prenom, nom: e.nom,
                            email: e.compteEtudiant?.email ?? null, classeId: e.classeId, classeNom: groupe.nom,
                            matricule: e.matricule,
                          })}
                        >
                          Mot de passe
                        </button>
                      </div>
                    </td>
                    <td>
                      {e.parent ? (
                        <>
                          {e.parent.prenom} {e.parent.nom}
                          <div className="note-secondaire" style={{ fontSize: '0.74rem' }}>{e.parent.email}</div>
                          <button
                            type="button" className="secondaire"
                            style={{ padding: '1px 8px', fontSize: '0.7rem', marginTop: 4 }}
                            onClick={() => setCompteAReinitialiser({
                              compteId: e.parent.id, role: 'Parent', prenom: e.parent.prenom, nom: e.parent.nom,
                              email: e.parent.email, classeId: e.classeId, classeNom: groupe.nom,
                            })}
                          >
                            Mot de passe
                          </button>{' '}
                          <button
                            type="button" className="secondaire"
                            style={{ padding: '1px 8px', fontSize: '0.7rem', marginTop: 4 }}
                            onClick={() => detacherParentAction(e)}
                          >
                            Détacher
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="note-secondaire">Aucun</span>{' '}
                          <button
                            type="button" className="secondaire"
                            style={{ padding: '1px 8px', fontSize: '0.7rem' }}
                            onClick={() => ouvrirRattacherParent(e)}
                          >
                            + Parent
                          </button>
                        </>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="secondaire danger" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => setEleveASupprimer(e)}>
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableauDefilant>
        ))}
        {elevesParClasse.length === 0 && <div className="vide">Aucun élève</div>}
        {totalPagesEleves > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 12 }}>
            <button className="secondaire" style={{ padding: '4px 12px' }} disabled={pageEleveActuelle === 0} onClick={() => setPageEleves(pageEleveActuelle - 1)}>
              Précédent
            </button>
            <span className="note-secondaire">Page {pageEleveActuelle + 1} / {totalPagesEleves}</span>
            <button className="secondaire" style={{ padding: '4px 12px' }} disabled={pageEleveActuelle >= totalPagesEleves - 1} onClick={() => setPageEleves(pageEleveActuelle + 1)}>
              Suivant
            </button>
          </div>
        )}

        <div className="entete-section" style={{ marginTop: 22 }}>
          <h3>Inscrire un élève</h3>
          <button type="button" className={eleveFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setEleveFormOuvert((v) => !v)}>
            {eleveFormOuvert ? 'Annuler' : '+ Inscrire un élève'}
          </button>
        </div>
        {eleveFormOuvert && (
          <form className="formulaire" onSubmit={creerEleve} autoComplete="off">
            <div className="ligne-champs">
              <div className="champ">
                <label>Prénom</label>
                <input value={nouvelEleve.prenom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, prenom: e.target.value })} required autoFocus />
              </div>
              <div className="champ">
                <label>Nom</label>
                <input value={nouvelEleve.nom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, nom: e.target.value })} required />
              </div>
            </div>
            <div className="ligne-champs">
              <div className="champ">
                <label>Classe</label>
                <select value={nouvelEleve.classeId} onChange={(e) => setNouvelEleve({ ...nouvelEleve, classeId: e.target.value })} required>
                  <option value="">Choisir une classe</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{nomClasse(c)}</option>)}
                </select>
              </div>
              <div className="champ">
                <label>E-mail (compte étudiant)</label>
                <input type="email" autoComplete="off" value={nouvelEleve.email} onChange={(e) => setNouvelEleve({ ...nouvelEleve, email: e.target.value })} required />
              </div>
            </div>
            <p className="note-secondaire" style={{ margin: 0, fontSize: 14 }}>
              Le matricule de l'élève est attribué automatiquement à l'inscription (sigle de l'établissement, année,
              numéro). Il sert aussi de mot de passe à son compte étudiant et ne se modifie pas.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={avecParent} onChange={(e) => setAvecParent(e.target.checked)} />
              Rattacher un compte Parent (consultation des notes, absences, bulletins…)
            </label>
            {avecParent && (
              <ChampParent
                parents={parents}
                valeur={nouvelEleve}
                onChange={(champs) => setNouvelEleve((v) => ({ ...v, ...champs }))}
                motDePasseVisible={parentMotDePasseVisible}
                onBasculerMotDePasseVisible={() => setParentMotDePasseVisible((v) => !v)}
              />
            )}

            <button className="primaire" type="submit">Inscrire l'élève</button>
            {message && <div className={message.includes('ajouté') ? 'message-succes' : 'message-erreur'}>{message}</div>}
          </form>
        )}
        <div className="entete-section" style={{ marginTop: 18 }}>
          <h3>Importer une liste (Excel/CSV)</h3>
          <button type="button" className={importFormOuvert ? 'secondaire' : 'primaire'} onClick={() => setImportFormOuvert((v) => !v)}>
            {importFormOuvert ? 'Annuler' : '+ Importer un fichier'}
          </button>
        </div>
        {importFormOuvert && (
          <>
            <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -4, marginBottom: 14 }}>
              Colonnes attendues : <strong>prénom</strong>, <strong>nom</strong>, <strong>email</strong>, et en
              option la date de naissance. Chaque élève reçoit automatiquement son matricule, qui est aussi son mot
              de passe.
            </p>
            <form className="formulaire" onSubmit={importerEleves}>
              <div className="ligne-champs">
                <div className="champ">
                  <label>Classe cible</label>
                  <select value={classeImportId} onChange={(e) => setClasseImportId(e.target.value)} required>
                    <option value="">Choisir une classe</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{nomClasse(c)}</option>)}
                  </select>
                </div>
                <div className="champ">
                  <label>Fichier</label>
                  <input type="file" name="fichierEleves" accept=".xlsx,.xls,.csv" required />
                </div>
              </div>
              <button className="secondaire" type="submit" disabled={importEnCours || !classeImportId}>
                {importEnCours ? 'Import en cours…' : 'Importer'}
              </button>
            </form>
          </>
        )}
        {resultatImport && (
          <div style={{ marginTop: 12 }}>
            {resultatImport.reussis.length > 0 && (
              <div className="message-succes" style={{ marginBottom: 8 }}>
                {resultatImport.reussis.length} élève(s) importé(s) dans « {resultatImport.classeNom} ».
                Identifiants dans le tableau « Identifiants de connexion » ci-dessous.
              </div>
            )}
            {resultatImport.echecs.length > 0 && (
              <div className="message-erreur">
                {resultatImport.echecs.length} ligne(s) ignorée(s) :
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {resultatImport.echecs.map((e, i) => <li key={i}>ligne {e.ligne} : {e.raison}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="carte" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Identifiants de connexion ({identifiantsCrees.length})</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <input
            type="search"
            placeholder="Rechercher un nom, un e-mail…"
            value={rechercheIdentifiants}
            onChange={(e) => setRechercheIdentifiants(e.target.value)}
            style={{ flex: '1 1 160px', minWidth: 0, maxWidth: 240 }}
          />
          {identifiantsCrees.length > 0 && (
            <button type="button" className="secondaire" style={{ padding: '4px 12px', fontSize: '0.78rem' }} onClick={() => setIdentifiantsCrees([])}>
              Vider
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -4, marginBottom: 16 }}>
        Comptes créés pendant cette visite (inscription, import, rattachement de parent), à relever ou copier
        maintenant, ils ne seront plus jamais affichés en clair une fois l'onglet du navigateur fermé. Mot de passe
        oublié ou perdu de vue ? Réinitialise-le pour en obtenir un nouveau, y compris pour un compte plus ancien.
      </p>
      {identifiantsParClasse.length === 0 && (
        <div className="vide">
          {identifiantsCrees.length === 0 ? 'Aucun identifiant créé pour l’instant' : 'Aucun résultat pour cette recherche'}
        </div>
      )}
      {identifiantsParClasse.map((groupe) => (
        <TableauDefilant key={groupe.classeId} titre={groupe.nom} compte={groupe.entrees.length}>
          <table>
            <thead><tr><th>Rôle</th><th>Nom</th><th>Matricule</th><th>E-mail</th><th>Mot de passe</th><th></th></tr></thead>
            <tbody>
              {groupe.entrees.map((entree) => (
                <tr key={entree.compteId ?? entree.id}>
                  <td>{entree.role}</td>
                  <td>{entree.prenom} {entree.nom}</td>
                  <td className="mono">{entree.matricule || <span className="note-secondaire">Sans objet</span>}</td>
                  <td style={{ fontFamily: 'var(--police-mono)' }}>{entree.email}</td>
                  <td style={{ fontFamily: 'var(--police-mono)' }}>{entree.motDePasse}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button" className="secondaire"
                      style={{ padding: '1px 8px', fontSize: '0.7rem' }}
                      onClick={() => copierIdentifiant(entree)}
                    >
                      Copier
                    </button>{' '}
                    {entree.compteId && (
                      <button
                        type="button" className="secondaire"
                        style={{ padding: '1px 8px', fontSize: '0.7rem' }}
                        onClick={() => setCompteAReinitialiser(entree)}
                      >
                        Réinitialiser
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableauDefilant>
      ))}
    </div>

      {eleveASupprimer && (
        <ConfirmModal
          titre="Retirer cet élève ?"
          onAnnuler={() => setEleveASupprimer(null)}
          onConfirmer={confirmerSuppressionEleve}
        >
          Retirer {eleveASupprimer.prenom} {eleveASupprimer.nom} ? Son compte étudiant sera aussi supprimé.
        </ConfirmModal>
      )}
      {compteAReinitialiser && (
        <ConfirmModal
          titre="Réinitialiser ce mot de passe ?"
          onAnnuler={() => setCompteAReinitialiser(null)}
          onConfirmer={confirmerReinitialisation}
          boutonConfirmer="Réinitialiser"
          boutonEnCours="Réinitialisation…"
        >
          {compteAReinitialiser.role === 'Étudiant' ? (
            <>
              Le mot de passe de {compteAReinitialiser.prenom} {compteAReinitialiser.nom} redeviendra son matricule. Il
              apparaîtra dans le tableau « Identifiants de connexion ».
            </>
          ) : (
            <>
              Réinitialiser le mot de passe de {compteAReinitialiser.prenom} {compteAReinitialiser.nom}{' '}
              ({compteAReinitialiser.role.toLowerCase()}) ? L'ancien mot de passe cessera immédiatement de fonctionner,
              le nouveau apparaîtra dans le tableau « Identifiants de connexion ».
            </>
          )}
        </ConfirmModal>
      )}
      {classeASupprimer && (
        <ConfirmModal
          titre="Supprimer cette classe ?"
          onAnnuler={() => setClasseASupprimer(null)}
          onConfirmer={confirmerSuppressionClasse}
        >
          Supprimer "{classeASupprimer.nom}" : {classeASupprimer.Eleves?.length ?? 0} élève(s), avec leurs comptes,
          notes, absences, bulletins et frais ? Cette action est irréversible.
        </ConfirmModal>
      )}
      {eleveParentCible && (
        <Modal titre={`Rattacher un parent à ${eleveParentCible.prenom} ${eleveParentCible.nom}`} onFermer={() => setEleveParentCible(null)}>
          <p className="note-secondaire" style={{ margin: '0 0 14px', fontSize: '0.83rem' }}>
            Un même parent peut suivre plusieurs enfants. Choisis-le dans la liste s'il a déjà un compte,
            ou renseigne un nouveau parent ci-dessous.
          </p>
          <form className="formulaire" onSubmit={soumettreRattacherParent}>
            <ChampParent
              parents={parents}
              valeur={formRattacherParent}
              onChange={(champs) => setFormRattacherParent((v) => ({ ...v, ...champs }))}
              motDePasseVisible={rattacherParentMotDePasseVisible}
              onBasculerMotDePasseVisible={() => setRattacherParentMotDePasseVisible((v) => !v)}
            />
            <button className="primaire" type="submit" disabled={enCoursRattacherParent}>
              {enCoursRattacherParent ? 'Rattachement…' : 'Rattacher'}
            </button>
            {erreurRattacherParent && <div className="message-erreur">{erreurRattacherParent}</div>}
          </form>
        </Modal>
      )}
    </>
  );
}
