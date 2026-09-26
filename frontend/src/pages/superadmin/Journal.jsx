import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';
import { IconSearch } from '../../components/icons';

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

  const categoriesPresentes = Object.keys(CATEGORIES).filter((c) => (entrees || []).some((e) => e.categorie === c));

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Actions des superadmins</h2>
        {entrees && <span className="entete-carte-compteur">{affichees.length} action{affichees.length > 1 ? 's' : ''}</span>}
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
    </div>
  );
}
