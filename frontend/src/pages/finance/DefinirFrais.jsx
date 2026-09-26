import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { IconBanknote, IconSearch, IconPlus, IconWallet } from '../../components/icons';
import { totalElevesParNiveaux } from '../../utils/totaux';

const STYLE_STATUT = { du: 'gris', partiel: 'or', solde: 'vert', impaye: 'rouge', sans_frais: 'gris' };
const LIBELLE_STATUT = { du: 'Dû', partiel: 'Partiel', solde: 'À jour', impaye: 'Impayé', sans_frais: 'Sans frais' };

function fcfa(montant) {
  return `${Math.round(montant || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

// Dès qu'un étudiant est inscrit, la Finance doit voir son frais sans avoir
// à le créer élève par élève : une classe, tout un niveau ou l'établissement
// entier se règle en un geste ("+ Définir un frais"), jamais élève par élève
// depuis la liste — qui ne sert qu'à consulter net à payer / versé / reste
// et à encaisser directement quand un frais actif existe.
export default function DefinirFrais() {
  const [niveaux, setNiveaux] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modaleClasseOuverte, setModaleClasseOuverte] = useState(false);
  const [eleveEnPaiement, setEleveEnPaiement] = useState(null);
  const [toast, setToast] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [classeId, setClasseId] = useState('');

  function charger(silencieux = false) {
    if (!silencieux) setChargement(true);
    client.get('/finance/impayes/par-classe').then((res) => {
      setNiveaux(res.data.niveaux);
      setChargement(false);
    }).catch(() => setChargement(false));
  }
  useEffect(() => { charger(); }, []);
  useActualisation(() => charger(true));

  const totalEleves = totalElevesParNiveaux(niveaux);
  const totalNetAPayer = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.reduce((s3, e) => s3 + e.totalDu, 0), 0), 0);
  const totalVerse = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.reduce((s3, e) => s3 + e.totalRegle, 0), 0), 0);

  // Recherche par nom : on filtre les élèves de chaque classe, puis on
  // masque les classes/niveaux qui n'ont plus personne à afficher — pas
  // besoin d'un onglet séparé, l'étudiant cherché reste encaissable ici
  // exactement comme dans la liste complète.
  const termeRecherche = recherche.trim().toLowerCase();
  const groupes = niveaux.flatMap((n) => n.classes
    .filter((c) => !classeId || String(c.id) === classeId)
    .map((c) => ({
      niveau: n.niveau,
      classe: c,
      eleves: c.eleves.filter((e) => !termeRecherche || `${e.prenom} ${e.nom} ${e.nom} ${e.prenom}`.toLowerCase().includes(termeRecherche)),
    }))
    .filter((g) => !termeRecherche || g.eleves.length > 0));
  const classes = niveaux.flatMap((n) => n.classes.map((c) => ({ ...c, niveau: n.niveau })));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Net à payer</span><span className="puce-icone petite"><IconBanknote width={16} height={16} /></span></div>
          <div className="valeur valeur-montant">{fcfa(totalNetAPayer)}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Déjà versé</span></div>
          <div className="valeur valeur-montant">{fcfa(totalVerse)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Reste dû</span></div>
          <div className="valeur valeur-montant">{fcfa(totalNetAPayer - totalVerse)}</div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Frais de scolarité <span className="entete-carte-compteur">{totalEleves} étudiant{totalEleves > 1 ? 's' : ''}</span></h2>
          <button className="primaire" onClick={() => setModaleClasseOuverte(true)}><IconPlus /> Définir un frais</button>
        </div>

        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un étudiant…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un étudiant" />
          </label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Filtrer par classe" className="filtre-select">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
        </div>

        <div className="table-scroll defilement-visible">
          <table className="table-impayes">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th className="chiffre">Net à payer</th>
                <th className="chiffre">Versé</th>
                <th className="chiffre">Reste</th>
                <th>Statut</th>
                <th className="cellule-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map(({ niveau, classe, eleves }) => (
                <Fragment key={classe.id}>
                  <tr className="ligne-groupe">
                    <td colSpan={6}>
                      <span className="ligne-groupe-niveau">{niveau}</span>
                      <strong>{classe.nom}</strong>
                      <span className="entete-carte-compteur">{classe.eleves.length} élève{classe.eleves.length > 1 ? 's' : ''}</span>
                      {classe.eleves.length === 0 && <span className="note-secondaire">Aucun élève dans cette classe</span>}
                    </td>
                  </tr>
                  {eleves.map((eleve) => (
                    <tr key={eleve.id}>
                      <td className="cellule-nom">{eleve.nom} {eleve.prenom}</td>
                      <td className="chiffre">{fcfa(eleve.totalDu)}</td>
                      <td className="chiffre note-secondaire">{fcfa(eleve.totalRegle)}</td>
                      <td className={`chiffre ${eleve.resteDu > 0 ? 'reste-du' : 'ton-reussite'}`}>{eleve.resteDu > 0 ? fcfa(eleve.resteDu) : 'Soldé'}</td>
                      <td><span className={`badge ${STYLE_STATUT[eleve.statutGlobal]}`}>{LIBELLE_STATUT[eleve.statutGlobal]}</span></td>
                      <td className="cellule-actions">
                        {eleve.fraisActifId
                          ? <button className="bouton-icone-texte" onClick={() => setEleveEnPaiement({ ...eleve, classeNom: classe.nom })}><IconWallet /> Encaisser</button>
                          : <span className="note-secondaire">Aucune</span>}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {chargement && <tr><td colSpan={6} className="chargement">Chargement…</td></tr>}
              {!chargement && niveaux.length === 0 && <tr><td colSpan={6} className="vide">Aucune classe enregistrée.</td></tr>}
              {!chargement && niveaux.length > 0 && groupes.length === 0 && (
                <tr><td colSpan={6} className="vide">Aucun étudiant ne correspond à cette recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modaleClasseOuverte && (
        <FormulaireFraisClasse
          onFermer={() => setModaleClasseOuverte(false)}
          onReussi={(msg) => { setModaleClasseOuverte(false); charger(); setToast({ message: msg, type: 'succes' }); }}
        />
      )}
      {eleveEnPaiement && (
        <FormulairePaiementRapide
          eleve={eleveEnPaiement}
          // La liste doit refléter le nouveau statut dès l'encaissement, pas
          // seulement à la fermeture — la Finance regarde souvent le reçu un
          // moment avant de fermer la fenêtre.
          onPaye={charger}
          onFermer={() => { setEleveEnPaiement(null); charger(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

const LIBELLE_PORTEE = { classe: 'à cette classe', niveau: 'à ce niveau', etablissement: "à l'établissement" };

function FormulaireFraisClasse({ onFermer, onReussi }) {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [form, setForm] = useState({ portee: 'classe', classeId: '', niveau: '', semestreId: '', libelle: '', montant: '', dateEcheance: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  // Ordre d'apparition des classes, sans doublon — pas triés alphabétiquement
  // pour rester lisible même si deux niveaux partagent un préfixe.
  const niveaux = [...new Set(classes.map((c) => c.niveau))];

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/finance/frais/classe', {
        portee: form.portee,
        classeId: form.portee === 'classe' ? Number(form.classeId) : undefined,
        niveau: form.portee === 'niveau' ? form.niveau : undefined,
        semestreId: Number(form.semestreId), libelle: form.libelle, montant: Number(form.montant), dateEcheance: form.dateEcheance,
      });
      const { nombreCrees, nombreDejaExistants } = res.data;
      const cible = LIBELLE_PORTEE[form.portee];
      onReussi(
        nombreDejaExistants > 0
          ? `Frais défini pour ${nombreCrees} étudiant(s) ${cible}. ${nombreDejaExistants} en avaient déjà un pour ce libellé.`
          : `Frais défini pour ${nombreCrees} étudiant(s) ${cible}.`
      );
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de définir ce frais');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Définir un frais de scolarité" onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="champ">
          <label>Portée</label>
          <select value={form.portee} onChange={(e) => setForm({ ...form, portee: e.target.value, classeId: '', niveau: '' })}>
            <option value="classe">Une classe précise</option>
            <option value="niveau">Tout un niveau (plusieurs classes)</option>
            <option value="etablissement">Tout l'établissement</option>
          </select>
        </div>
        <div className="ligne-champs">
          {form.portee === 'classe' && (
            <div className="champ">
              <label>Classe</label>
              <select value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })} required>
                <option value="">Choisir une classe</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
              </select>
            </div>
          )}
          {form.portee === 'niveau' && (
            <div className="champ">
              <label>Niveau</label>
              <select value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} required>
                <option value="">Choisir un niveau</option>
                {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          <div className="champ">
            <label>Semestre</label>
            <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
              <option value="">Choisir un semestre</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label>Libellé</label>
          <input placeholder="ex. Frais de scolarité, Semestre 1" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Montant par étudiant (FCFA)</label><input type="number" min="0" placeholder="150 000" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ"><label>Échéance</label><input type="date" value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} required /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>
          {enCours ? 'Application…' : `Appliquer ${LIBELLE_PORTEE[form.portee]}`}
        </button>
      </form>
    </Modal>
  );
}

function FormulairePaiementRapide({ eleve, onFermer, onPaye }) {
  const [form, setForm] = useState({ montant: '', modePaiement: 'especes' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  // Non null une fois le paiement encaissé — le formulaire cède alors la
  // place au reçu, dans la même fenêtre : la Finance encaisse en personne
  // (souvent en espèces) et doit pouvoir l'imprimer/le montrer tout de
  // suite, pas seulement compter sur l'e-mail envoyé à l'étudiant.
  const [confirmation, setConfirmation] = useState(null);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/finance/paiements', { fraisId: eleve.fraisActifId, montant: Number(form.montant), modePaiement: form.modePaiement });
      setConfirmation({ montant: Number(form.montant), recu: res.data.recu, recuEnvoyeA: res.data.recuEnvoyeA });
      onPaye();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'erreur (montant incorrect)');
    } finally {
      setEnCours(false);
    }
  }

  if (confirmation) {
    return (
      <Modal titre="Paiement encaissé" onFermer={onFermer} largeur={440}>
        <div className="message-succes" style={{ marginBottom: 16 }}>
          {confirmation.montant.toLocaleString('fr-FR')} FCFA encaissé pour {eleve.prenom} {eleve.nom}.
        </div>
        <a
          href={confirmation.recu.fichierPDF}
          target="_blank"
          rel="noreferrer"
          className="primaire"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '11px 16px', borderRadius: 8 }}
        >
          Télécharger le reçu n° {confirmation.recu.numero}
        </a>
        {confirmation.recuEnvoyeA && (
          <p className="note-secondaire" style={{ marginTop: 12, marginBottom: 0 }}>
            Un exemplaire a aussi été envoyé par e-mail à {confirmation.recuEnvoyeA}.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal titre={`Encaisser : ${eleve.prenom} ${eleve.nom}`} onFermer={onFermer} largeur={440}>
      <p className="note-secondaire" style={{ marginTop: -8 }}>{eleve.classeNom}, reste dû {eleve.resteDu.toLocaleString('fr-FR')} FCFA</p>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label>Montant (FCFA)</label><input type="number" min="0" max={eleve.resteDu} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ">
            <label>Mode de paiement</label>
            <select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })}>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile money</option>
              <option value="virement">Virement</option>
            </select>
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Encaisser'}</button>
      </form>
    </Modal>
  );
}
