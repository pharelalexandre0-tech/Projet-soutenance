import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import {
  IconLogout, IconSettings, IconSearch, IconBell, IconSparkles, IconChevronDown,
  IconeFonctionnalite,
} from './icons';
import ModaleMonCompte from './ModaleMonCompte';
import ModaleNouveautes from './ModaleNouveautes';
import TiroirNotifications from './TiroirNotifications';
import BandeauAnnonce from './BandeauAnnonce';
import PaletteCommandes from './PaletteCommandes';
import PageExtension from './PageExtension';
import { Avatar } from './ChampPhoto';
import Tissage from './Tissage';
import { PlateformeContext } from '../context/PlateformeContext';
import logoIcon from '../assets/logo-icon.png';

const LIBELLES_ROLE = {
  superadmin: 'Espace superadmin',
  academie: 'Espace Académie',
  finance: 'Espace Finance',
  etudiant: 'Espace Étudiant',
  ministere: 'Ministère, Enseignement supérieur',
};

// Le parent ouvre le compte étudiant de son enfant : même espace, présenté
// comme l'Espace Parents.
function libelleEspace(profil) {
  if (profil?.modeParent) return 'Espace Parents';
  return LIBELLES_ROLE[profil?.role] || 'Espace';
}

// Filet de sécurité : les changements arrivent en direct (flux
// d'événements) ; ce délai ne rattrape que ce qui expire tout seul (une
// annonce arrivée à échéance).
const DELAI_RAFRAICHISSEMENT_MS = 5 * 60 * 1000;
const CLE_ANNONCE_MASQUEE = 'edusphere_annonce_masquee';
const GROUPE_EXTENSIONS = "Services de l'établissement";

