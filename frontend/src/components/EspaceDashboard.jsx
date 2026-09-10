import { useAuth } from '../context/AuthContext';
import { IconLogout } from './icons';
import logoIcon from '../assets/logo-icon.png';

const LIBELLES_ROLE = {
  superadmin: 'Super-administrateur',
  academie: 'Espace Académie',
  finance: 'Espace Finance',
  parent: 'Espace Parents',
};

function initiales(prenom, nom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

export default function EspaceDashboard({ onglets, actif, onChange, avantContenu, bloquerContenu, children }) {
  const { profil, seDeconnecter } = useAuth();
  const section = onglets.find((o) => o.id === actif) || onglets[0];

  return (
    <div className="espace">
      <aside className="panneau-lateral">
        <div className="marque-laterale">
          <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
          <div className="marque-texte">
            <strong>EduSphere</strong>
            <small>{LIBELLES_ROLE[profil?.role] || 'Espace'}</small>
          </div>
        </div>

        <nav className="nav-laterale">
          {onglets.map((o) => {
            const Icone = o.icone;
            return (
              <button
                key={o.id}
                className={`item-nav ${section?.id === o.id ? 'actif' : ''}`}
                onClick={() => onChange(o.id)}
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
            {children}
          </>
        )}
      </div>
    </div>
  );
}
