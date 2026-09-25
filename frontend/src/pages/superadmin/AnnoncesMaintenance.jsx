import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { dateHeure, depuis, versIso, versLocale } from '../../utils/plateforme';
import { IconMegaphone, IconWrench, IconClose } from '../../components/icons';

const MESSAGE_MAINTENANCE_DEFAUT = 'Mise à jour de la plateforme en cours.';

// Les deux façons de s'adresser à toute la plateforme d'un coup : un
// bandeau d'information en haut de chaque espace, et la mise en
// maintenance (accès suspendu pour tous sauf les superadmins).
export default function AnnoncesMaintenance() {
  const [diffusion, setDiffusion] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/superadmin/diffusion').then((res) => setDiffusion(res.data)).catch(() => {});
  }, []);

  if (!diffusion) return <div className="chargement">Chargement…</div>;

  function surMiseAJour(donnees, message, type = 'succes') {
    setDiffusion(donnees);
    setToast({ message, type });
  }

  return (
    <>
      <div className="grille-2 grille-diffusion">
        <CarteAnnonce annonce={diffusion.annonce} onMiseAJour={surMiseAJour} />
        <CarteMaintenance maintenance={diffusion.maintenance} onMiseAJour={surMiseAJour} />
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function CarteAnnonce({ annonce, onMiseAJour }) {
  const [message, setMessage] = useState(annonce.message || '');
  const [niveau, setNiveau] = useState(annonce.niveau || 'info');
  const [expireLe, setExpireLe] = useState(annonce.actif ? versLocale(annonce.expireLe) : '');
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState('');

  const statut = annonce.actif
    ? { badge: 'vert', texte: 'En ligne' }
    : annonce.expiree ? { badge: 'or', texte: 'Retirée automatiquement' } : { badge: 'gris', texte: 'Aucune annonce' };

  async function publier(e) {
    e.preventDefault();
    setErreur('');
    setEnCours('publier');
    try {
      const res = await client.put('/superadmin/annonce', { message, niveau, expireLe: versIso(expireLe) });
      onMiseAJour(res.data, annonce.actif ? 'Annonce mise à jour dans tous les espaces.' : 'Annonce publiée dans tous les espaces.');
    } catch (err) {
      setErreur(messageErreur(err, "impossible de publier l'annonce"));
    } finally {
      setEnCours(null);
    }
  }

  async function retirer() {
    setErreur('');
    setEnCours('retirer');
    try {
      const res = await client.delete('/superadmin/annonce');
      onMiseAJour(res.data, 'Annonce retirée.');
    } catch (err) {
      setErreur(messageErreur(err, "impossible de retirer l'annonce"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Annonce aux écoles</h2>
        <span className={`badge ${statut.badge}`}>{statut.texte}</span>
      </div>
      <p className="note-secondaire texte-aide">
        Un bandeau en haut de chaque espace (Académie, Finance, Étudiants, Parents), jusqu'à ce que tu le retires
        ou jusqu'à la date choisie. Chacun peut le masquer pour sa session.
      </p>
      {annonce.actif && annonce.publieeLe && (
        <p className="note-secondaire" style={{ margin: '-8px 0 16px', fontSize: '0.8rem' }}>
          En ligne depuis le {dateHeure(annonce.publieeLe)}{annonce.auteur ? `, par ${annonce.auteur}` : ''}
          {annonce.expireLe ? `. Retrait prévu le ${dateHeure(annonce.expireLe)}.` : '.'}
        </p>
      )}

      <form className="formulaire" onSubmit={publier}>
        <div className="champ">
          <label>Message ({message.length}/300)</label>
          <textarea
            rows={3}
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. Les bulletins du premier semestre sont disponibles depuis ce matin."
            required
          />
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label>Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
              <option value="info">Information</option>
              <option value="important">Important</option>
            </select>
          </div>
          <div className="champ">
            <label>Retrait automatique (facultatif)</label>
            <input type="datetime-local" value={expireLe} onChange={(e) => setExpireLe(e.target.value)} />
          </div>
        </div>

        <div className="apercu-bloc">
          <span className="apercu-libelle">Aperçu</span>
          <div className={`bandeau-annonce ${niveau === 'important' ? 'important' : ''}`} aria-hidden="true">
            <span className="bandeau-annonce-icone"><IconMegaphone width={18} height={18} /></span>
            <div className="bandeau-annonce-texte">
              <strong>{niveau === 'important' ? 'Annonce importante' : 'Annonce'} de l'équipe EduSphere</strong>
              <p>{message || 'Ton message apparaîtra ici.'}</p>
            </div>
            <span className="bandeau-annonce-fermer"><IconClose width={14} height={14} /></span>
          </div>
        </div>

        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="actions-carte">
          <button type="submit" className="primaire" disabled={Boolean(enCours) || !message.trim()}>
            {enCours === 'publier' ? 'Publication…' : annonce.actif ? "Mettre à jour l'annonce" : "Publier l'annonce"}
          </button>
          {annonce.actif && (
            <button type="button" className="secondaire danger" onClick={retirer} disabled={Boolean(enCours)}>
              {enCours === 'retirer' ? 'Retrait…' : "Retirer l'annonce"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function CarteMaintenance({ maintenance, onMiseAJour }) {
  const [message, setMessage] = useState(maintenance.message || MESSAGE_MAINTENANCE_DEFAUT);
  const [finPrevue, setFinPrevue] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function activer() {
    const res = await client.put('/superadmin/maintenance', { actif: true, message, finPrevue: versIso(finPrevue) });
    setConfirmation(false);
    onMiseAJour(res.data, 'Maintenance activée : seuls les superadmins ont encore accès.');
  }

  async function terminer() {
    setErreur('');
    setEnCours(true);
    try {
      const res = await client.put('/superadmin/maintenance', { actif: false, message });
      setFinPrevue('');
      onMiseAJour(res.data, 'Maintenance terminée : la plateforme est rouverte à tous.');
    } catch (err) {
      setErreur(messageErreur(err, 'impossible de terminer la maintenance'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`carte carte-maintenance ${maintenance.actif ? 'active' : ''}`}>
      <div className="entete-carte">
        <h2>Mode maintenance</h2>
        <span className={`badge ${maintenance.actif ? 'rouge' : 'vert'}`}>
          {maintenance.actif ? 'Maintenance en cours' : 'Plateforme ouverte'}
        </span>
      </div>

      {maintenance.actif ? (
        <div className="etat-maintenance">
          <span className="puce-icone"><IconWrench width={18} height={18} /></span>
          <div>
            <strong>Accès suspendu {maintenance.depuis ? depuis(maintenance.depuis) : ''}</strong>
            <p>
              {maintenance.auteur ? `Déclenchée par ${maintenance.auteur}. ` : ''}
              {maintenance.finPrevue ? `Retour annoncé : ${dateHeure(maintenance.finPrevue)}.` : 'Aucune heure de retour annoncée.'}
            </p>
            <p className="etat-maintenance-message">« {maintenance.message || MESSAGE_MAINTENANCE_DEFAUT} »</p>
          </div>
        </div>
      ) : (
        <p className="note-secondaire texte-aide">
          Pendant une maintenance, seuls les superadmins peuvent se connecter. Tous les autres (écoles, étudiants,
          parents, liens des professeurs) voient un écran d'attente qui se rouvre de lui-même à la fin. Leurs
          sessions sont conservées.
        </p>
      )}

      {!maintenance.actif && (
        <div className="formulaire">
          <div className="champ">
            <label>Message affiché aux utilisateurs</label>
            <textarea rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="champ">
            <label>Retour prévu (facultatif)</label>
            <input type="datetime-local" value={finPrevue} onChange={(e) => setFinPrevue(e.target.value)} />
          </div>
        </div>
      )}

      {erreur && <div className="message-erreur" style={{ marginTop: 14 }}>{erreur}</div>}
      <div className="actions-carte" style={{ marginTop: 18 }}>
        {maintenance.actif ? (
          <button className="primaire" onClick={terminer} disabled={enCours}>
            {enCours ? 'Réouverture…' : 'Terminer la maintenance'}
          </button>
        ) : (
          <button className="secondaire danger bouton-fort" onClick={() => setConfirmation(true)}>
            <IconWrench width={15} height={15} /> Activer la maintenance
          </button>
        )}
      </div>

      {confirmation && (
        <ConfirmModal
          titre="Mettre EduSphere en maintenance ?"
          boutonConfirmer="Activer la maintenance"
          boutonEnCours="Activation…"
          onConfirmer={activer}
          onAnnuler={() => setConfirmation(false)}
        >
          Toutes les écoles perdent l'accès immédiatement (connexions, sessions ouvertes et liens des professeurs),
          jusqu'à ce que tu termines la maintenance. Tu gardes l'accès à l'espace superadmin.
        </ConfirmModal>
      )}
    </div>
  );
}
