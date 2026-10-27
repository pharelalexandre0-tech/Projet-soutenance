import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import PiecesBourse from '../../components/PiecesBourse';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { IconInfo, IconSend } from '../../components/icons';

const STATUTS = { incomplet: ['En préparation', 'gris'], soumis: ['Envoyé à l’ANBG', 'vert'], a_corriger: ['En préparation', 'gris'], valide: ['Envoyé à l’ANBG', 'vert'] };

// Dossier de bourse ANBG de l'étudiant (ou de son enfant, pour le parent) :
// numéro de boursier, pièces à téléverser, envoi à l'agence.
export default function BourseANBG() {
  const [vue, setVue] = useState(null);
  const [numero, setNumero] = useState('');
  const [aRetirer, setARetirer] = useState(null);
  const [confirmer, setConfirmer] = useState(false);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/bourse/moi').then((r) => { setVue(r.data); setNumero(r.data.dossier.numeroBoursier || ''); }).catch(() => {});
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['bourse'] });

  if (!vue) return <div className="chargement">Chargement…</div>;
  const d = vue.dossier;
  const modifiable = !['soumis', 'valide'].includes(d.statut);
  const c = vue.completude;

  async function enregistrerNumero() {
    try {
      setVue((await client.put('/bourse/moi', { numeroBoursier: numero })).data);
      setToast({ message: 'Numéro de boursier enregistré', type: 'succes' });
    } catch (e) {
      setToast({ message: messageErreur(e, 'numéro refusé'), type: 'erreur' });
    }
  }

  async function soumettre() {
    setVue((await client.post('/bourse/moi/soumettre')).data);
    setConfirmer(false);
    setToast({ message: 'Dossier envoyé à l’ANBG', type: 'succes' });
  }

  return (
    <>
      <div className="encart-info" style={{ marginBottom: 20 }}>
        <IconInfo />
        <span>
          Dossier destiné à l’Agence nationale des bourses du Gabon (ANBG). Téléversez chaque pièce en PDF, PNG ou JPEG (5 Mo au plus).
          L’attestation d’inscription et le relevé de notes peuvent être générés ici, déjà certifiés par votre établissement.
        </span>
      </div>
      <div className="stats-grid">
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Statut du dossier</span></div><div className="valeur valeur-montant"><span className={`badge ${STATUTS[d.statut][1]}`}>{STATUTS[d.statut][0]}</span></div></div>
        <div className="stat-tile"><div className="stat-tile-haut"><span className="libelle">Pièces obligatoires fournies</span></div><div className="valeur">{c.presents}<small className="valeur-unite">/{c.obligatoires}</small></div></div>
      </div>
      <section className="carte">
        <div className="entete-carte">
          <h2>Dossier de bourse ANBG</h2>
          {modifiable && (
            <button type="button" className="primaire" disabled={c.manquants.length > 0 || !d.numeroBoursier} onClick={() => setConfirmer(true)}>
              <IconSend /> Envoyer à l’ANBG
            </button>
          )}
        </div>
        <div className="ligne-champs" style={{ marginBottom: 18 }}>
          <div className="champ"><label htmlFor="b-num">Numéro de boursier ANBG</label>
            <input id="b-num" value={numero} disabled={!modifiable} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="Ex. ANBG-2026-012345" />
          </div>
          {modifiable && <button type="button" className="secondaire" style={{ alignSelf: 'flex-end' }} onClick={enregistrerNumero}>Enregistrer</button>}
        </div>
        {c.manquants.length > 0 && <p className="note-secondaire">Encore à fournir : {c.manquants.join(', ')}.</p>}
        <PiecesBourse
          vue={vue}
          urlDepot="/bourse/moi/pieces"
          onChange={charger}
          modifiable={modifiable}
          peutGenerer
          retirer={(p) => setARetirer(p)}
        />
      </section>
      {aRetirer && (
        <ConfirmModal titre="Retirer cette pièce" boutonConfirmer="Retirer" boutonEnCours="Retrait…" onConfirmer={async () => { await client.delete(`/bourse/moi/pieces/${aRetirer.id}`); setARetirer(null); charger(); }} onAnnuler={() => setARetirer(null)}>
          {aRetirer.nomFichier} sera supprimée du dossier.
        </ConfirmModal>
      )}
      {confirmer && (
        <ConfirmModal titre="Envoyer le dossier à l’ANBG" boutonConfirmer="Envoyer" boutonEnCours="Envoi…" onConfirmer={() => soumettre().catch((e) => { setConfirmer(false); setToast({ message: messageErreur(e, 'transmission impossible'), type: 'erreur' }); })} onAnnuler={() => setConfirmer(false)}>
          Votre dossier complet part à l’Agence nationale des bourses du Gabon. Vous ne pourrez plus modifier les pièces après l’envoi.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