// Rubriques du dossier : chaque groupe du menu porte un numéro romain, et
// chaque page une cote (rubrique.page), reprise dans l'en-tête de la page.
const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

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
    if (profil?.role && !['superadmin', 'ministere'].includes(profil.role)) {
      client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement)).catch(() => {});
    }
  }, [profil?.role]);
  const logoAffiche = etablissement?.logo || logoIcon;
  // Une école sans logo affiche ses initiales, jamais le logo d'EduSphere.
  const ministere = profil?.role === 'ministere';
  const sansLogo = ministere || (profil?.role !== 'superadmin' && etablissement && !etablissement.logo);
  const initialesEcole = (() => {
    if (ministere) return 'MESR';
    const sigle = String(etablissement?.sigle || '').replace(/[^\p{L}\p{N}]/gu, '');
    if (sigle) return sigle.slice(0, 4).toUpperCase();
    const mots = String(etablissement?.nom || '').split(/[\s'’-]+/).filter((m) => m.length > 2 || /^[A-Z]/.test(m));
    return (mots.map((m) => m[0]).join('').slice(0, 3) || 'E').toUpperCase();
  })();
  const vignette = sansLogo
    ? <span className={`marque-initiales ${initialesEcole.length > 3 ? 'longues' : ''}`} aria-hidden="true">{initialesEcole}</span>
    : <img src={logoAffiche} alt="" />;
  const nomAffiche = ministere ? "Ministère de l'Enseignement supérieur" : (etablissement?.nom || 'EduSphere');

  // État de la plateforme vu depuis une école : fonctionnalités ajoutées
  // par le superadmin, annonce en cours, notes de version. Mis à jour en
  // direct à chaque changement, et au retour sur l'onglet.
  const estEcole = Boolean(profil?.role) && !['superadmin', 'ministere'].includes(profil.role);
  const [etatPlateforme, setEtatPlateforme] = useState(null);
  const [nouveautesOuvertes, setNouveautesOuvertes] = useState(false);
  const [annonceMasquee, setAnnonceMasquee] = useState(lireAnnonceMasquee);
  const premierChargement = useRef(true);

  const chargerEtat = useCallback(() => {
    if (!estEcole) return;
    client.get('/plateforme/etat').then((res) => {
      setEtatPlateforme(res.data);
      // Ouverture automatique une seule fois, à l'arrivée dans l'espace.
      if (premierChargement.current && res.data.nonLues > 0) setNouveautesOuvertes(true);
      premierChargement.current = false;
    }).catch(() => {});
  }, [estEcole]);

  // Notifications du compte (absence signalée, paiement reçu, alerte...).
  const [notifications, setNotifications] = useState(null);
  const [notificationsOuvertes, setNotificationsOuvertes] = useState(false);
  const chargerNotifications = useCallback(() => {
    if (!estEcole) return;
    client.get('/notifications').then((res) => setNotifications(res.data)).catch(() => {});
  }, [estEcole]);

  useEffect(() => {
    chargerEtat();
    chargerNotifications();
    const minuteur = setInterval(chargerEtat, DELAI_RAFRAICHISSEMENT_MS);
    window.addEventListener('focus', chargerEtat);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener('focus', chargerEtat);
    };
  }, [chargerEtat, chargerNotifications]);
  useActualisation(() => { chargerEtat(); chargerNotifications(); }, { plateforme: true });

  function fermerNotifications() {
    setNotificationsOuvertes(false);
    if (notifications?.nonLues > 0) {
      client.put('/notifications/lues').catch(() => {});
      setNotifications((n) => ({ nonLues: 0, notifications: n.notifications.map((x) => ({ ...x, lu: true })) }));
    }
  }

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

  // Onglets consécutifs d'un même groupe -> une section titrée du menu,
  // numérotée comme une rubrique de dossier.
  const groupes = useMemo(() => {
    const liste = [];
    ongletsVisibles.forEach((o) => {
      const dernier = liste[liste.length - 1];
      if (dernier && dernier.titre === (o.groupe || null)) dernier.onglets.push(o);
      else liste.push({ titre: o.groupe || null, onglets: [o] });
    });
    let rang = 0;
    liste.forEach((g) => { if (g.titre) { g.numero = ROMAINS[rang] || String(rang + 1); rang += 1; } });
    return liste;
  }, [ongletsVisibles]);

  // Cote de la page affichée : « II.3 » = 3e page de la rubrique II.
  const cote = useMemo(() => {
    const groupe = groupes.find((g) => g.onglets.some((o) => o.id === section?.id));
    if (!groupe?.numero) return null;
    return `${groupe.numero}.${groupe.onglets.findIndex((o) => o.id === section?.id) + 1}`;
  }, [groupes, section?.id]);
  const sigleCote = (ministere ? 'MESR' : etablissement?.sigle || 'ES').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6).toUpperCase();
  const consulteLe = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

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
  const notificationsNonLues = notifications?.nonLues || 0;

  const boutonNouveautes = estEcole && (
    <>
      <button
        className="bouton-icone" onClick={() => setNotificationsOuvertes(true)} title="Notifications"
        aria-label={`Notifications${notificationsNonLues ? `, ${notificationsNonLues} non lue${notificationsNonLues > 1 ? 's' : ''}` : ''}`}
      >
        <IconBell />
        {notificationsNonLues > 0 && <span className="pastille-compteur">{notificationsNonLues > 99 ? '99+' : notificationsNonLues}</span>}
      </button>
      <button className="bouton-icone" onClick={() => setNouveautesOuvertes(true)} title="Nouveautés" aria-label={`Nouveautés${nonLues ? `, ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : ''}`}>
        <IconSparkles />
        {nonLues > 0 && <span className="pastille-compteur">{nonLues}</span>}
      </button>
    </>
  );

  // Rubrique (onglet de classeur) de la page affichée, et ses intercalaires.
  const groupeActif = groupes.find((g) => g.onglets.some((o) => o.id === section?.id)) || groupes[0];

  return (
    <div className="espace classeur">
      <header className="bandeau-classeur">
        {/* Motif tissé d'EduSphere, en fond de l'en-tête, estompé vers la gauche. */}
        <div className="bandeau-motif" aria-hidden="true"><Tissage colonnes={30} lignes={4} /></div>
        <div className="bandeau-haut">
          <div className="classeur-marque">
            <span className="marque-pastille">{vignette}</span>
            <div className="marque-texte">
              <strong>{nomAffiche}</strong>
              <small>{libelleEspace(profil)}</small>
            </div>
          </div>
          <div className="bandeau-actions">
            <button className="bouton-recherche" onClick={() => setPaletteOuverte(true)} aria-label="Rechercher une page">
              <IconSearch />
              <span>Rechercher une page</span>
              <kbd>Ctrl K</kbd>
            </button>
            {boutonNouveautes}
            <MenuCompte
              profil={profil}
              onMonCompte={() => (profil?.role === 'superadmin' ? onChange('profil') : setCompteOuvert(true))}
              onDeconnexion={seDeconnecter}
            />
          </div>
        </div>
        {/* Rubriques : un onglet de classeur par groupe de pages. */}
        <nav className="onglets-classeur" aria-label="Rubriques">
          {groupes.map((g, i) => {
            const actifGroupe = g === groupeActif;
            const IconeGroupe = g.onglets[0]?.icone;
            return (
              <button
                key={`${g.titre || 'accueil'}-${i}`}
                type="button"
                className={`onglet-classeur ${actifGroupe ? 'actif' : ''}`}
                aria-current={actifGroupe ? 'true' : undefined}
                onClick={() => choisirOnglet(actifGroupe ? section.id : g.onglets[0].id)}
              >
                {g.numero ? <span className="onglet-numero">{g.numero}</span> : IconeGroupe && <IconeGroupe />}
                <span>{g.titre || 'Accueil'}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="classeur-corps">
        {/* Intercalaires : les pages de la rubrique ouverte. */}
        {groupeActif && groupeActif.onglets.length > 1 && (
          <nav className="intercalaires" aria-label={`Pages de la rubrique ${groupeActif.titre || 'Accueil'}`}>
            {groupeActif.onglets.map((o, j) => {
              const Icone = o.icone;
              const estActif = section?.id === o.id;
              return (
                <button key={o.id} type="button" className={`intercalaire ${estActif ? 'actif' : ''}`} aria-current={estActif ? 'page' : undefined} onClick={() => choisirOnglet(o.id)}>
                  <span className="intercalaire-cote">{groupeActif.numero ? `${groupeActif.numero}.${j + 1}` : j + 1}</span>
                  {Icone && <Icone />}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <main className="espace-contenu feuille-classeur">
          <div className="espace-contenu-interieur" key={section?.id}>
            {annonceVisible && (
              <BandeauAnnonce niveau={annonce.niveau} message={annonce.message} publieeLe={annonce.publieeLe} onMasquer={masquerAnnonce} />
            )}
            {avantContenu}
            {!bloquerContenu && (
              <>
                {!section?.masquerEntete && (
                  <header className="cartouche">
                    <div className="cartouche-corps entete-page">
                      <div className="cartouche-titre">
                        <span className="cartouche-rubrique">{cote ? `Rubrique ${cote}` : 'Accueil'}{section?.groupe ? ` · ${section.groupe}` : ''}</span>
                        <h1>{section?.label}</h1>
                        {section?.description && <p className="entete-page-description">{section.description}</p>}
                      </div>
                      <dl className="cartouche-meta">
                        <div><dt>Cote</dt><dd>{sigleCote}{cote ? `-${cote}` : ''}</dd></div>
                        <div><dt>Consulté le</dt><dd>{consulteLe}</dd></div>
                      </dl>
                    </div>
                  </header>
                )}
                <PlateformeContext.Provider value={etatPlateforme?.fonctionnalites || null}>
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
      {notificationsOuvertes && <TiroirNotifications notifications={notifications?.notifications || []} onFermer={fermerNotifications} />}
    </div>
  );
}

// Compte connecté dans l'en-tête : un bouton sobre (initiales et prénom)
// qui ouvre un petit menu avec l'identité complète et les actions.
function MenuCompte({ profil, onMonCompte, onDeconnexion }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', fermer); document.removeEventListener('keydown', echap); };
  }, [ouvert]);
  const nom = profil?.modeParent ? `Parent de ${profil.prenom}` : `${profil?.prenom ?? ''} ${profil?.nom ?? ''}`.trim();
  const email = profil?.modeParent ? profil.emailParent : profil?.email;
  return (
    <div className="menu-compte" ref={zone}>
      <button type="button" className="menu-compte-bouton" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <Avatar profil={profil} className="menu-compte-avatar" />
        <span className="menu-compte-prenom">{profil?.modeParent ? 'Parent' : profil?.prenom}</span>
        <IconChevronDown aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="menu-compte-panneau" role="menu">
          <div className="menu-compte-identite">
            <Avatar profil={profil} className="menu-compte-avatar grand" />
            <span><strong>{nom}</strong><small>{email}</small></span>
          </div>
          <button type="button" role="menuitem" onClick={() => { setOuvert(false); onMonCompte(); }}>
            <IconSettings aria-hidden="true" /> {profil?.role === 'superadmin' ? 'Mon profil' : 'Mon compte'}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={onDeconnexion}>
            <IconLogout aria-hidden="true" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
