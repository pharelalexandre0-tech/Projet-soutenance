import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SaisieCodeLiquide from './SaisieCodeLiquide';
import { messageErreur } from '../utils/erreurs';
import { IconCopy, IconDownload, IconShield, IconKey } from './icons';

const DUREE_SUCCES_MS = 1400;

// Codes de secours montrés une seule fois : copier, télécharger, puis
// confirmer les avoir rangés avant d'entrer.
export function CodesSecours({ codes, onContinuer, libelleContinuer = 'Accéder à mon espace' }) {
  const [garde, setGarde] = useState(false);
  const [copie, setCopie] = useState(false);
  const texte = `EduSphere : codes de secours\nChaque code ne sert qu'une fois, si votre téléphone n'est pas disponible.\n\n${codes.join('\n')}\n`;

  function telecharger() {
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edusphere-codes-de-secours.txt';
    a.click();
    URL.revokeObjectURL(url);
    setGarde(true);
  }

  return (
    <div className="etape-application">
      <p className="connexion-aide">
        Si votre téléphone est perdu ou indisponible, chacun de ces codes permet <strong>une</strong> connexion.
        Rangez-les en lieu sûr : ils ne seront plus affichés.
      </p>
      <ol className="codes-secours">
        {codes.map((c) => <li key={c}><code>{c}</code></li>)}
      </ol>
      <div className="codes-secours-actions">
        <button type="button" className="secondaire" onClick={() => navigator.clipboard?.writeText(texte).then(() => { setCopie(true); setGarde(true); }, () => {})}>
          <IconCopy /> {copie ? 'Copiés' : 'Copier'}
        </button>
        <button type="button" className="secondaire" onClick={telecharger}><IconDownload /> Télécharger</button>
      </div>
      <label className="case-confirmation">
        <input type="checkbox" checked={garde} onChange={(e) => setGarde(e.target.checked)} />
        J’ai rangé mes codes de secours
      </label>
      <button type="button" className="bouton-connexion" disabled={!garde} onClick={onContinuer}>{libelleContinuer}</button>
    </div>
  );
}

// QR code à scanner et clé à saisir à la main.
export function ConfigurationQr({ preparation }) {
  return (
    <div className="configuration-qr">
      <img src={preparation.qr} alt="QR code à scanner avec l'application d'authentification" width="176" height="176" />
      <div>
        <ol className="configuration-etapes">
          <li>Installez <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong> sur votre téléphone.</li>
          <li>Dans l’application, ajoutez un compte et scannez ce QR code.</li>
          <li>Saisissez ci-dessous le code à 6 chiffres affiché.</li>
        </ol>
        <p className="configuration-cle">
          <span>Impossible de scanner ? Clé à saisir :</span>
          <code>{preparation.secret}</code>
        </p>
      </div>
    </div>
  );
}

