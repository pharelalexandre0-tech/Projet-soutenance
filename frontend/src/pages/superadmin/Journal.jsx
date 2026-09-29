import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { IconSearch, IconTrash } from '../../components/icons';

const CATEGORIES = {
  etablissement: 'Établissements',
  fonctionnalite: 'Fonctionnalités',
  'mise-a-jour': 'Mises à jour',
  annonce: 'Annonces',
  maintenance: 'Maintenance',
  compte: 'Comptes',
  connexion: 'Connexions',
  systeme: 'Système',
};

function libelleJour(date) {
  const jour = new Date(date);
  const aujourdhui = new Date();
  const hier = new Date();
  hier.setDate(aujourdhui.getDate() - 1);
  if (jour.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  if (jour.toDateString() === hier.toDateString()) return 'Hier';
  return jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Qui a fait quoi sur la plateforme, et quand : uniquement les actions des
// superadmins (jamais l'activité interne d'une école), regroupées par jour.
export default function Journal() {
  const [entrees, setEntrees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [categorie, setCategorie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/superadmin/journal')
      .then((res) => setEntrees(res.data.entrees))
      .catch((err) => setErreur(messageErreur(err, 'impossible de charger le journal')));
  }
  useEffect(charger, []);
  useActualisation(charger);

  const filtre = recherche.trim().toLowerCase();
  const affichees = (entrees || []).filter((e) => (!categorie || e.categorie === categorie)
    && (!filtre || e.libelle.toLowerCase().includes(filtre) || e.auteurNom.toLowerCase().includes(filtre)));

  const parJour = [];
  affichees.forEach((e) => {
    const libelle = libelleJour(e.createdAt);
    const groupe = parJour[parJour.length - 1];
    if (groupe && groupe.libelle === libelle) groupe.entrees.push(e);
    else parJour.push({ libelle, entrees: [e] });
  });

  async function vider() {
    const res = await client.delete('/superadmin/journal', { params: categorie ? { categorie } : {} });
    setConfirmation(false);
    const n = res.data.supprimees;
    setToast({ message: `${n} action${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''} du journal.`, type: 'succes' });
    charger();
  }
  const concernees = categorie ? (entrees || []).filter((e) => e.categorie === categorie) : (entrees || []);
  const aVider = concernees.length;
  // Il ne reste que la trace d'une purge précédente : rien à vider.
  const videDeja = concernees.every((e) => e.libelle.startsWith('Journal vidé'));

  const categoriesPresentes = Object.keys(CATEGORIES).filter((c) => (entrees || []).some((e) => e.categorie === c));

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Actions des superadmins</h2>
        <div className="entete-carte-actions">
          {entrees && <span className="entete-carte-compteur">{affichees.length} action{affichees.length > 1 ? 's' : ''}</span>}
          {aVider > 0 && !videDeja && (
            <button className="secondaire danger" onClick={() => setConfirmation(true)}>
              <IconTrash /> {categorie ? `Vider « ${CATEGORIES[categorie]} »` : 'Vider le journal'}
            </button>
          )}
        </div>
      </div>
      <p className="note-secondaire texte-aide">
        Chaque action sur la plateforme (écoles, modules, versions, annonces, maintenance, comptes superadmin,
        connexions) est enregistrée ici avec son auteur. L'activité interne des écoles n'y figure jamais.
      </p>

      <div className="barre-filtres">
        <div className="champ-recherche">
          <IconSearch width={15} height={15} />
          <input placeholder="Rechercher une action ou un auteur" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="filtres-puces" role="group" aria-label="Filtrer par catégorie">
          <button className={!categorie ? 'actif' : ''} onClick={() => setCategorie('')}>Tout</button>
          {categoriesPresentes.map((c) => (
            <button key={c} className={categorie === c ? 'actif' : ''} onClick={() => setCategorie(c)}>{CATEGORIES[c]}</button>
          ))}
        </div>
      </div>

      {erreur && <div className="message-erreur">{erreur}</div>}
      {!entrees && !erreur && <div className="chargement">Chargement…</div>}
      {entrees && affichees.length === 0 && (
        <div className="vide">{entrees.length === 0 ? 'Aucune action enregistrée pour le moment.' : 'Aucune action ne correspond à ce filtre.'}</div>
      )}

      {parJour.map((groupe) => (
        <section key={groupe.libelle} className="journal-jour">
          <h3>{groupe.libelle}</h3>
          <ol className="journal-liste">
            {groupe.entrees.map((e) => (
              <li key={e.id} className="journal-entree">
                <time className="journal-heure" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </time>
                <span className={`journal-pastille cat-${e.categorie}`} aria-hidden="true" />
                <div className="journal-texte">
                  <span>{e.libelle}</span>
                  <small>{e.auteurNom} · {CATEGORIES[e.categorie] || e.categorie}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {confirmation && (
        <ConfirmModal
          titre={categorie ? `Vider la catégorie « ${CATEGORIES[categorie]} » ?` : 'Vider tout le journal ?'}
          boutonConfirmer="Vider"
          onConfirmer={vider}
          onAnnuler={() => setConfirmation(false)}
        >
          {aVider} action{aVider > 1 ? 's' : ''} {aVider > 1 ? 'seront supprimées' : 'sera supprimée'} définitivement. Une seule
          ligne restera, indiquant qui a vidé le journal et quand.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
