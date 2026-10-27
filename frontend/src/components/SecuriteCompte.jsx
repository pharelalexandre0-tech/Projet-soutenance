import { useEffect, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import ChampMotDePasse from './ChampMotDePasse';
import SaisieCodeLiquide from './SaisieCodeLiquide';
import Toast from './Toast';
import { CodesSecours, ConfigurationQr } from './EtapeApplication';
import { messageErreur } from '../utils/erreurs';
import { dateHeure, depuis } from '../utils/plateforme';
import { IconShield, IconShieldAlert, IconKey, IconLogout, IconHistory } from './icons';

const LIBELLES_ACTION = {
  connexion: 'Connexion',
  connexion_refusee: 'Connexion refusée',
  compte_bloque_temporairement: 'Compte bloqué 15 min (essais répétés)',
  code_email_epuise: 'Code e-mail invalidé (trop d’essais)',
  double_facteur_active: 'Application d’authentification activée',
  double_facteur_reconfigure: 'Application d’authentification changée',
  double_facteur_email: 'Retour au code par e-mail',
  codes_secours_regeneres: 'Nouveaux codes de secours',
  code_secours_utilise: 'Code de secours utilisé',
  session_fermee: 'Appareil déconnecté',
  sessions_fermees: 'Autres appareils déconnectés',
  mot_de_passe_change: 'Mot de passe changé',
  mot_de_passe_reinitialise: 'Mot de passe réinitialisé',
  reinitialisation_demandee: 'Réinitialisation demandée',
  email_change: 'Adresse e-mail changée',
};

// Sécurité du compte connecté : double authentification, appareils
// connectés (fermeture à distance), activité récente.
export default function SecuriteCompte({ compact = false }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [toast, setToast] = useState(null);
  const [action, setAction] = useState(null); // 'appareil' | 'codes' | null
  const [codesAffiches, setCodesAffiches] = useState(null);

  const charger = () => client.get('/auth/securite').then((r) => setDonnees(r.data)).catch((e) => setErreur(messageErreur(e, 'informations indisponibles')));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['auth'] });

  async function fermer(id) {
    try {
      await client.delete(`/auth/sessions/${id}`);
      setToast({ message: 'Appareil déconnecté', type: 'succes' });
      charger();
    } catch (e) {
      setToast({ message: messageErreur(e, 'déconnexion impossible'), type: 'erreur' });
    }
  }

  async function fermerAutres() {
    try {
      const r = await client.post('/auth/sessions/fermer-autres');
      setToast({ message: r.data.fermees ? `${r.data.fermees} appareil(s) déconnecté(s)` : 'Aucun autre appareil connecté', type: 'succes' });
      charger();
    } catch (e) {
      setToast({ message: messageErreur(e, 'déconnexion impossible'), type: 'erreur' });
    }
  }

  if (erreur) return <div className="message-erreur">{erreur}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;

  const df = donnees.doubleFacteur;
  const autres = donnees.sessions.filter((s) => !s.actuelle).length;

  return (
    <div className={`securite-compte ${compact ? 'compact' : ''}`}>
      <section className="securite-bloc">
        <div className="securite-bloc-entete">
          <span className={`securite-etat ${df.actif ? 'ok' : 'attention'}`}>{df.actif ? <IconShield /> : <IconShieldAlert />}</span>
          <div>
            <h3>Double authentification</h3>
            <p>
              {df.type === 'email'
                ? 'À chaque connexion, un code à 6 chiffres vous est envoyé par e-mail.'
                : `Le code vient de votre application d’authentification depuis le ${dateHeure(df.activeLe)}. ${df.codesSecoursRestants} code(s) de secours restant(s).`}
            </p>
          </div>
        </div>
        {df.type === 'email' && df.applicationPossible && !codesAffiches && (
          <div className="securite-actions">
            <button type="button" className="secondaire petit" onClick={() => setAction(action === 'appareil' ? null : 'appareil')}>Utiliser plutôt une application (facultatif)</button>
          </div>
        )}
        {df.type === 'application' && df.actif && !codesAffiches && (
          <div className="securite-actions">
            <button type="button" className="secondaire petit" onClick={() => setAction(action === 'codes' ? null : 'codes')}><IconKey /> Nouveaux codes de secours</button>
            <button type="button" className="secondaire petit" onClick={() => setAction(action === 'appareil' ? null : 'appareil')}>Changer de téléphone</button>
            <button type="button" className="secondaire petit" onClick={() => setAction(action === 'email' ? null : 'email')}>Revenir au code par e-mail</button>
          </div>
        )}
        {action === 'email' && (
          <RevenirEmail onFait={() => { setAction(null); setToast({ message: 'Vous recevrez désormais votre code par e-mail', type: 'succes' }); charger(); }} />
        )}
        {df.type === 'application' && df.codesSecoursRestants <= 3 && df.actif && !codesAffiches && (
          <p className="securite-alerte">Il vous reste peu de codes de secours : générez-en de nouveaux.</p>
        )}
        {action === 'codes' && !codesAffiches && (
          <RegenererCodes onCodes={(c) => { setCodesAffiches(c); setAction(null); charger(); }} />
        )}
        {action === 'appareil' && !codesAffiches && (
          <ChangerTelephone onCodes={(c) => { setCodesAffiches(c); setAction(null); charger(); }} />
        )}
        {codesAffiches && (
          <CodesSecours codes={codesAffiches} libelleContinuer="J’ai rangé mes codes" onContinuer={() => setCodesAffiches(null)} />
        )}
      </section>

      <section className="securite-bloc">
        <div className="securite-titre-ligne">
          <h3>Appareils connectés <span className="entete-carte-compteur">{donnees.sessions.length}</span></h3>
          {autres > 0 && <button type="button" className="secondaire petit danger" onClick={fermerAutres}><IconLogout /> Déconnecter les autres</button>}
        </div>
        <ul className="liste-sessions">
          {donnees.sessions.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.appareil}{s.parent ? ' · Espace Parents' : ''}</strong>
                <span>{s.ip || 'adresse inconnue'} · {s.methode} · active {depuis(s.derniereActivite)}</span>
              </div>
              {s.actuelle
                ? <span className="badge vert">Cet appareil</span>
                : <button type="button" className="secondaire petit" onClick={() => fermer(s.id)}>Déconnecter</button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="securite-bloc">
        <h3>Activité récente du compte</h3>
        {donnees.historique.length === 0 && <p className="note-secondaire">Aucune activité enregistrée pour l’instant.</p>}
        <ol className="liste-activite">
          {donnees.historique.map((h) => (
            <li key={h.id}>
              <span className="liste-activite-icone"><IconHistory /></span>
              <div>
                <span>{LIBELLES_ACTION[h.action] || h.action}</span>
                <small>{dateHeure(h.horodatage)}{h.ip ? ` · ${h.ip}` : ''}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function RegenererCodes({ onCodes }) {
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState('saisie');
  const [erreur, setErreur] = useState('');
  async function valider(saisi) {
    setEtat('verification');
    setErreur('');
    try {
      const r = await client.post('/auth/securite/codes-secours', { code: saisi });
      setEtat('succes');
      onCodes(r.data.codesSecours);
    } catch (e) {
      setEtat('erreur');
      setErreur(messageErreur(e, 'code incorrect'));
      setTimeout(() => { setCode(''); setEtat('saisie'); }, 1300);
    }
  }
  return (
    <div className="securite-sous-bloc">
      <p className="note-secondaire">Les anciens codes de secours cesseront de fonctionner. Saisissez le code actuel de votre application :</p>
      <SaisieCodeLiquide valeur={code} onChange={setCode} onComplet={valider} etat={etat} />
      {erreur && <div className="message-erreur">{erreur}</div>}
    </div>
  );
}

function RevenirEmail({ onFait }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  async function valider(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/auth/securite/application/desactiver', { motDePasse });
      onFait();
    } catch (err) {
      setErreur(messageErreur(err, 'mot de passe incorrect'));
    }
  }
  return (
    <form className="securite-sous-bloc" onSubmit={valider}>
      <p className="note-secondaire">Votre application ne sera plus demandée : un code vous sera envoyé par e-mail à chaque connexion.</p>
      <div className="champ">
        <label htmlFor="sc-mdp-email">Mot de passe actuel</label>
        <ChampMotDePasse id="sc-mdp-email" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
      </div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <button type="submit" className="primaire petit">Confirmer</button>
    </form>
  );
}

function ChangerTelephone({ onCodes }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [preparation, setPreparation] = useState(null);
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState('saisie');
  const [erreur, setErreur] = useState('');

  async function preparer(e) {
    e.preventDefault();
    setErreur('');
    try {
      setPreparation((await client.post('/auth/securite/application/initialiser', { motDePasse })).data);
    } catch (err) {
      setErreur(messageErreur(err, 'mot de passe incorrect'));
    }
  }

  async function activer(saisi) {
    setEtat('verification');
    setErreur('');
    try {
      const r = await client.post('/auth/securite/application/activer', { code: saisi });
      setEtat('succes');
      onCodes(r.data.codesSecours);
    } catch (err) {
      setEtat('erreur');
      setErreur(messageErreur(err, 'code incorrect'));
      setTimeout(() => { setCode(''); setEtat('saisie'); }, 1300);
    }
  }

  if (!preparation) {
    return (
      <form className="securite-sous-bloc" onSubmit={preparer}>
        <div className="champ">
          <label htmlFor="sc-mdp">Mot de passe actuel</label>
          <ChampMotDePasse id="sc-mdp" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button type="submit" className="primaire petit">Afficher le QR code</button>
      </form>
    );
  }
  return (
    <div className="securite-sous-bloc">
      <ConfigurationQr preparation={preparation} />
      <SaisieCodeLiquide valeur={code} onChange={setCode} onComplet={activer} etat={etat} />
      {erreur && <div className="message-erreur">{erreur}</div>}
      <p className="note-secondaire">Une fois le nouveau téléphone validé, l’ancien ne permet plus de se connecter et les autres appareils sont déconnectés.</p>
    </div>
  );
}
