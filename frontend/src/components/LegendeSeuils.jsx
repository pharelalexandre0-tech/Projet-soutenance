import { noteFr } from '../utils/seuils';

// Légende des couleurs de saisie, avec le nombre de notes de chaque sorte.
export default function LegendeSeuils({ regles, comptes = null }) {
  const n = (cle) => (comptes ? <strong>{comptes[cle] || 0}</strong> : null);
  return (
    <div className="legende-seuils" aria-label="Couleurs des notes">
      <span className="legende-seuil bonne"><i />{n('bonne')} Validée : {noteFr(regles.seuil)} et plus</span>
      <span className="legende-seuil limite"><i />{n('limite')} Sous le seuil : de {noteFr(regles.eliminatoire)} à {noteFr(regles.seuil)}</span>
      <span className="legende-seuil eliminatoire"><i />{n('eliminatoire')} Éliminatoire : moins de {noteFr(regles.eliminatoire)}</span>
    </div>
  );
}
