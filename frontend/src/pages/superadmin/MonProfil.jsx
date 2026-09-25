import { useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import ChampMotDePasse from '../../components/ChampMotDePasse';
import { useAuth } from '../../context/AuthContext';
import { messageErreur } from '../../utils/erreurs';
import { dateCourte, dateHeure, depuis } from '../../utils/plateforme';
import { IconHistory, IconLogin, IconCheck, IconChevronRight, IconClose } from '../../components/icons';

const LONGUEUR_MIN = 6;

const DROITS = [
  'Affilier, modifier, verrouiller ou supprimer une école',
  'Ajouter ou retirer les fonctionnalités de chaque école',
  'Publier les notes de version et les annonces',
  'Mettre la plateforme en maintenance',
  'Créer d’autres comptes superadmin',
];
const JAMAIS = [
  'Les élèves, leurs notes et leurs absences',
  'Les comptes du personnel des écoles',
  'Les paiements et les frais des familles',
];

function initiales(prenom, nom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

// Le compte du superadmin connecté : son identité, ses informations, son
// mot de passe, et sa propre trace dans le journal (actions et connexions).
export default function MonProfil({ onNaviguer }) {
  const { profil, mettreAJourProfil } = useAuth();
  const [journal, setJournal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/superadmin/journal', { params: { limite: 500 } })
      .then((res) => setJournal(res.data.entrees.filter((e) => e.auteurId === profil?.id)))
      .catch(() => setJournal([]));
  }, [profil?.id]);

  const connexions = (journal || []).filter((e) => e.categorie === 'connexion');
  const actions = (journal || []).filter((e) => e.categorie !== 'connexion');
  const derniereConnexion = connexions[0]?.createdAt;
  const notifier = (message) => setToast({ message, type: 'succes' });

  return (
    <>
      <div className="profil-entete">
        <div className="profil-avatar" aria-hidden="true">{initiales(profil?.prenom, profil?.nom)}</div>
        <div className="profil-identite">
          <h2>{profil?.prenom} {profil?.nom}</h2>
          <p>{profil?.email}</p>
          <div className="puces">
            <span className="badge bleu">Superadmin</span>
            <span className="badge vert">Compte actif</span>
          </div>
        </div>
        <dl className="profil-chiffres">
          <div>
            <dt>Membre depuis</dt>
            <dd>{profil?.createdAt ? dateCourte(profil.createdAt) : '…'}</dd>
          </div>
          <div>
            <dt>Dernière connexion</dt>
            <dd>{journal ? (derniereConnexion ? depuis(derniereConnexion) : 'Aucune enregistrée') : '…'}</dd>
          </div>
          <div>
            <dt>Actions sur la plateforme</dt>
            <dd>{journal ? actions.length : '…'}</dd>
          </div>
        </dl>
      </div>

      <div className="grille-profil">
        <div className="colonne-empilee">
          <InformationsPersonnelles profil={profil} onEnregistre={(p) => { mettreAJourProfil(p); notifier('Informations enregistrées.'); }} />
          <MotDePasse profil={profil} onEnregistre={() => notifier('Mot de passe modifié.')} />
        </div>

        <div className="colonne-empilee">
          <div className="carte">
            <div className="entete-carte">
              <h2>Mon activité récente</h2>
              <button type="button" className="bouton-texte" onClick={() => onNaviguer?.('journal')}>
                Tout le journal <IconChevronRight />
              </button>
            </div>
            {!journal && <div className="chargement">Chargement…</div>}
            {journal && actions.length === 0 && <div className="vide">Aucune action enregistrée pour l'instant.</div>}
            {journal && actions.length > 0 && (
              <ol className="liste-activite">
                {actions.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <span className="liste-activite-icone"><IconHistory /></span>
                    <div>
                      <span>{e.libelle}</span>
                      <small>{dateHeure(e.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="carte">
            <h2>Dernières connexions</h2>
            {!journal && <div className="chargement">Chargement…</div>}
            {journal && connexions.length === 0 && <div className="vide">Aucune connexion enregistrée pour l'instant.</div>}
            {journal && connexions.length > 0 && (
              <ol className="liste-activite">
                {connexions.slice(0, 5).map((e, i) => (
                  <li key={e.id}>
                    <span className="liste-activite-icone"><IconLogin /></span>
                    <div>
                      <span>{dateHeure(e.createdAt)}{i === 0 && <span className="badge vert" style={{ marginLeft: 10 }}>La plus récente</span>}</span>
                      <small>{depuis(e.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="carte">
            <h2>Droits du compte</h2>
            <div className="droits-compte">
              <div>
                <h3 className="droits-titre">Ce que ce compte peut faire</h3>
                <ul className="liste-droits">
                  {DROITS.map((d) => <li key={d}><span className="droit-icone oui"><IconCheck /></span>{d}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="droits-titre">Ce qu'il ne voit jamais</h3>
                <ul className="liste-droits">
                  {JAMAIS.map((d) => <li key={d}><span className="droit-icone non"><IconClose /></span>{d}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function InformationsPersonnelles({ profil, onEnregistre }) {
  const [form, setForm] = useState({ prenom: profil?.prenom || '', nom: profil?.nom || '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const modifie = form.prenom !== profil?.prenom || form.nom !== profil?.nom;

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.put('/superadmin/mon-profil', form);
      onEnregistre(res.data.profil);
    } catch (err) {
      setErreur(messageErreur(err, 'échec de la mise à jour'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Informations personnelles</h2>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="p-prenom">Prénom</label><input id="p-prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required /></div>
          <div className="champ"><label htmlFor="p-nom">Nom</label><input id="p-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
        </div>
        <div className="champ">
          <label htmlFor="p-email">Adresse e-mail</label>
          <input id="p-email" value={profil?.email || ''} disabled />
          <small className="note-secondaire">C'est ton identifiant de connexion : il ne se modifie pas.</small>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours || !modifie}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}

function MotDePasse({ profil, onEnregistre }) {
  const [form, setForm] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const regles = [
    { ok: form.nouveau.length >= LONGUEUR_MIN, texte: `Au moins ${LONGUEUR_MIN} caractères` },
    { ok: Boolean(form.nouveau) && form.nouveau !== form.actuel, texte: "Différent de l'actuel" },
    { ok: Boolean(form.nouveau) && form.nouveau === form.confirmation, texte: 'Confirmation identique' },
  ];
  const valide = form.actuel && regles.every((r) => r.ok);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.put('/superadmin/mon-profil', {
        nom: profil?.nom, prenom: profil?.prenom, motDePasse: form.nouveau, motDePasseActuel: form.actuel,
      });
      setForm({ actuel: '', nouveau: '', confirmation: '' });
      onEnregistre();
    } catch (err) {
      setErreur(messageErreur(err, 'échec du changement de mot de passe'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Mot de passe</h2>
      <form className="formulaire" onSubmit={enregistrer} autoComplete="off">
        <div className="champ">
          <label htmlFor="p-actuel">Mot de passe actuel</label>
          <ChampMotDePasse id="p-actuel" autoComplete="current-password" value={form.actuel} onChange={(e) => setForm({ ...form, actuel: e.target.value })} />
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="p-nouveau">Nouveau mot de passe</label>
            <ChampMotDePasse id="p-nouveau" autoComplete="new-password" value={form.nouveau} onChange={(e) => setForm({ ...form, nouveau: e.target.value })} />
          </div>
          <div className="champ">
            <label htmlFor="p-confirmation">Confirmation</label>
            <ChampMotDePasse id="p-confirmation" autoComplete="new-password" value={form.confirmation} onChange={(e) => setForm({ ...form, confirmation: e.target.value })} />
          </div>
        </div>
        <ul className="regles-mdp">
          {regles.map((r) => (
            <li key={r.texte} className={r.ok ? 'ok' : ''}>
              <span className="regles-mdp-coche">{r.ok && <IconCheck />}</span>{r.texte}
            </li>
          ))}
        </ul>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours || !valide}>{enCours ? 'Modification…' : 'Changer le mot de passe'}</button>
      </form>
    </div>
  );
}
