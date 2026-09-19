import { Suspense, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconLogout, IconMenu, IconClose, IconSettings } from './icons';
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

  function choisirOnglet(id) {
    onChange(id);
    setMenuOuvert(false);
  }

  return (
    <div className="espace">
      <div className="entete-mobile">
        <button className="bouton-menu-mobile" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
          <IconMenu width={20} height={20} />
        </button>
        <span className="marque-pastille petite"><img src={logoIcon} alt="" /></span>
        <div className="avatar" title={`${profil?.prenom} ${profil?.nom}`}>{initiales(profil?.prenom, profil?.nom)}</div>
      </div>

      {menuOuvert && <div className="voile-menu-mobile" onClick={() => setMenuOuvert(false)} />}

      <aside className={`panneau-lateral ${menuOuvert ? 'ouvert' : ''}`}>
        <div className="marque-laterale">
          <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
          <div className="marque-texte">
            <strong>EduSphere</strong>
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
              <button
                key={o.id}
                className={`item-nav ${section?.id === o.id ? 'actif' : ''}`}
                onClick={() => choisirOnglet(o.id)}
              >
                {Icone && <Icone width={17} height={17} />}
                <span>{o.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="profil-lateral">
          <div className="avatar">{initiales(profil?.prenom, profil?.nom)}</div>
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

      <div className="espace-contenu">
        {avantContenu}
        {!bloquerContenu && (
          <>
            <div className="entete-page" key={section?.id}><h1>{section?.label}</h1></div>
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

      {compteOuvert && <ModaleMonCompte onFermer={() => setCompteOuvert(false)} />}
    </div>
  );
}