// Deuxième étape de connexion du personnel : code de l'application
// d'authentification, ou première configuration de celle-ci.
export default function EtapeApplication({ etape, onSession, onRetour }) {
  const { verifierApplication, preparerApplication, activerApplication } = useAuth();
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState('saisie');
  const [erreur, setErreur] = useState('');
  const [secours, setSecours] = useState(false);
  const [codeSecours, setCodeSecours] = useState('');
  const [preparation, setPreparation] = useState(null);
  const [codesSecours, setCodesSecours] = useState(null);
  const [sessionPrete, setSessionPrete] = useState(null);

  useEffect(() => {
    if (!etape.configurationRequise) return;
    preparerApplication(etape.jetonEtape).then(setPreparation).catch((err) => setErreur(messageErreur(err, 'préparation impossible, recommencez la connexion')));
  }, [etape.jetonEtape]); // eslint-disable-line react-hooks/exhaustive-deps

  async function valider(saisi) {
    if (etat !== 'saisie') return;
    setErreur('');
    setEtat('verification');
    const debut = Date.now();
    const pause = () => new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - debut))));
    try {
      const session = etape.configurationRequise
        ? await activerApplication(etape.jetonEtape, saisi)
        : await verifierApplication(etape.jetonEtape, saisi);
      await pause();
      setEtat('succes');
      if (session.codesSecours) {
        setTimeout(() => { setSessionPrete(session); setCodesSecours(session.codesSecours); }, DUREE_SUCCES_MS);
      } else {
        setTimeout(() => onSession(session), DUREE_SUCCES_MS);
      }
    } catch (err) {
      await pause();
      setEtat('erreur');
      setErreur(messageErreur(err, 'code incorrect'));
      setTimeout(() => { setCode(''); setCodeSecours(''); setEtat('saisie'); }, 1500);
    }
  }

  if (codesSecours) {
    return (
      <>
        <p className="acces-eyebrow">Compte sécurisé</p>
        <h2>Vos codes de secours</h2>
        <CodesSecours codes={codesSecours} onContinuer={() => onSession(sessionPrete)} />
      </>
    );
  }

  const erreurVisible = erreur && etat !== 'verification' && (
    <p className="message-code-erreur" role="alert">{erreur.charAt(0).toUpperCase() + erreur.slice(1)}.</p>
  );

  return (
    <>
      <p className="acces-eyebrow">Étape 2 · Double authentification</p>
      <h2>{etape.configurationRequise ? 'Sécurisez votre compte' : 'Code de vérification'}</h2>
      {etape.configurationRequise ? (
        <p className="connexion-aide">
          {etape.prenom ? `${etape.prenom}, l` : 'L'}es comptes du personnel sont protégés par une application d’authentification :
          même avec votre mot de passe, personne ne peut entrer sans votre téléphone.
        </p>
      ) : (
        <p className="connexion-aide">Ouvrez votre application d’authentification et saisissez le code EduSphere à 6 chiffres.</p>
      )}

      {etape.configurationRequise && !preparation && !erreur && <div className="chargement">Préparation du QR code…</div>}
      {etape.configurationRequise && preparation && <ConfigurationQr preparation={preparation} />}

      <form className="formulaire-connexion" onSubmit={(e) => { e.preventDefault(); valider(secours ? codeSecours : code); }}>
        {!secours ? (
          <SaisieCodeLiquide valeur={code} onChange={(v) => { setCode(v); setErreur(''); }} onComplet={valider} etat={etat} autoFocus={!etape.configurationRequise} />
        ) : (
          <div className="champ">
            <label htmlFor="code-secours">Code de secours</label>
            <div className="champ-icone">
              <IconKey aria-hidden="true" />
              <input
                id="code-secours"
                value={codeSecours}
                onChange={(e) => { setCodeSecours(e.target.value.toUpperCase()); setErreur(''); }}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                autoFocus
                spellCheck={false}
              />
            </div>
          </div>
        )}
        {erreurVisible}
        <button className="bouton-connexion" type="submit" disabled={etat !== 'saisie' || (secours ? codeSecours.replace(/[^0-9A-Z]/gi, '').length !== 8 : code.length !== 6)}>
          <IconShield className="bouton-connexion-icone" />
          {etat === 'verification' ? 'Vérification…' : etat === 'succes' ? 'Code accepté' : etat === 'erreur' ? 'Code refusé' : etape.configurationRequise ? 'Activer et continuer' : 'Valider'}
        </button>
        {!etape.configurationRequise && (
          <button type="button" className="connexion-mot-de-passe-oublie" onClick={() => { setSecours((s) => !s); setErreur(''); setCode(''); setCodeSecours(''); }}>
            {secours ? 'Utiliser le code de l’application' : 'Téléphone indisponible ? Utiliser un code de secours'}
          </button>
        )}
        <button type="button" className="connexion-retour" onClick={onRetour}>Retour</button>
      </form>
    </>
  );
}
