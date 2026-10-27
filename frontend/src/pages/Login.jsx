import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import TransitionOuverture from '../components/TransitionOuverture';
import SaisieCodeLiquide from '../components/SaisieCodeLiquide';
import EtapeApplication from '../components/EtapeApplication';
import Tissage from '../components/Tissage';
import { IconMail, IconLock, IconLogin, IconOeil, IconOeilBarre, IconAlertTriangle, IconWrench, IconBuilding, IconGraduationCap, IconBook, IconShield } from '../components/icons';
import { dateHeure } from '../utils/plateforme';
import { messageErreur } from '../utils/erreurs';
import logoIcon from '../assets/logo-icon.png';
import qrEduSphere from '../assets/qr-edusphere.svg';

// Temps pendant lequel « code accepté » (coche) reste à l'écran.
const DUREE_SUCCES_MS = 1800;

// Neuvième passe : deux cartes qui se chevauchent plutôt qu'une seule carte
// coupée en deux (référence donnée par l'utilisateur) — la carte blanche du
// formulaire est posée par-dessus la carte bleue, avec des formes
// organiques en fond au lieu d'un simple bord incurvé. Toujours pas de
// bascule "créer un compte" ni de "se souvenir de moi" — aucun des deux
// n'existe côté backend, une case à cocher qui ne fait rien n'a pas sa
// place ici. "Mot de passe oublié" existe bien, lui (ReinitialiserMotDePasse.jsx).
// Panneau tissé (moitié gauche) : motif de raphia aux couleurs d'EduSphere,
// titre en grand dans un cartouche marine. Repéré par data-cible-demarrage :
// l'écran de démarrage vient s'y poser.
function CarteBienvenue() {
  return (
    <div className="carte-bienvenue-blob tissage-acces" data-cible-demarrage>
      <Tissage colonnes={9} lignes={9} />
      <div className="tissage-cartouche">
        <div className="cartouche-marque">
          <span className="marque-pastille"><img src={logoIcon} alt="" /></span>
          <div>
            <h1 className="marque-nom">EduSphere</h1>
            <span className="cartouche-surtitre">Enseignement supérieur · Gabon</span>
          </div>
        </div>
        <p className="bienvenue-texte">
          Établissements, étudiants, familles et Ministère réunis sur une seule plateforme, sûre et disponible même hors ligne.
        </p>
      </div>
      {import.meta.env.MODE !== 'android' && (
        <div className="bienvenue-qr">
          <span className="bienvenue-qr-code"><img src={qrEduSphere} alt="QR code pour ouvrir EduSphere sur un téléphone" /></span>
          <span className="bienvenue-qr-texte"><strong>Sur votre téléphone</strong>Scannez pour ouvrir EduSphere, même hors ligne.</span>
        </div>
      )}
    </div>
  );
}

