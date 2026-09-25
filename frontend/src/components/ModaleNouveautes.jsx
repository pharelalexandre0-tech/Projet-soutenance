import Modal from './Modal';
import { TYPES_MISE_A_JOUR, dateCourte } from '../utils/plateforme';

// Notes de version publiées par le superadmin, vues depuis l'espace d'une
// école. S'ouvre toute seule à la connexion quand il y a du nouveau depuis
// la dernière visite, sinon depuis le bouton "Nouveautés" de la barre du
// haut.
export default function ModaleNouveautes({ nouveautes, onFermer }) {
  return (
    <Modal titre="Nouveautés d'EduSphere" onFermer={onFermer} largeur={560}>
      {nouveautes.length === 0 && <div className="vide">Aucune mise à jour publiée pour l'instant.</div>}
      <ol className="fil-versions">
        {nouveautes.map((n) => {
          const type = TYPES_MISE_A_JOUR[n.type] || TYPES_MISE_A_JOUR.nouveaute;
          return (
            <li key={n.id} className={`fil-version ${n.nonLue ? 'non-lue' : ''}`}>
              <div className="fil-version-meta">
                <span className="pastille-version">v{n.version}</span>
                <span className={`badge ${type.badge}`}>{type.libelle}</span>
                <span className="notification-date">{dateCourte(n.publieeLe)}</span>
                {n.nonLue && <span className="etiquette-nouveau">Nouveau</span>}
              </div>
              <h3 className="fil-version-titre">{n.titre}</h3>
              <p className="fil-version-texte">{n.contenu}</p>
            </li>
          );
        })}
      </ol>
      <div className="confirmation-actions" style={{ marginTop: 18 }}>
        <button className="primaire" onClick={onFermer}>J'ai compris</button>
      </div>
    </Modal>
  );
}
