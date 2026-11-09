import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import PagePublique from '../components/PagePublique';
import { messageErreur } from '../utils/erreurs';

const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Lien personnel envoyé au candidat accepté : il règle ses frais
// d'inscription (mobile money, ou plus tard au guichet) et son compte
// étudiant est créé aussitôt, sans se déplacer.
export default function FinaliserInscription() {
  const { jeton } = useParams();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ operateur: 'airtel', telephone: '' });
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => { client.get(`/preinscriptions-publiques/inscription/${jeton}`).then((r) => setD(r.data)).catch((e) => setErreur(messageErreur(e, 'lien invalide'))); }, [jeton]);

  async function action(url, corps) {
    setEnCours(true);
    setErreur('');
    try { setD((await client.post(`/preinscriptions-publiques/inscription/${jeton}/${url}`, corps)).data); } catch (e) { setErreur(messageErreur(e, 'action impossible')); } finally { setEnCours(false); }
  }

  return (
    <PagePublique surtitre="Inscription en ligne" titre={d ? `Bienvenue, ${d.prenom}` : 'Finaliser mon inscription'} introduction={d ? `${d.ecole.nom} · ${d.classe?.nom || ''} (${d.classe?.niveau || ''})` : ''} retour="Aller à la connexion">
      <div className="carte formulaire" style={{ maxWidth: 680, margin: '0 auto' }}>
        {!d && !erreur && <div className="chargement">Chargement…</div>}
        {erreur && <div className="message-erreur">{erreur}</div>}
        {d?.inscrit && (
          <>
            <div className="message-succes">Votre inscription est terminée. Votre espace étudiant est ouvert.</div>
            <dl className="fiche-dossier">
              <div><dt>Identifiant</dt><dd>{d.email}</dd></div>
              <div><dt>Mot de passe</dt><dd className="mono">votre matricule {d.matricule}</dd></div>
            </dl>
            {d.paiementStatut === 'au_guichet' && <p className="note-secondaire" style={{ margin: 0 }}>Les frais d’inscription ({fcfa(d.fraisInscription)}) restent à régler : ils apparaissent dans votre espace, rubrique Frais.</p>}
            <p className="note-secondaire" style={{ margin: 0 }}>Ces informations vous ont aussi été envoyées par e-mail.</p>
            <Link className="primaire" to="/connexion" style={{ textAlign: 'center', padding: '11px 16px', borderRadius: 8 }}>Ouvrir mon espace étudiant</Link>
          </>
        )}
        {d && !d.inscrit && (
          <>
            <dl className="fiche-dossier">
              <div><dt>Dossier</dt><dd className="mono">{d.numero}</dd></div>
              <div><dt>Classe</dt><dd>{d.classe?.nom} ({d.classe?.niveau})</dd></div>
              <div><dt>Frais d’inscription</dt><dd>{d.fraisInscription ? fcfa(d.fraisInscription) : 'Aucun'}</dd></div>
              <div><dt>E-mail</dt><dd>{d.email}</dd></div>
            </dl>
            {d.fraisInscription === 0 && <button type="button" className="primaire" disabled={enCours} onClick={() => action('guichet')}>Terminer mon inscription</button>}
            {d.fraisInscription > 0 && (
              <>
                {d.paiement.disponible && d.paiement.modeTest && <div className="message-attente"><strong>Mode test</strong> : aucun argent n’est débité.</div>}
                {d.paiement.disponible && !d.paiementReference && (
                  <form className="formulaire" onSubmit={(e) => { e.preventDefault(); action('paiement', form); }}>
                    <h3>Payer par mobile money</h3>
                    <div className="choix-operateur" role="radiogroup" aria-label="Opérateur">
                      {d.operateurs.map((o) => <button key={o.cle} type="button" role="radio" aria-checked={form.operateur === o.cle} className={`operateur ${o.cle} ${form.operateur === o.cle ? 'choisi' : ''}`} onClick={() => setForm({ ...form, operateur: o.cle })}>{o.nom}</button>)}
                    </div>
                    <div className="champ"><label htmlFor="fi-tel">Numéro de téléphone</label><input id="fi-tel" inputMode="tel" placeholder="077 12 34 56" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></div>
                    <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Envoi…' : `Payer ${fcfa(d.fraisInscription)}`}</button>
                  </form>
                )}
                {d.paiement.disponible && d.paiementReference && (
                  <form className="formulaire" onSubmit={(e) => { e.preventDefault(); action('confirmer-test', { code }); }}>
                    <div className="attente-telephone"><span className="rond-attente" aria-hidden="true" /><div><strong>Validez le paiement sur votre téléphone</strong><p>Référence {d.paiementReference}.</p></div></div>
                    {d.paiement.modeTest && (
                      <>
                        <div className="champ"><label htmlFor="fi-code">Code de validation (mode test : {d.paiement.codeTest})</label><input id="fi-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
                        <button type="submit" className="primaire" disabled={enCours}>Valider le paiement</button>
                      </>
                    )}
                  </form>
                )}
                {!d.paiement.disponible && <p className="note-secondaire" style={{ margin: 0 }}>{d.paiement.message}</p>}
                <div className="separateur-section" />
                <p className="note-secondaire" style={{ margin: 0 }}>Vous préférez payer plus tard à l’établissement ? Votre compte est créé tout de suite et les frais restent à régler.</p>
                <button type="button" className="secondaire" disabled={enCours} onClick={() => action('guichet')}>Terminer et payer plus tard à l’établissement</button>
              </>
            )}
          </>
        )}
      </div>
    </PagePublique>
  );
}
