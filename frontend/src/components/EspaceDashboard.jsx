import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { IconLogout, IconMenu, IconClose, IconSettings, IconSearch } from './icons';
import ModaleMonCompte from './ModaleMonCompte';
import logoIcon from '../assets/logo-icon.png';

const LIBELLES_ROLE = {
  superadmin: 'Super-administrateur',
  academie: 'Espace Académie',
  finance: 'Espace Finance',
  etudiant: 'Espace Étudiant',
  parent: 'Espace Parents',
};

function initiales(prenom, nom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

export default function EspaceDashboard({ onglets, actif, onChange, avantContenu, bloquerContenu, children }) {
  const { profil, seDeconnecter } = useAuth();
  const section = onglets.find((o) => o.id === actif) || onglets[0];
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Le superadmin a déjà son propre onglet "Mon profil" dédié — pas besoin
  // de ce second accès qui ferait doublon pour lui seul.
  const [compteOuvert, setCompteOuvert] = useState(false);
  // Logo/nom de l'établissement dans la marque latérale, à la place de la
  // marque EduSphere — jamais pour le Superadmin, qui n'appartient à aucun
  // établissement en particulier (etablissementId est null pour ce rôle).
  const [etablissement, setEtablissement] = useState(null);
  useEffect(() => {
    if (profil?.role && profil.role !== 'superadmin') {
      client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement)).catch(() => {});
    }
  }, [profil?.role]);
  const logoAffiche = etablissement?.logo || logoIcon;
  const nomAffiche = etablissement?.nom || 'EduSphere';

  // Rail réduit aux icônes sur desktop (le libellé n'apparaît qu'en info-bulle
  // au survol) : la recherche devient le moyen principal de sauter d'une page
  // à l'autre sans tout dérouler visuellement — d'où le raccourci ⌘K/Ctrl+K.
  const [recherche, setRecherche] = useState('');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const rechercheRef = useRef(null);

  useEffect(() => {
    function surTouche(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        rechercheRef.current?.focus();
        rechercheRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === rechercheRef.current) {
        rechercheRef.current?.blur();
      }
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  function choisirOnglet(id) {
    onChange(id);
    setMenuOuvert(false);
    setRechercheOuverte(false);
    setRecherche('');
  }

  const rechercheNettoyee = recherche.trim().toLowerCase();
  const resultatsRecherche = rechercheNettoyee
    ? onglets.filter((o) => o.label.toLowerCase().includes(rechercheNettoyee))
    : onglets;

  function soumettreRecherche(e) {
    e.preventDefault();
    if (resultatsRecherche.length > 0) choisirOnglet(resultatsRecherche[0].id);
  }

  const dateAffichee = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="espace">
      <div className="entete-mobile">
        <button className="bouton-menu-mobile" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
          <IconMenu width={20} height={20} />
        </button>
        <span className="marque-pastille petite"><img src={logoAffiche} alt="" /></span>
        <div className="avatar" title={`${profil?.prenom} ${profil?.nom}`}>{initiales(profil?.prenom, profil?.nom)}</div>
      </div>

      {menuOuvert && <div className="voile-menu-mobile" onClick={() => setMenuOuvert(false)} />}

      <aside className={`panneau-lateral ${menuOuvert ? 'ouvert' : ''}`}>
        <div className="marque-laterale">
          <span className="marque-pastille"><img src={logoAffiche} alt="" /></span>
          <div className="marque-texte">
            <strong>{nomAffiche}</strong>
            <small>{LIBELLES_ROLE[profil?.role] || 'Espace'}</small>
          </div>
          <button className="bouton-fermer-menu" onClick={() => setMenuOuvert(false)} aria-label="Fermer le menu">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <nav className="nav-laterale">
          {onglets.map((o) => {
            const Icone = o.icone;
            return (
              <Fragment key={o.id}>
                {o.separateurAvant && <div className="nav-separateur" />}
                <button
                  className={`item-nav ${section?.id === o.id ? 'actif' : ''}`}
                  onClick={() => choisirOnglet(o.id)}
                  title={o.label}
                  aria-label={o.label}
                >
                  {Icone && <Icone width={17} height={17} />}
                  <span>{o.label}</span>
                </button>
              </Fragment>
            );
          })}
        </nav>

        <div className="profil-lateral">
          <div className="avatar" title={`${profil?.prenom} ${profil?.nom}`}>{initiales(profil?.prenom, profil?.nom)}</div>
          <div className="profil-info">
            <strong>{profil?.prenom} {profil?.nom}</strong>
            <small>{profil?.email}</small>
          </div>
          {profil?.role !== 'superadmin' && (
            <button className="bouton-parametres-compte" onClick={() => setCompteOuvert(true)} title="Mon compte" aria-label="Mon compte">
              <IconSettings width={16} height={16} />
            </button>
          )}
          <button className="bouton-deconnexion" onClick={seDeconnecter} title="Déconnexion" aria-label="Déconnexion">
            <IconLogout width={16} height={16} />
          </button>
        </div>
      </aside>

      <div className="colonne-principale">
        <div className="barre-superieure">
          <span className="barre-superieure-etablissement">{nomAffiche}</span>
          <form className="barre-recherche" onSubmit={soumettreRecherche}>
            <div className="barre-recherche-boite">
              <IconSearch width={16} height={16} />
              <input
                ref={rechercheRef}
                type="text"
                placeholder="Rechercher une page…"
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setRechercheOuverte(true); }}
                onFocus={() => setRechercheOuverte(true)}
                onBlur={() => setRechercheOuverte(false)}
              />
              <span className="barre-recherche-raccourci">⌘K</span>
            </div>
            {rechercheOuverte && (
              <div className="barre-recherche-resultats">
                {resultatsRecherche.length === 0 && <div className="barre-recherche-vide">Aucune page trouvée</div>}
                {resultatsRecherche.map((o) => {
                  const Icone = o.icone;
                  return (
                    // onMouseDown (pas onClick) : se déclenche avant le onBlur de l'input,
                    // qui sinon referme la liste avant que le clic n'atteigne le bouton.
                    <button type="button" key={o.id} onMouseDown={() => choisirOnglet(o.id)}>
                      {Icone && <Icone width={15} height={15} />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          </form>
          <span className="barre-superieure-date">{dateAffichee}</span>
        </div>

        <div className="espace-contenu">
          {avantContenu}
          {!bloquerContenu && (
            <>
              {/* Les pages qui construisent leur propre en-tête (masquerEntete)
                  n'ont pas besoin de ce titre générique en double. */}
              {!section?.masquerEntete && <div className="entete-page" key={section?.id}><h1>{section?.label}</h1></div>}
              {/* Chaque onglet est chargé à la demande (voir les ONGLETS de
                  chaque DashboardX.jsx, en lazy()) — un seul repli ici plutôt
                  que dans chacun des 5 tableaux de bord, pour que cliquer un
                  onglet affiche "Chargement…" à la place du contenu sans faire
                  disparaître la barre latérale (contrairement au Suspense
                  global d'App.jsx, qui remplacerait toute la page). */}
              <Suspense fallback={<div className="chargement">Chargement…</div>}>{children}</Suspense>
            </>
          )}
        </div>
      </div>

      {compteOuvert && <ModaleMonCompte onFermer={() => setCompteOuvert(false)} />}
    </div>
  );
}
