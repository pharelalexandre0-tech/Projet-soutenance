// Reprend le nuage de petits carrés du logo (visible en haut à droite du
// sceau) comme motif de marque réutilisable, plutôt que de laisser ce
// détail enfermé dans l'image du logo — une vraie signature EduSphere,
// pas une icône générique de bibliothèque de composants.
export default function MotifPoints({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="4" width="14" height="14" rx="3" fill="var(--edu-marine)" />
      <rect x="22" y="0" width="10" height="10" rx="2.5" fill="var(--edu-bleu)" />
      <rect x="40" y="14" width="16" height="16" rx="3" fill="var(--edu-or)" opacity="0.9" />
      <rect x="8" y="30" width="11" height="11" rx="2.5" fill="var(--edu-vert)" opacity="0.85" />
      <rect x="66" y="4" width="9" height="9" rx="2" fill="var(--edu-bleu)" opacity="0.7" />
      <rect x="34" y="46" width="13" height="13" rx="3" fill="var(--edu-marine)" opacity="0.6" />
      <rect x="60" y="32" width="10" height="10" rx="2.5" fill="var(--edu-or)" opacity="0.6" />
      <rect x="0" y="58" width="9" height="9" rx="2" fill="var(--edu-vert)" opacity="0.5" />
      <rect x="82" y="18" width="12" height="12" rx="2.5" fill="var(--edu-marine)" opacity="0.4" />
    </svg>
  );
}
