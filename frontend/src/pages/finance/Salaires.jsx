import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  IconUsers, IconGraduationCap, IconWallet, IconMail, IconSearch, IconPlus, IconEdit, IconDownload, IconInfo, IconChevronRight,
} from '../../components/icons';

const FILTRES = [
  { id: '', libelle: 'Tous' },
  { id: 'enseignants', libelle: 'Enseignants' },
  { id: 'autres', libelle: 'Autres' },
];

function initiales(personne) {
  return `${personne.prenom?.[0] ?? ''}${personne.nom?.[0] ?? ''}`.toUpperCase();
}

function fcfa(montant) {
  return `${Math.round(montant || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

function dateLongue(iso) {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function periodeDe(mois) {
  if (!mois) return '';
  const [annee, m] = mois.split('-').map(Number);
  const libelle = new Date(annee, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

// Paie du personnel : les professeurs enregistrés par l'Académie y
// figurent automatiquement, à côté du personnel ajouté par la Finance.
// Tableau pleine largeur ; la fiche d'une personne (salaire, historique,
// versement) s'ouvre dans un tiroir.
export default function Salaires() {
  const [personnel, setPersonnel] = useState(null);
  const [personnelId, setPersonnelId] = useState('');
  const [fiche, setFiche] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [versement, setVersement] = useState(false);
  const [creation, setCreation] = useState(false);
  const [edition, setEdition] = useState(false);
  const [toast, setToast] = useState(null);

  function chargerPersonnel() {
    client.get('/finance/personnel').then((res) => setPersonnel(res.data.personnel)).catch(() => setPersonnel([]));
  }
  useEffect(chargerPersonnel, []);

  function chargerFiche(id) {
    client.get(`/finance/personnel/${id}/fiche`).then((res) => setFiche(res.data));
  }
  useEffect(() => {
    setFiche(null);
    if (personnelId) chargerFiche(personnelId);
  }, [personnelId]);
  useActualisation(() => {
    chargerPersonnel();
    if (personnelId) chargerFiche(personnelId);
  });

  const liste = personnel || [];
  const r = recherche.trim().toLowerCase();
  const affiches = liste
    .filter((p) => !filtre || (filtre === 'enseignants' ? p.enseignant : !p.enseignant))
    .filter((p) => !r || `${p.prenom} ${p.nom} ${p.poste}`.toLowerCase().includes(r));
  const enseignants = liste.filter((p) => p.enseignant).length;
  const masse = liste.reduce((s, p) => s + (p.totalVerse || 0), 0);
  const sansEmail = liste.filter((p) => !p.email).length;
  const personne = fiche?.personnel;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Personnel</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{personnel ? liste.length : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Dont enseignants</span><span className="puce-icone petite"><IconGraduationCap /></span></div>
          <div className="valeur">{personnel ? enseignants : '…'}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Total versé</span><span className="puce-icone petite"><IconWallet /></span></div>
          <div className="valeur valeur-montant">{personnel ? fcfa(masse) : '…'}</div>
        </div>
        <div className={`stat-tile ${sansEmail ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Sans adresse e-mail</span><span className="puce-icone petite"><IconMail /></span></div>
          <div className="valeur">{personnel ? sansEmail : '…'}</div>
        </div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Personnel <span className="entete-carte-compteur">{affiches.length}</span></h2>
          <div className="actions-carte">
            <button className="primaire" onClick={() => setCreation(true)}><IconPlus /> Ajouter</button>
          </div>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un nom, un poste…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un membre du personnel" />
          </label>
          <div className="filtres-puces" role="group" aria-label="Filtrer le personnel">
            {FILTRES.map((f) => (
              <button key={f.id} type="button" className={filtre === f.id ? 'actif' : ''} onClick={() => setFiltre(f.id)}>{f.libelle}</button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nom et prénom</th>
                <th>Poste</th>
                <th>Type</th>
                <th className="chiffre">Salaire de base</th>
                <th className="chiffre">Versements</th>
                <th className="chiffre">Total versé</th>
                <th aria-label="Ouvrir la fiche" />
              </tr>
            </thead>
            <tbody>
              {affiches.map((p) => (
                <tr key={p.id} className="ligne-cliquable" onClick={() => setPersonnelId(String(p.id))}>
                  <td className="cellule-nom">{p.nom} {p.prenom}</td>
                  <td>{p.poste}</td>
                  <td>{p.enseignant ? <span className="badge bleu sans-point">Enseignant</span> : <span className="badge gris sans-point">Personnel</span>}</td>
                  <td className="chiffre">{p.salaireBase ? fcfa(p.salaireBase) : <span className="note-secondaire">Non renseigné</span>}</td>
                  <td className="chiffre">{p.nbVersements ?? 0}</td>
                  <td className="chiffre">{fcfa(p.totalVerse)}</td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {personnel && affiches.length === 0 && (
                <tr>
                  <td colSpan={7} className="vide">
                    {liste.length === 0
                      ? "Aucun personnel. Les professeurs enregistrés par l'Académie apparaissent ici automatiquement ; le reste du personnel s'ajoute avec « Ajouter »."
                      : 'Aucun résultat.'}
                  </td>
                </tr>
              )}
              {!personnel && <tr><td colSpan={7} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {personne && String(personne.id) === personnelId && (
        <Tiroir
          titre={`${personne.prenom} ${personne.nom}`}
          sousTitre={personne.poste}
          icone={<span className="avatar-initiales">{initiales(personne)}</span>}
          onFermer={() => setPersonnelId('')}
          pied={(
            <>
              <button className="secondaire" onClick={() => setEdition(true)}><IconEdit /> Modifier la fiche</button>
              <button className="primaire" onClick={() => setVersement(true)}><IconWallet /> Nouveau versement</button>
            </>
          )}
        >
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Fiche</h3>
            <dl className="fiche-compte">
              <div><dt>Type</dt><dd>{personne.enseignant ? 'Enseignant' : 'Personnel administratif et technique'}</dd></div>
              <div><dt>E-mail</dt><dd>{personne.email || 'Non renseigné'}</dd></div>
              <div><dt>Salaire de base</dt><dd>{personne.salaireBase ? fcfa(personne.salaireBase) : 'Non renseigné'}</dd></div>
              <div><dt>Embauche</dt><dd>{personne.dateEmbauche ? dateLongue(personne.dateEmbauche) : 'Non renseignée'}</dd></div>
              <div><dt>Total versé</dt><dd>{fcfa(fiche.salaires.filter((x) => x.statut === 'verse').reduce((a, x) => a + x.montant, 0))}</dd></div>
            </dl>
            {!personne.email && (
              <div className="encart-info" style={{ marginTop: 14 }}>
                <IconInfo />
                <span>Aucune adresse e-mail : la fiche de paie sera générée mais ne pourra pas être envoyée.</span>
              </div>
            )}
            {personne.enseignant && (
              <div className="encart-info" style={{ marginTop: 14 }}>
                <IconInfo />
                <span>Professeur enregistré par l'Académie : son nom et son e-mail se modifient dans Comptes éphémères.</span>
              </div>
            )}
          </section>
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Versements ({fiche.salaires.filter((x) => x.statut === 'verse').length})</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Période</th><th className="chiffre">Montant</th><th>Versé le</th><th aria-label="Fiche de paie" /></tr></thead>
                <tbody>
                  {fiche.salaires.map((x) => (
                    <tr key={x.id}>
                      <td className="cellule-nom">{x.periode}</td>
                      <td className="chiffre">{fcfa(x.montant)}</td>
                      <td>{x.dateVersement ? dateLongue(x.dateVersement) : <span className="note-secondaire">Non versé</span>}</td>
                      <td className="cellule-actions">
                        {x.fichierPDF && (
                          <a href={x.fichierPDF} target="_blank" rel="noreferrer" className="bouton-lien-secondaire" title="Fiche de paie PDF"><IconDownload /> PDF</a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {fiche.salaires.length === 0 && <tr><td colSpan={4} className="vide">Aucun versement enregistré pour le moment.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </Tiroir>
      )}

      {versement && personne && (
        <FormulaireVersement
          personne={personne}
          onFermer={() => setVersement(false)}
          onReussi={(ficheEnvoyeeA) => {
            setVersement(false);
            chargerFiche(personnelId);
            chargerPersonnel();
            setToast({ message: ficheEnvoyeeA ? `Versement enregistré. Fiche de paie envoyée à ${ficheEnvoyeeA}.` : 'Versement enregistré, fiche de paie générée.', type: 'succes' });
          }}
        />
      )}
      {creation && (
        <FichePersonnel
          onFermer={() => setCreation(false)}
          onReussi={(nouveau) => {
            setCreation(false);
            chargerPersonnel();
            setPersonnelId(String(nouveau.id));
            setToast({ message: `${nouveau.prenom} ${nouveau.nom} ajouté(e) au personnel.`, type: 'succes' });
          }}
        />
      )}
      {edition && personne && (
        <FichePersonnel
          personne={personne}
          onFermer={() => setEdition(false)}
          onReussi={() => {
            setEdition(false);
            chargerPersonnel();
            chargerFiche(personnelId);
            setToast({ message: 'Fiche mise à jour.', type: 'succes' });
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FichePersonnel({ personne, onFermer, onReussi }) {
  const edition = !!personne;
  const verrouille = !!personne?.enseignant;
  const [form, setForm] = useState({
    nom: personne?.nom || '', prenom: personne?.prenom || '', email: personne?.email || '', poste: personne?.poste || '',
    salaireBase: personne?.salaireBase ?? '', dateEmbauche: personne?.dateEmbauche || '',
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const corps = { ...form, salaireBase: form.salaireBase === '' ? null : Number(form.salaireBase) };
      const res = edition
        ? await client.put(`/finance/personnel/${personne.id}`, corps)
        : await client.post('/finance/personnel', corps);
      onReussi(res.data.personnel);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer cette fiche"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={edition ? `Fiche de ${personne.prenom} ${personne.nom}` : 'Nouveau membre du personnel'} onFermer={onFermer} largeur={580}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="fp-prenom">Prénom</label><input id="fp-prenom" value={form.prenom} onChange={maj('prenom')} required disabled={verrouille} /></div>
          <div className="champ"><label htmlFor="fp-nom">Nom</label><input id="fp-nom" value={form.nom} onChange={maj('nom')} required disabled={verrouille} /></div>
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="fp-poste">Poste</label>
            <input id="fp-poste" placeholder="Ex. Surveillant général, Comptable" value={form.poste} onChange={maj('poste')} required />
          </div>
          <div className="champ">
            <label htmlFor="fp-email">E-mail (envoi des fiches de paie)</label>
            <input id="fp-email" type="email" value={form.email} onChange={maj('email')} disabled={verrouille} />
          </div>
        </div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="fp-base">Salaire de base (FCFA)</label><input id="fp-base" type="number" min="0" value={form.salaireBase} onChange={maj('salaireBase')} /></div>
          <div className="champ"><label htmlFor="fp-embauche">Date d'embauche</label><input id="fp-embauche" type="date" value={form.dateEmbauche} onChange={maj('dateEmbauche')} /></div>
        </div>
        {verrouille && <p className="note-secondaire" style={{ margin: 0 }}>Nom, prénom et e-mail d'un professeur se modifient côté Académie.</p>}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : edition ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FormulaireVersement({ personne, onFermer, onReussi }) {
  const maintenant = new Date();
  const [form, setForm] = useState({
    montant: personne.salaireBase ?? '',
    mois: `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`,
    dateVersement: `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`,
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/finance/salaires', {
        personnelId: personne.id, montant: Number(form.montant), periode: periodeDe(form.mois), dateVersement: form.dateVersement,
      });
      onReussi(res.data.ficheEnvoyeeA);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer le versement"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Versement : ${personne.prenom} ${personne.nom}`} onFermer={onFermer} largeur={540}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="v-mois">Mois concerné</label><input id="v-mois" type="month" value={form.mois} onChange={(e) => setForm({ ...form, mois: e.target.value })} required /></div>
          <div className="champ"><label htmlFor="v-date">Date de versement</label><input id="v-date" type="date" value={form.dateVersement} onChange={(e) => setForm({ ...form, dateVersement: e.target.value })} required /></div>
        </div>
        <div className="champ">
          <label htmlFor="v-montant">Montant net (FCFA)</label>
          <input id="v-montant" type="number" min="1" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required />
        </div>
        <div className="encart-info">
          <IconInfo />
          <span>
            Une fiche de paie « {periodeDe(form.mois) || '…'} » sera générée
            {personne.email ? ` et envoyée à ${personne.email}.` : ' (aucune adresse e-mail : elle ne sera pas envoyée).'}
          </span>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer le versement'}</button>
        </div>
      </form>
    </Modal>
  );
}
