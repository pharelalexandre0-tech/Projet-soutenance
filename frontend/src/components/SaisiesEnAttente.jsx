import { useEffect, useState } from 'react';
import { suivreAttente, retirerAttente } from '../api/horsLigne';
import { envoyerSaisiesEnAttente } from '../api/fileAttente';
import Modal from './Modal';
import Toast from './Toast';

const heure = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Pastille des saisies faites hors ligne : combien attendent le réseau, et
// celles que le serveur a refusées, avec la raison.
export default function SaisiesEnAttente() {
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [toast, setToast] = useState(null);
  useEffect(() => suivreAttente(setListe), []);
  useEffect(() => {
    const f = (e) => setToast({ message: `${e.detail.envoyees} saisie${e.detail.envoyees > 1 ? 's' : ''} faite${e.detail.envoyees > 1 ? 's' : ''} hors ligne envoyée${e.detail.envoyees > 1 ? 's' : ''} au serveur.`, type: 'succes' });
    window.addEventListener('edusphere:saisies-envoyees', f);
    return () => window.removeEventListener('edusphere:saisies-envoyees', f);
  }, []);

  const enAttente = liste.filter((f) => !f.rejet);
  const rejetees = liste.filter((f) => f.rejet);
  return (
    <>
      {(enAttente.length > 0 || rejetees.length > 0) && (
        <div className={`saisies-attente ${rejetees.length ? 'rejet' : ''}`} role="status">
          {enAttente.length > 0 && <span className="rond" aria-hidden="true" />}
          <span>
            {enAttente.length > 0 && `${enAttente.length} saisie${enAttente.length > 1 ? 's' : ''} en attente d’envoi`}
            {enAttente.length > 0 && rejetees.length > 0 && ' · '}
            {rejetees.length > 0 && `${rejetees.length} refusée${rejetees.length > 1 ? 's' : ''}`}
          </span>
          <button type="button" onClick={() => setOuvert(true)}>Détail</button>
        </div>
      )}
      {ouvert && (
        <Modal titre="Saisies faites hors ligne" onFermer={() => setOuvert(false)} largeur={620}>
          <div className="formulaire">
            {liste.length === 0 && <div className="vide">Tout a été envoyé.</div>}
            {liste.length > 0 && (
              <div className="table-scroll"><table>
                <thead><tr><th>Saisie</th><th>Faite le</th><th>État</th><th aria-label="Actions" /></tr></thead>
                <tbody>{liste.map((f) => (
                  <tr key={f.id}>
                    <td>{f.libelle}</td><td>{heure(f.date)}</td>
                    <td>{f.rejet ? <span className="ton-echec">Refusée : {f.rejet}</span> : <span className="badge or">En attente du réseau</span>}</td>
                    <td className="cellule-actions">{f.rejet && <button type="button" className="secondaire" onClick={() => retirerAttente(f.id)}>Retirer</button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
            <p className="note-secondaire" style={{ margin: 0 }}>Les saisies en attente partent d’elles-mêmes dès que le réseau revient. Une saisie refusée (notes déjà verrouillées par le jury, lien expiré…) doit être refaite en ligne.</p>
            <div className="confirmation-actions">
              <button type="button" className="secondaire" onClick={() => setOuvert(false)}>Fermer</button>
              {enAttente.length > 0 && <button type="button" className="primaire" onClick={() => envoyerSaisiesEnAttente()}>Envoyer maintenant</button>}
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
