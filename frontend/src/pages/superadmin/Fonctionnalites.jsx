import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { LIBELLES_ESPACES, dateHeure } from '../../utils/plateforme';
import {
  IconAlertTriangle, IconKey, IconCalendar, IconMessage, IconWallet, IconBanknote, IconToggle, IconCheck,
} from '../../components/icons';

const ICONES = {
  prediction: IconAlertTriangle,
  'acces-temporaires': IconKey,
  'emplois-du-temps': IconCalendar,
  communication: IconMessage,
  paie: IconWallet,
  'frais-en-ligne': IconBanknote,
};

const PORTEES = [
  { id: 'toutes', libelle: 'Toutes les écoles' },
  { id: 'selection', libelle: 'Écoles pilotes' },
  { id: 'aucune', libelle: 'Désactivée' },
];

function memesEcoles(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

// Ouverture des modules aux écoles : le code d'un module arrive avec un
// déploiement, mais c'est ici qu'on décide qui le reçoit. Le mode "Écoles
// pilotes" sert à lancer une nouveauté dans une ou deux écoles d'abord,
// avant de la généraliser.
export default function Fonctionnalites() {
  const [donnees, setDonnees] = useState(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/superadmin/fonctionnalites')
      .then((res) => setDonnees(res.data))
      .catch((err) => setErreurChargement(messageErreur(err, 'impossible de charger les fonctionnalités')));
  }, []);

  if (erreurChargement) return <div className="message-erreur">{erreurChargement}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;

  const compte = (portee) => donnees.fonctionnalites.filter((f) => f.portee === portee).length;

  return (
    <>
      <div className="bandeau-pilotage">
        <span className="puce-icone"><IconToggle width={18} height={18} /></span>
        <p>
          Choisis quelles écoles reçoivent chaque module. Un module coupé disparaît du menu des espaces
          concernés en moins d'une minute, et son accès est aussi refusé côté serveur.
        </p>
        <div className="bandeau-pilotage-compteurs">
          <span><strong>{compte('toutes')}</strong> partout</span>
          <span><strong>{compte('selection')}</strong> en pilote</span>
          <span><strong>{compte('aucune')}</strong> désactivée{compte('aucune') > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="grille-fonctionnalites">
        {donnees.fonctionnalites.map((f) => (
          <CarteFonctionnalite
            key={f.cle}
            fonctionnalite={f}
            ecoles={donnees.ecoles}
            onEnregistree={(nouvellesDonnees, message) => {
              setDonnees(nouvellesDonnees);
              setToast({ message, type: 'succes' });
            }}
          />
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function CarteFonctionnalite({ fonctionnalite: f, ecoles, onEnregistree }) {
  const [portee, setPortee] = useState(f.portee);
  const [choix, setChoix] = useState(f.ecoles);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState(false);

  // Après un enregistrement, la carte repart de l'état confirmé par le serveur.
  useEffect(() => {
    setPortee(f.portee);
    setChoix(f.ecoles);
  }, [f]);

  const Icone = ICONES[f.cle] || IconToggle;
  const modifie = portee !== f.portee || (portee === 'selection' && !memesEcoles(choix, f.ecoles));

  const etat = f.portee === 'toutes'
    ? { badge: 'vert', texte: 'Ouverte à toutes les écoles' }
    : f.portee === 'selection'
      ? { badge: 'or', texte: `Pilote : ${f.nbEcolesOuvertes} école${f.nbEcolesOuvertes > 1 ? 's' : ''} sur ${ecoles.length}` }
      : { badge: 'gris', texte: 'Désactivée partout' };

  function basculerEcole(id) {
    setErreur('');
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  // Lève l'erreur (au lieu de l'afficher) pour que ConfirmModal puisse la
  // montrer dans sa propre fenêtre quand l'envoi part de la confirmation.
  async function envoyer() {
    const res = await client.put(`/superadmin/fonctionnalites/${f.cle}`, { portee, ecoles: portee === 'selection' ? choix : [] });
    setConfirmation(false);
    const messages = {
      toutes: `« ${f.nom} » est ouverte à toutes les écoles.`,
      selection: `« ${f.nom} » est ouverte aux écoles pilotes choisies.`,
      aucune: `« ${f.nom} » est désactivée pour toutes les écoles.`,
    };
    onEnregistree(res.data, messages[portee]);
  }

  async function enregistrer() {
    if (portee === 'aucune' && f.portee !== 'aucune') {
      setConfirmation(true);
      return;
    }
    setEnCours(true);
    setErreur('');
    try {
      await envoyer();
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer ce réglage"));
    } finally {
      setEnCours(false);
    }
  }

  function annuler() {
    setPortee(f.portee);
    setChoix(f.ecoles);
    setErreur('');
  }

  return (
    <div className={`carte carte-fonctionnalite portee-${f.portee}`}>
      <div className="carte-fonctionnalite-entete">
        <span className="puce-icone"><Icone width={18} height={18} /></span>
        <div className="carte-fonctionnalite-titre">
          <h3>{f.nom}</h3>
          <span className={`badge ${etat.badge}`}>{etat.texte}</span>
        </div>
      </div>

      <p className="carte-fonctionnalite-description">{f.description}</p>

      <div className="puces-espaces">
        <span className="puces-espaces-libelle">Espaces concernés</span>
        {f.espaces.map((e) => <span key={e} className="puce-espace">{LIBELLES_ESPACES[e] || e}</span>)}
      </div>

      <div className="segment" role="radiogroup" aria-label={`Ouverture de ${f.nom}`}>
        {PORTEES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={portee === p.id}
            className={`${portee === p.id ? 'actif' : ''} segment-${p.id}`}
            onClick={() => { setPortee(p.id); setErreur(''); }}
          >
            {p.libelle}
          </button>
        ))}
      </div>

      {portee === 'selection' && (
        <div className="choix-ecoles">
          {ecoles.length === 0 && <div className="vide">Aucune école affiliée pour l'instant.</div>}
          {ecoles.length > 0 && (
            <>
              <p className="note-secondaire">Écoles qui reçoivent ce module en avant-première :</p>
              <div className="puces-ecoles">
                {ecoles.map((e) => {
                  const choisie = choix.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`puce-ecole ${choisie ? 'choisie' : ''}`}
                      aria-pressed={choisie}
                      onClick={() => basculerEcole(e.id)}
                    >
                      <span className="puce-ecole-case">{choisie && <IconCheck width={12} height={12} />}</span>
                      <span className="puce-ecole-nom">{e.nom}</span>
                      <small>{e.ville}{e.statut === 'suspendu' ? ', suspendue' : ''}</small>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {erreur && <div className="message-erreur" style={{ marginTop: 12 }}>{erreur}</div>}

      <div className="carte-fonctionnalite-pied">
        <span className="note-secondaire">
          {f.misAJourLe ? `Réglée le ${dateHeure(f.misAJourLe)}` : 'Réglage par défaut'}
        </span>
        {modifie && (
          <div className="carte-fonctionnalite-actions">
            <button type="button" className="secondaire" onClick={annuler} disabled={enCours}>Annuler</button>
            <button type="button" className="primaire" onClick={enregistrer} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      {confirmation && (
        <ConfirmModal
          titre={`Désactiver « ${f.nom} » ?`}
          boutonConfirmer="Désactiver partout"
          boutonEnCours="Désactivation…"
          onConfirmer={envoyer}
          onAnnuler={() => setConfirmation(false)}
        >
          Le module disparaîtra de tous les espaces concernés ({f.espaces.map((e) => LIBELLES_ESPACES[e] || e).join(', ')})
          dans toutes les écoles. Les données déjà saisies sont conservées et réapparaîtront si tu le rouvres.
        </ConfirmModal>
      )}
    </div>
  );
}