// `erreur` (optionnel) : ne dit jamais laquelle des deux valeurs est en
// cause — "identifiants incorrects" reste volontairement générique côté
// backend, révéler que c'est l'e-mail ou le mot de passe spécifiquement
// permettrait à quelqu'un de deviner quels comptes existent. On flague
// donc les deux champs à la fois, jamais un seul.
function Champ({ label, icone: Icone, erreur, children }) {
  return (
    <div className="champ">
      <label>{label}</label>
      <div className={erreur ? 'champ-icone champ-icone--erreur' : 'champ-icone'}>
        <Icone aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

// Maintenance en cours : prévenir AVANT la saisie, plutôt que de laisser
// quelqu'un taper ses identifiants pour découvrir ensuite qu'il ne peut pas
// entrer. Le formulaire reste utilisable : les superadmins, eux, passent.
function AvisMaintenance({ maintenance }) {
  return (
    <div className="connexion-maintenance" role="status">
      <IconWrench aria-hidden="true" />
      <div>
        <strong>Maintenance en cours</strong>
        <span>
          {maintenance.message || 'EduSphere est momentanément indisponible.'}
          {maintenance.finPrevue ? ` Retour prévu : ${dateHeure(maintenance.finPrevue)}.` : ''}
        </span>
      </div>
    </div>
  );
}

function AlerteErreur({ children }) {
  return (
    <div className="connexion-erreur" role="alert">
      <IconAlertTriangle aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

// Diagramme 3 : saisie identifiants -> demanderConnexion -> alt [valides]/[invalides].
export default function Login() {
  const { profil, seConnecter, verifierDoubleFacteur } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  // Double authentification (compte Étudiant) : le formulaire de mot de
  // passe cède la place à celui du code reçu par e-mail.
  const [attenteCode, setAttenteCode] = useState(null); // { utilisateurId } | null
  // Personnel : code de l'application d'authentification (ou sa première
  // configuration). { jetonEtape, configurationRequise, prenom } | null
  const [etapeApplication, setEtapeApplication] = useState(null);
  const [code, setCode] = useState('');
  const [etatCode, setEtatCode] = useState('saisie'); // saisie | verification | succes | erreur
  // Nouveau code possible 50 secondes après le précédent (même règle côté serveur).
  const [finAttente, setFinAttente] = useState(0);
  const [maintenantMs, setMaintenantMs] = useState(Date.now());
  const [renvoi, setRenvoi] = useState(''); // '' | 'envoi' | 'envoye'
  // "Mot de passe oublié" : mini-formulaire à la place du formulaire de
  // connexion, pas une page séparée — évite un aller-retour complet pour
  // une action qui ne quitte jamais vraiment l'écran de connexion.
  const [motDePasseOublieOuvert, setMotDePasseOublieOuvert] = useState(false);
  const [emailOubli, setEmailOubli] = useState('');
  const [messageOubli, setMessageOubli] = useState('');
  const [erreurOubli, setErreurOubli] = useState(false);
  const [enCoursOubli, setEnCoursOubli] = useState(false);
  const [maintenance, setMaintenance] = useState(null);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  // Arrivée depuis l'écran de démarrage : le sceau et le nom de la carte
  // bleue ne rejouent pas leur animation (ce sont ceux du démarrage qui
  // viennent s'y poser).
  const [depuisDemarrage] = useState(() => document.documentElement.classList.contains('demarrage-en-cours'));

  useEffect(() => {
    client.get('/plateforme/statut')
      .then((res) => setMaintenance(res.data.maintenance.actif ? res.data.maintenance : null))
      .catch(() => {});
  }, []);

  // Chronomètre du bouton « Renvoyer le code ».
  useEffect(() => {
    if (!attenteCode) return undefined;
    const minuteur = setInterval(() => setMaintenantMs(Date.now()), 250);
    return () => clearInterval(minuteur);
  }, [attenteCode]);
  const secondesRestantes = Math.max(0, Math.ceil((finAttente - maintenantMs) / 1000));

  if (ouverture) return <TransitionOuverture />;
  if (profil) return <Navigate to="/" replace />;

  function ouvrirSession() {
    setOuverture(true);
    // 2.3s restait trop rapide — la barre de progression elle-même ne
    // remplissait que 0.65s, le reste n'était que la marque qui s'écrit.
    // Le remplissage porte maintenant la durée (1.7s), pas du temps mort
    // en plus. Doit rester synchronisé avec .transition-ouverture en CSS.
    setTimeout(() => navigate('/'), 3500);
  }

  async function connecter(mailUtilise, motDePasseUtilise) {
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await seConnecter(mailUtilise, motDePasseUtilise);
      if (resultat.applicationRequise) {
        setEtapeApplication(resultat);
        setEnCours(false);
        return;
      }
      if (resultat.doubleFacteurRequis) {
        setAttenteCode({ utilisateurId: resultat.utilisateurId, codeDemonstration: resultat.codeDemonstration });
        setCode('');
        setEtatCode('saisie');
        setRenvoi('');
        setFinAttente(Date.now() + (resultat.delaiRenvoi || 50) * 1000);
        setEnCours(false);
        return;
      }
      ouvrirSession();
    } catch (err) {
      setErreur(messageErreur(err, 'identifiants incorrects'));
      setEnCours(false);
    }
  }

  async function validerCode(saisi = code) {
    if (saisi.length !== 6 || etatCode !== 'saisie') return;
    setErreur('');
    setEtatCode('verification');
    const debut = Date.now();
    // Laisse le temps à l'animation (bulles qui se rassemblent) d'être vue.
    const pause = () => new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - debut))));
    try {
      const session = await verifierDoubleFacteur(attenteCode.utilisateurId, saisi);
      await pause();
      setEtatCode('succes');
      // La coche reste affichée le temps d'être lue, puis la session s'ouvre
      // (profil et écran de chargement de l'école en même temps).
      setTimeout(() => { session.appliquer(); ouvrirSession(); }, DUREE_SUCCES_MS);
    } catch (err) {
      await pause();
      setEtatCode('erreur');
      setErreur(messageErreur(err, 'code incorrect'));
      setTimeout(() => { setCode(''); setEtatCode('saisie'); }, 1500);
    }
  }

  async function renvoyerCode() {
    setRenvoi('envoi');
    setErreur('');
    try {
      const res = await client.post('/auth/connexion/renvoyer-code', { utilisateurId: attenteCode.utilisateurId });
      setFinAttente(Date.now() + (res.data.delai || 50) * 1000);
      if (res.data.codeDemonstration) setAttenteCode((a) => ({ ...a, codeDemonstration: res.data.codeDemonstration }));
      setRenvoi('envoye');
      setCode('');
      setEtatCode('saisie');
    } catch (err) {
      const attente = err.response?.data?.attente;
      if (attente) setFinAttente(Date.now() + attente * 1000);
      setErreur(messageErreur(err, "impossible d'envoyer un nouveau code"));
      setRenvoi('');
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    connecter(email, motDePasse);
  }

  async function demanderReinitialisation(e) {
    e.preventDefault();
    setEnCoursOubli(true);
    try {
      const res = await client.post('/auth/mot-de-passe-oublie', { email: emailOubli });
      // Message volontairement identique côté backend, compte trouvé ou
      // non — sinon ce formulaire devient un moyen de vérifier quelles
      // adresses ont un compte ici.
      setErreurOubli(false);
      setMessageOubli(res.data.message);
    } catch (err) {
      setErreurOubli(true);
      setMessageOubli(messageErreur(err, "impossible d'envoyer l'e-mail pour le moment"));
    } finally {
      setEnCoursOubli(false);
    }
  }

  if (motDePasseOublieOuvert) {
    return (
      <div className={`page-connexion ${depuisDemarrage ? 'depuis-demarrage' : ''}`}>
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <p className="acces-eyebrow">Mot de passe oublié</p>
            <h2>Réinitialiser l'accès</h2>
            <p className="connexion-aide">Saisis ton e-mail. Si un compte existe, un lien de réinitialisation t'est envoyé.</p>
            <form className="formulaire-connexion" onSubmit={demanderReinitialisation}>
              <Champ label="Adresse e-mail" icone={IconMail}>
                <input
                  type="email"
                  placeholder="vous@etablissement.ga"
                  value={emailOubli}
                  onChange={(e) => setEmailOubli(e.target.value)}
                  autoFocus
                  required
                />
              </Champ>
              {messageOubli && (erreurOubli
                ? <AlerteErreur>{messageOubli}</AlerteErreur>
                : <div className="message-succes">{messageOubli}</div>)}
              <button className="bouton-connexion" type="submit" disabled={enCoursOubli}>
                {enCoursOubli ? 'Envoi…' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                className="connexion-retour"
                onClick={() => { setMotDePasseOublieOuvert(false); setMessageOubli(''); setErreurOubli(false); setEmailOubli(''); }}
              >
                Retour
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (etapeApplication) {
    return (
      <div className={`page-connexion ${depuisDemarrage ? 'depuis-demarrage' : ''}`}>
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <EtapeApplication
              etape={etapeApplication}
              onSession={(session) => { session.appliquer(); ouvrirSession(); }}
              onRetour={() => { setEtapeApplication(null); setErreur(''); }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (attenteCode) {
    return (
      <div className={`page-connexion ${depuisDemarrage ? 'depuis-demarrage' : ''}`}>
        <div className="composition-acces">
          <CarteBienvenue />
          <div className="carte-formulaire-acces">
            <p className="acces-eyebrow">Étape 2</p>
            <h2>Vérification</h2>
            <p className="connexion-aide">Un code à 6 chiffres vient d'être envoyé par e-mail. Saisis-le pour continuer.</p>
            {attenteCode.codeDemonstration && (
              <p className="code-demonstration">Compte de démonstration (aucun e-mail réel) : code <strong>{attenteCode.codeDemonstration}</strong></p>
            )}
            <form className="formulaire-connexion" onSubmit={(e) => { e.preventDefault(); validerCode(); }}>
              <SaisieCodeLiquide
                valeur={code}
                onChange={(v) => { setCode(v); setErreur(''); }}
                onComplet={validerCode}
                etat={etatCode}
              />
              {erreur && etatCode !== 'verification' && (
                <p className="message-code-erreur" role="alert">{erreur.charAt(0).toUpperCase() + erreur.slice(1)}.</p>
              )}
              <button className="bouton-connexion" type="submit" disabled={etatCode !== 'saisie' || code.length !== 6}>
                {etatCode === 'verification' ? 'Vérification…' : etatCode === 'succes' ? 'Code accepté' : etatCode === 'erreur' ? 'Code refusé' : 'Valider'}
              </button>
              <p className="connexion-renvoi" aria-live="polite">
                {secondesRestantes > 0 ? (
                  <>
                    {renvoi === 'envoye' && <span className="connexion-renvoi-ok">Nouveau code envoyé. </span>}
                    Pas reçu ? Nouveau code possible dans <strong>0:{String(secondesRestantes).padStart(2, '0')}</strong>
                  </>
                ) : (
                  <>Pas reçu ? <button type="button" onClick={renvoyerCode} disabled={renvoi === 'envoi'}>{renvoi === 'envoi' ? 'Envoi…' : 'Renvoyer le code'}</button></>
                )}
              </p>
              <button
                type="button"
                className="connexion-retour"
                onClick={() => { setAttenteCode(null); setCode(''); setErreur(''); setEtatCode('saisie'); }}
              >
                Retour
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-connexion ${depuisDemarrage ? 'depuis-demarrage' : ''}`}>
      <div className="composition-acces">
        <CarteBienvenue />
        <div className="carte-formulaire-acces carte-acces-principale">
          <div className="login-bandeau">
            <span>Plateforme de l’enseignement supérieur</span>
            <a href="/verifier"><IconShield aria-hidden="true" /> Vérifier un document</a>
          </div>
          <p className="acces-eyebrow">Espace sécurisé</p>
          <h2>Bonjour.</h2>
          <p className="connexion-aide">Connectez-vous pour ouvrir votre espace.</p>
          {maintenance && <AvisMaintenance maintenance={maintenance} />}
          <form className="formulaire-connexion" onSubmit={onSubmit}>
            <Champ label="Adresse e-mail" icone={IconMail} erreur={Boolean(erreur)}>
              <input
                type="email"
                placeholder="vous@etablissement.ga"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErreur(''); }}
                required
              />
            </Champ>
            <Champ label="Mot de passe" icone={IconLock} erreur={Boolean(erreur)}>
              <input
                type={motDePasseVisible ? 'text' : 'password'}
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => { setMotDePasse(e.target.value); setErreur(''); }}
                required
              />
              <button
                type="button"
                className="champ-icone-oeil"
                onClick={() => setMotDePasseVisible((v) => !v)}
                aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={motDePasseVisible}
                title={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {motDePasseVisible ? <IconOeilBarre /> : <IconOeil />}
              </button>
            </Champ>
            <button
              type="button"
              className="connexion-mot-de-passe-oublie"
              onClick={() => { setMotDePasseOublieOuvert(true); setEmailOubli(email); }}
            >
              Mot de passe oublié ?
            </button>
            {erreur && <AlerteErreur>{erreur}</AlerteErreur>}
            <button className="bouton-connexion" type="submit" disabled={enCours}>
              <IconLogin className="bouton-connexion-icone" />
              {enCours ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="connexion-note-parent">
              Parent d'élève ? Connectez-vous avec votre adresse e-mail et le matricule de votre enfant.
            </p>
          </form>
          {/* Qui se connecte, et comment : la page blanche guide chacun. */}
          <ul className="espaces-acces" aria-label="Les espaces EduSphere">
            <li>
              <span className="espace-icone"><IconBuilding aria-hidden="true" /></span>
              <span><strong>Personnel de l’établissement</strong>E-mail et mot de passe, puis le code de votre application d’authentification.</span>
            </li>
            <li>
              <span className="espace-icone"><IconGraduationCap aria-hidden="true" /></span>
              <span><strong>Étudiants et parents</strong>E-mail et matricule, puis un code reçu par e-mail.</span>
            </li>
            <li>
              <span className="espace-icone"><IconBook aria-hidden="true" /></span>
              <span><strong>Ministère de l’Enseignement supérieur</strong>Accès réservé aux agents habilités.</span>
            </li>
          </ul>
          <div className="login-pied">
            <span>© 2026 EduSphere · Libreville</span>
            <a href="/confidentialite">Politique de confidentialité</a>
          </div>
        </div>
      </div>
    </div>
  );
}
