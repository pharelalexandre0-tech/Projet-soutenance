import { useState } from 'react';
import Modal from './Modal';

// Confirmation habillée (retirer/supprimer...) au-dessus de Modal — même
// raison d'être que Modal lui-même : jamais de window.confirm() natif, qui
// casse la charte et ne peut pas porter de message d'erreur en cas d'échec.
export default function ConfirmModal({ titre, children, boutonConfirmer = 'Confirmer', boutonEnCours = 'Suppression…', onConfirmer, onAnnuler }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function confirmer() {
    setEnCours(true);
    setErreur('');
    try {
      await onConfirmer();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'erreur — réessaie');
      setEnCours(false);
    }
  }

  return (
    <Modal titre={titre} onFermer={onAnnuler} largeur={420}>
      <p className="confirmation-texte">{children}</p>
      {erreur && <div className="message-erreur" style={{ marginBottom: 14 }}>{erreur}</div>}
      <div className="confirmation-actions">
        <button type="button" className="secondaire" onClick={onAnnuler} disabled={enCours}>Annuler</button>
        <button type="button" className="danger secondaire" onClick={confirmer} disabled={enCours}>
          {enCours ? boutonEnCours : boutonConfirmer}
        </button>
      </div>
    </Modal>
  );
}
