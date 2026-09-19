import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { lireFichierExcel, motDePasseAleatoire } from '../../utils/excel';
import ConfirmModal from '../../components/ConfirmModal';

const ELEVE_VIDE = {
  nom: '', prenom: '', classeId: '', email: '', motDePasse: '',
  parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '',
};
// Un établissement peut compter des milliers d'élèves — rendre 7000 lignes
// d'un coup alourdit le navigateur pour rien, alors que l'API renvoie déjà
// tout (le filtrage par classe reste instantané côté client). Fenêtrage de
// l'affichage seulement, pas de la requête.
const TAILLE_PAGE = 50;

export default function ElevesClasses() {
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [nouvelleClasse, setNouvelleClasse] = useState({ nom: '', niveau: '' });
  const [nouvelEleve, setNouvelEleve] = useState(ELEVE_VIDE);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [parentMotDePasseVisible, setParentMotDePasseVisible] = useState(false);
  const [message, setMessage] = useState('');
  // Recap des identifiants juste créés (l'académie doit pouvoir les
  // relever/communiquer — le mot de passe redevient irrécupérable dès que
  // le formulaire se vide, il n'existe plus qu'en haché côté serveur).
  const [dernierCompteCree, setDernierCompteCree] = useState(null);
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
  const [erreurClasse, setErreurClasse] = useState('');

  const [filtreClasse, setFiltreClasse] = useState('');
  const [pageEleves, setPageEleves] = useState(0);

  const [eleveASupprimer, setEleveASupprimer] = useState(null);

  function charger() {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/eleves').then((res) => setEleves(res.data.eleves));
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

  async function supprimerClasseAction(id) {
    setErreurClasse('');
    try {
      await client.delete(`/classes/${id}`);
      setClasseOuverte(null);
      charger();
    } catch (err) {
      setErreurClasse(err.response?.data?.erreur || 'erreur');
    }
  }

  async function confirmerSuppressionEleve() {
    await client.delete(`/eleves/${eleveASupprimer.id}`);
    setEleveASupprimer(null);
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
      const motDePasse = ligne.motdepasse || ligne.mdp || ligne.password || motDePasseAleatoire();
      try {
        await client.post('/eleves', {
          nom, prenom, email,
          motDePasse: String(motDePasse),
          classeId: classeImportId,
          dateNaissance: ligne.datenaissance || undefined,
        });
        reussis.push({ nom, prenom, email, motDePasse });
      } catch (err) {
        echecs.push({ ligne: i + 2, raison: err.response?.data?.erreur || 'erreur inconnue' });
      }
    }
    setResultatImport({ reussis, echecs });
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
    setDernierCompteCree(null);
    try {
      // Champs parent ignorés si la case n'est pas cochée, même si
      // l'académie y avait tapé quelque chose puis décoché.
      const payload = avecParent
        ? nouvelEleve
        : { ...nouvelEleve, parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };
      const res = await client.post('/eleves', payload);
      setDernierCompteCree({
        etudiant: { email: nouvelEleve.email, motDePasse: nouvelEleve.motDePasse },
        // Compte parent réutilisé (déjà existant) : le mot de passe tapé ici
        // n'a servi à rien côté serveur, donc jamais le réafficher comme si
        // c'était le sien — seulement pour un compte fraîchement créé.
        parent: res.data.compteParent && !res.data.parentReutilise
          ? { email: nouvelEleve.parentEmail, motDePasse: nouvelEleve.parentMotDePasse }
          : null,
        parentReutilise: Boolean(res.data.compteParent) && res.data.parentReutilise,
      });
      setNouvelEleve(ELEVE_VIDE);
      setAvecParent(false);
      setMotDePasseVisible(false);
      setParentMotDePasseVisible(false);
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  const elevesAffiches = filtreClasse ? eleves.filter((e) => String(e.classeId) === filtreClasse) : eleves;
  const totalPagesEleves = Math.max(1, Math.ceil(elevesAffiches.length / TAILLE_PAGE));
  const pageEleveActuelle = Math.min(pageEleves, totalPagesEleves - 1);
  const elevesPage = elevesAffiches.slice(pageEleveActuelle * TAILLE_PAGE, (pageEleveActuelle + 1) * TAILLE_PAGE);

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Classes</h2>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 16 }}>
          Clique une classe pour voir son effectif, ses statistiques, la modifier ou la supprimer.
        </p>
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
                            <div className="detail-classe-chiffre">
                              <strong>{statsClasse.effectif}</strong>
                              <span>élève(s)</span>
                            </div>
                            <span className={`badge ${statsClasse.statut === 'active' ? 'vert' : 'gris'}`}>
                              {statsClasse.statut === 'active' ? 'Active' : 'Vide'}
                            </span>
                            <div className="detail-classe-chiffre">
                              <strong>{statsClasse.absences.total}</strong>
                              <span>absence(s) — {statsClasse.absences.justifiees} justifiée(s), {statsClasse.absences.nonJustifiees} non justifiée(s)</span>
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
                            <input value={editionClasse.niveau} onChange={(e) => setEditionClasse({ ...editionClasse, niveau: e.target.value })} />
                          </div>
                        </div>
                        {erreurClasse && <div className="message-erreur" style={{ marginTop: 10 }}>{erreurClasse}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="secondaire succes" onClick={() => enregistrerClasse(c.id)}>Enregistrer</button>
                          <button className="secondaire danger" onClick={() => supprimerClasseAction(c.id)}>Supprimer</button>
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
                <input value={nouvelleClasse.niveau} onChange={(e) => setNouvelleClasse({ ...nouvelleClasse, niveau: e.target.value })} required />
              </div>
            </div>
            <button className="primaire" type="submit">Ajouter la classe</button>
          </form>
        )}
      </div>

      <div className="carte">
        <h2>Élèves</h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Liste ({elevesAffiches.length})</h3>
          <select value={filtreClasse} onChange={(e) => { setFiltreClasse(e.target.value); setPageEleves(0); }} style={{ maxWidth: 200 }}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>Élève</th><th>Classe</th><th>Parent</th><th></th></tr></thead>
          <tbody>
            {elevesPage.map((e) => (
              <tr key={e.id}>
                <td>{e.prenom} {e.nom}</td>
                <td>{e.Classe?.nom ?? '—'}</td>
                <td>
                  {e.parent ? (
                    <>
                      {e.parent.prenom} {e.parent.nom}
                      <div className="note-secondaire" style={{ fontSize: '0.74rem' }}>{e.parent.email}</div>
                    </>
                  ) : (
                    <span className="note-secondaire">— aucun</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="secondaire danger" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => setEleveASupprimer(e)}>
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
            {elevesAffiches.length === 0 && <tr><td colSpan={4} className="vide">Aucun élève</td></tr>}
          </tbody>
        </table>
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
                  <option value="">—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="champ">
                <label>E-mail (compte étudiant)</label>
                <input type="email" autoComplete="off" value={nouvelEleve.email} onChange={(e) => setNouvelEleve({ ...nouvelEleve, email: e.target.value })} required />
              </div>
            </div>
            <div className="ligne-champs">
              <div className="champ" style={{ flex: 1 }}>
                <label>Mot de passe (compte étudiant)</label>
                <input
                  type={motDePasseVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={nouvelEleve.motDePasse}
                  onChange={(e) => setNouvelEleve({ ...nouvelEleve, motDePasse: e.target.value })}
                  minLength={6}
                  required
                />
              </div>
              <button
                type="button" className="secondaire"
                style={{ alignSelf: 'flex-end', marginBottom: 1 }}
                onClick={() => setMotDePasseVisible((v) => !v)}
              >
                {motDePasseVisible ? 'Masquer' : 'Afficher'}
              </button>
              <button
                type="button" className="secondaire"
                style={{ alignSelf: 'flex-end', marginBottom: 1 }}
                // À voir tout de suite : un mot de passe généré et jamais
                // relevé (parce que caché derrière des points) est perdu
                // dès la fermeture du formulaire.
                onClick={() => { setNouvelEleve({ ...nouvelEleve, motDePasse: motDePasseAleatoire() }); setMotDePasseVisible(true); }}
              >
                Générer
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={avecParent} onChange={(e) => setAvecParent(e.target.checked)} />
              Rattacher un compte Parent (consultation des notes, absences, bulletins…)
            </label>
            {avecParent && (
              <>
                <p className="note-secondaire" style={{ margin: '-4px 0 0' }}>
                  Un même parent peut être rattaché à plusieurs enfants — s'il a déjà un compte, son e-mail suffit,
                  pas besoin de renseigner à nouveau nom/prénom/mot de passe.
                </p>
                <div className="ligne-champs">
                  <div className="champ">
                    <label>Prénom du parent</label>
                    <input value={nouvelEleve.parentPrenom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, parentPrenom: e.target.value })} />
                  </div>
                  <div className="champ">
                    <label>Nom du parent</label>
                    <input value={nouvelEleve.parentNom} onChange={(e) => setNouvelEleve({ ...nouvelEleve, parentNom: e.target.value })} />
                  </div>
                </div>
                <div className="ligne-champs">
                  <div className="champ">
                    <label>E-mail du parent</label>
                    <input type="email" autoComplete="off" value={nouvelEleve.parentEmail} onChange={(e) => setNouvelEleve({ ...nouvelEleve, parentEmail: e.target.value })} required />
                  </div>
                  <div className="champ" style={{ flex: 1 }}>
                    <label>Mot de passe (si nouveau compte)</label>
                    <input
                      type={parentMotDePasseVisible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={nouvelEleve.parentMotDePasse}
                      onChange={(e) => setNouvelEleve({ ...nouvelEleve, parentMotDePasse: e.target.value })}
                      minLength={6}
                    />
                  </div>
                  <button
                    type="button" className="secondaire"
                    style={{ alignSelf: 'flex-end', marginBottom: 1 }}
                    onClick={() => setParentMotDePasseVisible((v) => !v)}
                  >
                    {parentMotDePasseVisible ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </>
            )}

            <button className="primaire" type="submit">Inscrire l'élève</button>
            {message && <div className={message.includes('ajouté') ? 'message-succes' : 'message-erreur'}>{message}</div>}
          </form>
        )}
        {dernierCompteCree && (
          <div className="message-succes" style={{ marginTop: 12, lineHeight: 1.7 }}>
            Élève ajouté — identifiants à relever maintenant, ils ne seront plus jamais affichés en clair :
            <br />
            Compte étudiant : <strong style={{ fontFamily: 'var(--police-mono)' }}>{dernierCompteCree.etudiant.email} / {dernierCompteCree.etudiant.motDePasse}</strong>
            {dernierCompteCree.parent && (
              <>
                <br />
                Compte parent : <strong style={{ fontFamily: 'var(--police-mono)' }}>{dernierCompteCree.parent.email} / {dernierCompteCree.parent.motDePasse}</strong>
              </>
            )}
            {dernierCompteCree.parentReutilise && (
              <>
                <br />
                Compte parent rattaché à un compte existant — son mot de passe reste celui déjà en place, inchangé.
              </>
            )}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="secondaire" style={{ padding: '3px 10px', fontSize: '0.76rem' }} onClick={() => setDernierCompteCree(null)}>
                Compris, masquer
              </button>
            </div>
          </div>
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
              Colonnes attendues : <strong>prénom</strong>, <strong>nom</strong>, <strong>email</strong> — et en
              option date de naissance, mot de passe (sinon généré automatiquement).
            </p>
            <form className="formulaire" onSubmit={importerEleves}>
              <div className="ligne-champs">
                <div className="champ">
                  <label>Classe cible</label>
                  <select value={classeImportId} onChange={(e) => setClasseImportId(e.target.value)} required>
                    <option value="">—</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
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
                {resultatImport.reussis.length} élève(s) importé(s).
              </div>
            )}
            {resultatImport.reussis.length > 0 && (
              <table style={{ marginBottom: 8 }}>
                <thead><tr><th>Élève</th><th>E-mail</th><th>Mot de passe</th></tr></thead>
                <tbody>
                  {resultatImport.reussis.map((r, i) => (
                    <tr key={i}>
                      <td>{r.prenom} {r.nom}</td>
                      <td style={{ fontFamily: 'var(--police-mono)' }}>{r.email}</td>
                      <td style={{ fontFamily: 'var(--police-mono)' }}>{r.motDePasse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {eleveASupprimer && (
        <ConfirmModal
          titre="Retirer cet élève ?"
          onAnnuler={() => setEleveASupprimer(null)}
          onConfirmer={confirmerSuppressionEleve}
        >
          Retirer {eleveASupprimer.prenom} {eleveASupprimer.nom} ? Son compte étudiant sera aussi supprimé.
        </ConfirmModal>
      )}
    </div>
  );
}
