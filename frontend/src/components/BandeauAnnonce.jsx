import { IconMegaphone, IconClose, IconAlertTriangle } from './icons';

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Annonce de l'équipe EduSphere en tête de chaque espace (et son aperçu côté
// superadmin) : carte en dégradé aux couleurs de la plateforme, pastille du
// niveau, date de publication, bouton pour la masquer.
export default function BandeauAnnonce({ niveau, message, publieeLe, onMasquer, apercu = false }) {
  const important = niveau === 'important';
  const Icone = important ? IconAlertTriangle : IconMegaphone;
  return (
    <div className={`bandeau-annonce ${important ? 'important' : ''}`} role={apercu ? undefined : 'status'} aria-hidden={apercu || undefined}>
      <span className="bandeau-annonce-icone"><Icone /></span>
      <div className="bandeau-annonce-texte">
        <div className="bandeau-annonce-meta">
          <span className="bandeau-annonce-niveau">{important ? 'Important' : 'Annonce'}</span>
          <span>Équipe EduSphere{publieeLe ? ` · ${dateCourte(publieeLe)}` : ''}</span>
        </div>
        <p>{message}</p>
      </div>
      {onMasquer ? (
        <button type="button" className="bandeau-annonce-fermer" onClick={onMasquer} aria-label="Masquer l'annonce"><IconClose /></button>
      ) : (
        <span className="bandeau-annonce-fermer"><IconClose /></span>
      )}
    </div>
  );
}
