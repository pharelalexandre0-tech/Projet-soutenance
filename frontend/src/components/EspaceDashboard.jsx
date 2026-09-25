import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { IconLogout, IconMenu, IconClose, IconSettings, IconSearch, IconSparkles, IconMegaphone } from './icons';
import ModaleMonCompte from './ModaleMonCompte';
import ModaleNouveautes from './ModaleNouveautes';
import { PlateformeContext } from '../context/PlateformeContext';
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

const DELAI_RAFRAICHISSEMENT_MS = 60 * 1000;
const CLE_ANNONCE_MASQUEE = 'edusphere_annonce_masquee';

function lireAnnonceMasquee() {
  try { return sessionStorage.getItem(CLE_ANNONCE_MASQUEE); } catch { return null; }
}

export default function EspaceDashboard({ onglets, actif, onChange, avantContenu, bloquerContenu, children }) {
  const { profil, seDeconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // État de la plateforme vu depuis une école : modules ouverts par le
  // superadmin, annonce en cours, notes de version. Rafraîchi chaque minute
  // et au retour sur l'onglet, pour qu'un module coupé, une annonce ou une
  // maintenance se voient sans devoir recharger la page.
  const estEcole = Boolean(profil?.role) && profil.role !== 'superadmin';
  const [etatPlateforme, setEtatPlateforme] = useState(null);
  const [nouveautesOuvertes, setNouveautesOuvertes] = useState(false);
  const [annonceMasquee, setAnnonceMasquee] = useState(lireAnnonceMasquee);

  useEffect(() => {
    if (!estEcole) return undefined;
    let premierChargement = true;
    function charger() {
      client.get('/plateforme/etat').then((res) => {
        setEtatPlateforme(res.data);
        // Ouverture automatique une seule fois, à l'arrivée dans l'espace :
        // pas au milieu d'une saisie parce qu'une note vient d'être publiée.
        if (premierChargement && res.data.nonLues > 0) setNouveautesOuvertes(true);
        premierChargement = false;
      }).catch(() => {});
    }
    charger();
    const minuteur = setInterval(charger, DELAI_RAFRAICHISSEMENT_MS);
    window.addEventListener('focus', charger);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener('focus', charger);
    };
  }, [estEcole]);

  // Un onglet rattaché à un module fermé pour cette école disparaît du menu
  // (l'API le refuse de toute façon, voir exigerFonctionnalite côté backend).
  const ongletsVisibles = etatPlateforme
    ? onglets.filter((o) => !o.fonctionnalite || etatPlateforme.fonctionnalites[o.fonctionnalite] !== false)
    : onglets;
  const section = ongletsVisibles.find((o) => o.id === actif) || ongletsVisibles[0];

  useEffect(() => {
    if (section && section.id !== actif) onChange(section.id);
  }, [section, actif, onChange]);

  function fermerNouveautes() {
    setNouveautesOuvertes(false);
    if (etatPlateforme?.nonLues > 0) {
      client.put('/plateforme/nouveautes/vues').catch(() => {});
      setEtatPlateforme((e) => ({ ...e, nonLues: 0, nouveautes: e.nouveautes.map((n) => ({ ...n, nonLue: false })) }));
    }
  }

  const annonce = etatPlateforme?.annonce;
  const annonceVisible = annonce && annonceMasquee !== annonce.publieeLe;
  function masquerAnnonce() {
    try { sessionStorage.setItem(CLE_ANNONCE_MASQUEE, annonce.publieeLe); } catch { /* stockage indisponible : masqué pour cette page seulement */ }
    setAnnonceMasquee(annonce.publieeLe);
  }
  const nonLues = etatPlateforme?.nonLues || 0;
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
    ? ongletsVisibles.filter((o) => o.label.toLowerCase().includes(rechercheNettoyee))
    : ongletsVisibles;

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
        {estEcole && (
          <button className="bouton-nouveautes-mobile" onClick={() => setNouveautesOuvertes(true)} aria-label="Nouveautés">
            <IconSparkles width={18} height={18} />
            {nonLues > 0 && <span className="bouton-nouveautes-compte">{nonLues}</span>}
          </button>
        )}
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
          {ongletsVisibles.map((o) => {
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
          {estEcole && (
            <button className="bouton-nouveautes" onClick={() => setNouveautesOuvertes(true)}>
              <IconSparkles width={15} height={15} />
              Nouveautés
              {nonLues > 0 && <span className="bouton-nouveautes-compte">{nonLues}</span>}
            </button>
          )}
          <span className="barre-superieure-date">{dateAffichee}</span>
        </div>

        <div className="espace-contenu">
          {annonceVisible && (
            <div className={`bandeau-annonce ${annonce.niveau === 'important' ? 'important' : ''}`} role="status">
              <span className="bandeau-annonce-icone"><IconMegaphone width={18} height={18} /></span>
              <div className="bandeau-annonce-texte">
                <strong>{annonce.niveau === 'important' ? 'Annonce importante' : 'Annonce'} de l'équipe EduSphere</strong>
                <p>{annonce.message}</p>
              </div>
              <button className="bandeau-annonce-fermer" onClick={masquerAnnonce} aria-label="Masquer l'annonce">
                <IconClose width={14} height={14} />
              </button>
            </div>
          )}
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
              <PlateformeContext.Provider value={etatPlateforme?.fonctionnalites || null}>
                <Suspense fallback={<div className="chargement">Chargement…</div>}>{children}</Suspense>
              </PlateformeContext.Provider>
            </>
          )}
        </div>
      </div>

      {compteOuvert && <ModaleMonCompte onFermer={() => setCompteOuvert(false)} />}
      {nouveautesOuvertes && <ModaleNouveautes nouveautes={etatPlateforme?.nouveautes || []} onFermer={fermerNouveautes} />}
    </div>
  );
}
