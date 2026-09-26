import Tiroir from './Tiroir';
import { IconBell } from './icons';
import { dateHeure, depuis } from '../utils/plateforme';

// Notifications du compte, les plus récentes d'abord. Celles qui n'avaient
// pas encore été vues sont signalées ; elles passent en « lues » à la
// fermeture du panneau.
export default function TiroirNotifications({ notifications, onFermer }) {
  const nonLues = notifications.filter((n) => !n.lu).length;
  return (
    <Tiroir
      titre="Notifications"
      sousTitre={nonLues ? `${nonLues} nouvelle${nonLues > 1 ? 's' : ''}` : 'Tout est lu'}
      icone={<span className="puce-icone"><IconBell /></span>}
      onFermer={onFermer}
    >
      {notifications.length === 0 ? (
        <div className="vide">Aucune notification pour le moment.</div>
      ) : (
        <ul className="notifications-compte">
          {notifications.map((n) => (
            <li key={n.id} className={n.lu ? '' : 'non-lue'}>
              <span className="notifications-compte-point" aria-hidden="true" />
              <div>
                <p>{n.contenu}</p>
                <time dateTime={n.dateEnvoi} title={dateHeure(n.dateEnvoi)}>{depuis(n.dateEnvoi)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tiroir>
  );
}
