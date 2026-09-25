import { IconeFonctionnalite, IconExternal } from './icons';

// Onglet d'une fonctionnalité personnalisée, créée par le superadmin et
// ajoutée à cette école : une page d'information, ou l'accès à un service
// en ligne (ouvert dans un nouvel onglet, jamais intégré dans la page).
export default function PageExtension({ extension }) {
  if (extension.type === 'lien') {
    let domaine = extension.url;
    try {
      domaine = new URL(extension.url).host;
    } catch {
      // Adresse déjà validée côté serveur : on garde le texte brut au pire.
    }
    return (
      <div className="carte">
        <div className="service-externe">
          <span className="tuile-fonctionnalite grande personnalisee"><IconeFonctionnalite nom={extension.icone} /></span>
          <div className="service-externe-textes">
            <strong>{extension.nom}</strong>
            <p>{extension.description}</p>
            <span className="mono">{domaine}</span>
          </div>
          <a className="bouton-primaire" href={extension.url} target="_blank" rel="noopener noreferrer">
            {extension.libelleBouton || 'Ouvrir le service'}
            <IconExternal />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="carte">
      <div className="page-extension-contenu">{extension.contenu}</div>
    </div>
  );
}
