import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  IconLogout, IconMenu, IconClose, IconSettings, IconSearch, IconBell, IconMegaphone, IconChevronRight,
  IconeFonctionnalite,
} from './icons';
import ModaleMonCompte from './ModaleMonCompte';
import ModaleNouveautes from './ModaleNouveautes';
import PaletteCommandes from './PaletteCommandes';
import PageExtension from './PageExtension';
import { PlateformeContext } from '../context/PlateformeContext';
import logoIcon from '../assets/logo-icon.png';

const LIBELLES_ROLE = {
  superadmin: 'Administration',
  academie: 'Espace Académie',
  finance: 'Espace Finance',
  etudiant: 'Espace Étudiant',
  parent: 'Espace Parents',
};

const DELAI_RAFRAICHISSEMENT_MS = 60 * 1000;
const CLE_ANNONCE_MASQUEE = 'edusphere_annonce_masquee';
const GROUPE_EXTENSIONS = "Services de l'établissement";

function initiales(prenom, nom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

function lireAnnonceMasquee() {
  try { return sessionStorage.getItem(CLE_ANNONCE_MASQUEE); } catch { return null; }
}

// Cadre commun aux cinq espaces : menu latéral groupé par thème, barre
// supérieure (fil d'Ariane, recherche Ctrl+K, nouveautés), puis la page
// avec son titre et sa description. Chaque DashboardX.jsx ne fournit que
// sa liste d'onglets (ONGLETS) et le contenu de l'onglet actif.
export default function EspaceDashboard({ onglets, actif, onChange, avantContenu, bloquerContenu, children }) {
  const { profil, seDeconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [paletteOuverte, setPaletteOuverte] = useState(false);

  // Logo/nom de l'établissement à la place de la marque EduSphere — jamais
  // pour le superadmin, qui n'appartient à aucune école.
  const [etablissement, setEtablissement] = useState(null);
  useEffect(() => {
    if (profil?.role && profil.role !== 'superadmin') {
      client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement)).catch(() => {});
    }
  }, [profil?.role]);
  const logoAffiche = etablissement?.logo || logoIcon;
  const nomAffiche = etablissement?.nom || 'EduSphere';

  // État de la plateforme vu depuis une école : fonctionnalités ajoutées
  // par le superadmin, annonce en cours, notes de version. Rafraîchi chaque
  // minute et au retour sur l'onglet.
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
        // Ouverture automatique une seule fois, à l'arrivée dans l'espace.
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

  // Fonctionnalités personnalisées de l'école : un onglet de plus chacune,
  // regroupées à la fin du menu.
  const ongletsExtensions = useMemo(() => (etatPlateforme?.extensions || []).map((e) => {
    function IconeExtension(props) {
      return <IconeFonctionnalite nom={e.icone} {...props} />;
    }
    return { id: `ext:${e.cle}`, label: e.nom, description: e.description, icone: IconeExtension, groupe: GROUPE_EXTENSIONS, extension: e };
  }), [etatPlateforme?.extensions]);

  // Un onglet rattaché à un module que l'école n'a pas disparaît du menu
  // (l'API le refuse de toute façon, voir exigerFonctionnalite côté serveur).
  const ongletsVisibles = useMemo(() => [
    ...(etatPlateforme
      ? onglets.filter((o) => !o.fonctionnalite || etatPlateforme.fonctionnalites[o.fonctionnalite] !== false)
      : onglets),
    ...ongletsExtensions,
  ], [onglets, etatPlateforme, ongletsExtensions]);

  const section = ongletsVisibles.find((o) => o.id === actif) || ongletsVisibles[0];

  useEffect(() => {
    if (section && section.id !== actif) onChange(section.id);
  }, [section, actif, onChange]);

  // Onglets consécutifs d'un même groupe -> une section titrée du menu.
  const groupes = useMemo(() => {
    const liste = [];
    ongletsVisibles.forEach((o) => {
      const dernier = liste[liste.length - 1];
      if (dernier && dernier.titre === (o.groupe || null)) dernier.onglets.push(o);
      else liste.push({ titre: o.groupe || null, onglets: [o] });
    });
    return liste;
  }, [ongletsVisibles]);

  useEffect(() => {
    function surTouche(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((o) => !o);
      }
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  function choisirOnglet(id) {
    onChange(id);
    setMenuOuvert(false);
    setPaletteOuverte(false);
    window.scrollTo({ top: 0 });
  }

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
    try { sessionStorage.setItem(CLE_ANNONCE_MASQUEE, annonce.publieeLe); } catch { /* stockage indisponible : masquée pour cette page seulement */ }
    setAnnonceMasquee(annonce.publieeLe);
  }
  const nonLues = etatPlateforme?.nonLues || 0;

  const boutonNouveautes = estEcole && (
    <button className="bouton-icone" onClick={() => setNouveautesOuvertes(true)} title="Nouveautés" aria-label={`Nouveautés${nonLues ? `, ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : ''}`}>
      <IconBell />
      {nonLues > 0 && <span className="pastille-compteur">{nonLues}</span>}
    </button>
  );

  return (
    <div className="espace">
      <header className="entete-mobile">
        <button className="bouton-icone" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu"><IconMenu /></button>
        <span className="marque-pastille"><img src={logoAffiche} alt="" /></span>
        <span className="entete-mobile-nom">{nomAffiche}</span>
        <button className="bouton-icone" onClick={() => setPaletteOuverte(true)} aria-label="Rechercher une page"><IconSearch /></button>
        {boutonNouveautes}
      </header>

      {menuOuvert && <div className="voile-menu-mobile" onClick={() => setMenuOuvert(false)} />}

      <aside className={`panneau-lateral ${menuOuvert ? 'ouvert' : ''}`} aria-label="Navigation principale">
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
          {groupes.map((g, i) => (
            <div className="nav-groupe" key={`${g.titre || 'principal'}-${i}`}>
              {g.titre && <div className="nav-groupe-titre">{g.titre}</div>}
              {g.onglets.map((o) => {
                const Icone = o.icone;
                const estActif = section?.id === o.id;
                return (
                  <button
                    key={o.id}
                    className={`item-nav ${estActif ? 'actif' : ''}`}
                    onClick={() => choisirOnglet(o.id)}
                    aria-current={estActif ? 'page' : undefined}
                  >
                    {Icone && <Icone />}
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="profil-lateral">
          <div className="avatar" aria-hidden="true">{initiales(profil?.prenom, profil?.nom)}</div>
          <div className="profil-info">
            <strong>{profil?.prenom} {profil?.nom}</strong>
            <small>{profil?.email}</small>
          </div>
          {profil?.role !== 'superadmin' && (
            <button className="bouton-parametres-compte" onClick={() => setCompteOuvert(true)} title="Mon compte" aria-label="Mon compte">
              <IconSettings width={17} height={17} />
            </button>
          )}
          <button className="bouton-deconnexion" onClick={seDeconnecter} title="Se déconnecter" aria-label="Se déconnecter">
            <IconLogout width={17} height={17} />
          </button>
        </div>
      </aside>

      <div className="colonne-principale">
        <header className="barre-superieure">
          <nav className="fil-ariane" aria-label="Fil d'Ariane">
            <span>{LIBELLES_ROLE[profil?.role] || 'Espace'}</span>
            {section?.groupe && <><IconChevronRight /><span>{section.groupe}</span></>}
            <IconChevronRight />
            <strong>{section?.label}</strong>
          </nav>
          <div className="barre-superieure-actions">
            <button className="bouton-recherche" onClick={() => setPaletteOuverte(true)}>
              <IconSearch />
              <span>Rechercher une page</span>
              <kbd>Ctrl K</kbd>
            </button>
            {boutonNouveautes}
          </div>
        </header>

        <main className="espace-contenu">
          <div className="espace-contenu-interieur" key={section?.id}>
            {annonceVisible && (
              <div className={`bandeau-annonce ${annonce.niveau === 'important' ? 'important' : ''}`} role="status">
                <span className="bandeau-annonce-icone"><IconMegaphone /></span>
                <div className="bandeau-annonce-texte">
                  <strong>{annonce.niveau === 'important' ? 'Annonce importante' : 'Annonce'} de l'équipe EduSphere</strong>
                  <p>{annonce.message}</p>
                </div>
                <button className="bandeau-annonce-fermer" onClick={masquerAnnonce} aria-label="Masquer l'annonce">
                  <IconClose width={15} height={15} />
                </button>
              </div>
            )}
            {avantContenu}
            {!bloquerContenu && (
              <>
                {!section?.masquerEntete && (
                  <div className="entete-page">
                    <div>
                      <h1>{section?.label}</h1>
                      {section?.description && <p className="entete-page-description">{section.description}</p>}
                    </div>
                  </div>
                )}
                <PlateformeContext.Provider value={etatPlateforme?.fonctionnalites || null}>
                  {/* Chaque onglet est chargé à la demande (lazy() dans chaque
                      DashboardX.jsx) : un seul repli ici, qui garde le menu
                      affiché pendant le chargement. */}
                  <Suspense fallback={<div className="chargement">Chargement…</div>}>
                    {section?.extension ? <PageExtension extension={section.extension} /> : children}
                  </Suspense>
                </PlateformeContext.Provider>
              </>
            )}
          </div>
        </main>
      </div>

      {paletteOuverte && (
        <PaletteCommandes onglets={ongletsVisibles} onChoisir={choisirOnglet} onFermer={() => setPaletteOuverte(false)} />
      )}
      {compteOuvert && <ModaleMonCompte onFermer={() => setCompteOuvert(false)} />}
      {nouveautesOuvertes && <ModaleNouveautes nouveautes={etatPlateforme?.nouveautes || []} onFermer={fermerNouveautes} />}
    </div>
  );
}
