import { useState } from 'react';
import { IconOeil, IconOeilBarre } from './icons';

// Saisie de mot de passe avec un bouton pour afficher ce qu'on tape : même
// comportement partout (connexion, profil, création de comptes...), plutôt
// que des boutons "Afficher/Masquer" différents d'un formulaire à l'autre.
// `visible` / `onBasculer` (facultatifs) : pour qu'un bouton "Générer" à
// côté puisse montrer tout de suite le mot de passe qu'il vient de créer.
export default function ChampMotDePasse({ className = '', visible: visibleImpose, onBasculer, ...props }) {
  const [visibleInterne, setVisibleInterne] = useState(false);
  const visible = visibleImpose ?? visibleInterne;
  return (
    <div className={`saisie-mdp ${className}`}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="saisie-mdp-bouton"
        onClick={() => (onBasculer ? onBasculer() : setVisibleInterne((v) => !v))}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? <IconOeilBarre /> : <IconOeil />}
      </button>
    </div>
  );
}
