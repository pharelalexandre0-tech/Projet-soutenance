import { useEffect, useState } from 'react';
import { IconChevronDown } from './icons';

// Un groupe (ex. les élèves d'une classe) replié par défaut : évite qu'une
// page avec beaucoup de classes s'étire en un tableau interminable — on
// déplie seulement celle qu'on veut consulter.
export default function GroupeDeroulant({ titre, compte, ouvertParDefaut = false, children }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  // Le groupe reste monté (même clé) pendant qu'on tape une recherche — sans
  // cet effet, un groupe déjà replié avant la recherche ne s'ouvrirait
  // jamais tout seul quand une correspondance apparaît dedans. On ne force
  // que l'ouverture, jamais la fermeture : un groupe que l'académie a
  // déplié à la main ne doit pas se refermer sous elle dès que la recherche
  // change ailleurs.
  useEffect(() => {
    if (ouvertParDefaut) setOuvert(true);
  }, [ouvertParDefaut]);

  return (
    <div className="groupe-deroulant">
      <button type="button" className="groupe-deroulant-entete" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <IconChevronDown width={16} height={16} style={{ transform: ouvert ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease', flex: 'none' }} />
        <span className="groupe-deroulant-titre">{titre}</span>
        {compte !== undefined && <span className="groupe-deroulant-compte">{compte}</span>}
      </button>
      {ouvert && <div className="groupe-deroulant-corps">{children}</div>}
    </div>
  );
}
