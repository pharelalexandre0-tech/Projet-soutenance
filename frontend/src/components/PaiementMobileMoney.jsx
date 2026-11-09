import { useEffect, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import BoutonDocument from './BoutonDocument';
import { messageErreur } from '../utils/erreurs';

const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Paiement d'un frais par Airtel Money ou Moov Money. En mode test (aucun
// fournisseur branché), la validation sur le téléphone est simulée par un
// code de test et aucun argent n'est débité, ce qui est dit clairement.
export default function PaiementMobileMoney({ frais, onFermer, onPaye }) {
  const reste = Math.max(0, frais.montant - frais.montantRegle);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ operateur: 'airtel', telephone: '', montant: String(Math.round(reste)) });
  const [paiement, setPaiement] = useState(null);
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => { client.get('/paiements-en-ligne/configuration').then((r) => setConfig(r.data)).catch(() => setConfig({ disponible: false })); }, []);

  // Paiement réel : on interroge l'état toutes les 4 secondes jusqu'à la réponse.
  useEffect(() => {
    if (!paiement || paiement.statut !== 'en_attente' || config?.modeTest) return undefined;
    const t = setInterval(() => client.get(`/paiements-en-ligne/${paiement.reference}`).then((r) => {
      setPaiement(r.data.paiement);
      if (r.data.paiement.statut === 'reussi') onPaye?.();
    }).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [paiement, config]);

  async function demander(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const r = await client.post('/paiements-en-ligne', { fraisId: frais.id, ...form, montant: Number(form.montant) });
      setPaiement(r.data.paiement);
    } catch (err) {
      setErreur(messageErreur(err, 'la demande de paiement a échoué'));
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerTest(e) {
    e.preventDefault();
    setEnCours(true);
    try {
      const r = await client.post(`/paiements-en-ligne/${paiement.reference}/confirmer-test`, { code });
      setPaiement(r.data.paiement);
      if (r.data.paiement.statut === 'reussi') onPaye?.();
    } catch (err) {
      setErreur(messageErreur(err, 'confirmation impossible'));
    } finally {
      setEnCours(false);
    }
  }

  const libelle = form.operateur === 'moov' ? 'Moov Money' : 'Airtel Money';
  return (
    <Modal titre={`Payer « ${frais.libelle} »`} onFermer={onFermer} largeur={520}>
      {!config && <div className="chargement">Chargement…</div>}
      {config && !config.disponible && <div className="message-erreur">{config.message || 'Le paiement en ligne n’est pas disponible pour le moment.'}</div>}
      {config?.disponible && config.modeTest && (
        <div className="message-attente" style={{ marginBottom: 14 }}><strong>Mode test</strong> : aucun argent n’est débité. Le paiement réel sera activé dès que l’établissement aura son compte marchand Airtel Money et Moov Money.</div>
      )}
      {config?.disponible && !paiement && (
        <form className="formulaire" onSubmit={demander}>
          <div className="choix-operateur" role="radiogroup" aria-label="Opérateur">
            {config.operateurs.map((o) => (
              <button key={o.cle} type="button" role="radio" aria-checked={form.operateur === o.cle} className={`operateur ${o.cle} ${form.operateur === o.cle ? 'choisi' : ''}`} onClick={() => setForm({ ...form, operateur: o.cle })}>{o.nom}</button>
            ))}
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="mm-tel">Numéro {libelle}</label><input id="mm-tel" inputMode="tel" placeholder="077 12 34 56" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></div>
            <div className="champ"><label htmlFor="mm-montant">Montant (FCFA)</label><input id="mm-montant" type="number" min="100" max={Math.round(reste)} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          </div>
          <p className="note-secondaire" style={{ margin: 0 }}>Reste à payer : {fcfa(reste)}. Vous recevrez une demande de validation sur votre téléphone.</p>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
            <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Envoi…' : `Payer ${fcfa(Number(form.montant) || 0)}`}</button>
          </div>
        </form>
      )}
      {paiement?.statut === 'en_attente' && (
        <div className="formulaire">
          <div className="attente-telephone"><span className="rond-attente" aria-hidden="true" /><div><strong>Validez le paiement sur votre téléphone</strong><p>Une demande de {fcfa(paiement.montant)} a été envoyée au {paiement.telephone} ({paiement.libelleOperateur}). Référence {paiement.reference}.</p></div></div>
          {config.modeTest && (
            <form className="formulaire" onSubmit={confirmerTest}>
              <div className="champ"><label htmlFor="mm-code">Code de validation (mode test : {config.codeTest})</label><input id="mm-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></div>
              {erreur && <div className="message-erreur">{erreur}</div>}
              <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Validation…' : 'Valider le paiement'}</button>
            </form>
          )}
        </div>
      )}
      {paiement?.statut === 'reussi' && (
        <div className="formulaire">
          <div className="message-succes">Paiement de {fcfa(paiement.montant)} reçu. Le reçu a été envoyé par e-mail à la famille.</div>
          {paiement.recu && <BoutonDocument chemin={paiement.recu.fichierPDF} className="primaire" style={{ display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 8 }}>Télécharger le reçu n° {paiement.recu.numero}</BoutonDocument>}
          <div className="confirmation-actions"><button type="button" className="secondaire" onClick={onFermer}>Fermer</button></div>
        </div>
      )}
      {(paiement?.statut === 'echoue' || paiement?.statut === 'expire') && (
        <div className="formulaire">
          <div className="message-erreur">Paiement non abouti : {paiement.message || 'refusé'}. Aucun montant n’a été enregistré.</div>
          <div className="confirmation-actions">
            <button type="button" className="secondaire" onClick={onFermer}>Fermer</button>
            <button type="button" className="primaire" onClick={() => { setPaiement(null); setCode(''); setErreur(''); }}>Réessayer</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
