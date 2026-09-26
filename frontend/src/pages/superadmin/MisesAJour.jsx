import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  LIBELLES_ESPACES, ESPACES_NOTES, TYPES_MISE_A_JOUR, dateCourte, dateHeure, depuis,
} from '../../utils/plateforme';
import { IconSend, IconCheck, IconPlus } from '../../components/icons';

function comparerVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Numérotation habituelle : une nouveauté fait monter le deuxième chiffre
// (1.4.0 -> 1.5.0), une amélioration ou un correctif le troisième (1.4.0 ->
// 1.4.1). Simple suggestion, modifiable dans le formulaire.
function versionSuivante(version, type) {
  const [majeur = 1, mineur = 0, correctif = 0] = version.split('.').map(Number);
  return type === 'nouveaute' ? `${majeur}.${mineur + 1}.0` : `${majeur}.${mineur}.${correctif + 1}`;
}

function libelleEspaces(espaces) {
  if (!espaces || espaces.length === 0) return 'Tous les espaces';
  return espaces.map((e) => LIBELLES_ESPACES[e] || e).join(', ');
}

// Côté "mises à jour" du superadmin : ce qui tourne vraiment en production
// (version, commit déployé, santé du serveur), et les notes de version
// que les écoles lisent dans leur fenêtre "Nouveautés".
export default function MisesAJour({ onNaviguer }) {
  const [systeme, setSysteme] = useState(null);
  const [notes, setNotes] = useState(null);
  const [formulaire, setFormulaire] = useState(null); // null | { note?: existante }
  const [aSupprimer, setASupprimer] = useState(null);
  const [publicationEnCours, setPublicationEnCours] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/superadmin/systeme').then((res) => setSysteme(res.data)).catch(() => {});
    client.get('/superadmin/mises-a-jour').then((res) => setNotes(res.data.misesAJour)).catch(() => setNotes([]));
  }
  useEffect(charger, []);
  useActualisation(charger);

  // Plus haute version connue (brouillons compris), pour proposer la suivante.
  const derniereVersion = [systeme?.version, ...(notes || []).map((n) => n.version)]
    .filter(Boolean)
    .sort(comparerVersions)
    .pop() || '1.0.0';

  async function publier(note) {
    setPublicationEnCours(note.id);
    try {
      await client.post(`/superadmin/mises-a-jour/${note.id}/publier`);
      setToast({ message: `Version ${note.version} publiée. Les espaces concernés la verront dans « Nouveautés ».`, type: 'succes' });
      charger();
    } catch (err) {
      setToast({ message: messageErreur(err, 'publication impossible'), type: 'erreur' });
    } finally {
      setPublicationEnCours(null);
    }
  }

  async function supprimer() {
    await client.delete(`/superadmin/mises-a-jour/${aSupprimer.id}`);
    setToast({ message: `Version ${aSupprimer.version} supprimée.`, type: 'succes' });
    setASupprimer(null);
    charger();
  }

  function surEnregistre(note, publiee) {
    setFormulaire(null);
    setToast({
      message: publiee
        ? `Version ${note.version} publiée. Les espaces concernés la verront dans « Nouveautés ».`
        : `Brouillon de la version ${note.version} enregistré.`,
      type: 'succes',
    });
    charger();
  }

  return (
    <>
      <div className="carte carte-version">
        <div className="carte-version-principal">
          <span className="carte-version-surtitre">Version en production</span>
          <div className="carte-version-numero">{systeme ? `v${systeme.version}` : '…'}</div>
          <p className="carte-version-date">
            {systeme?.versionPublieeLe ? `Annoncée le ${dateCourte(systeme.versionPublieeLe)}` : 'Aucune note de version publiée pour l’instant'}
          </p>
          <button className="primaire" onClick={() => setFormulaire({})}><IconPlus /> Publier une mise à jour</button>
        </div>
        <dl className="faits-systeme">
          <div>
            <dt>Commit déployé</dt>
            <dd className="mono">{systeme ? (systeme.commit ? `${systeme.commit}${systeme.branche ? ` (${systeme.branche})` : ''}` : 'Non fourni en local') : '…'}</dd>
          </div>
          <div>
            <dt>Hébergement</dt>
            <dd>{systeme?.hebergement || '…'}</dd>
          </div>
          <div>
            <dt>Serveur démarré</dt>
            <dd title={systeme ? dateHeure(systeme.demarreLe) : undefined}>{systeme ? depuis(systeme.demarreLe) : '…'}</dd>
          </div>
          <div>
            <dt>Base de données</dt>
            <dd>
              {systeme
                ? <span className={`badge ${systeme.baseDeDonnees.ok ? 'vert' : 'rouge'}`}>{systeme.baseDeDonnees.ok ? `Connectée, ${systeme.baseDeDonnees.latenceMs} ms` : 'Injoignable'}</span>
                : '…'}
            </dd>
          </div>
          <div>
            <dt>Node.js</dt>
            <dd className="mono">{systeme?.node || '…'}</dd>
          </div>
          <div>
            <dt>Mémoire utilisée</dt>
            <dd className="mono">{systeme ? `${systeme.memoireMo} Mo` : '…'}</dd>
          </div>
        </dl>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Historique des versions</h2>
          {notes && <span className="entete-carte-compteur">{notes.length} note{notes.length > 1 ? 's' : ''}</span>}
        </div>
        <p className="note-secondaire" style={{ marginTop: -6, marginBottom: 18, lineHeight: 1.55 }}>
          Le code d'une version arrive par un déploiement (envoi sur GitHub, puis Render). Publie ici la note qui
          l'annonce : chaque utilisateur concerné la verra dans « Nouveautés » à sa prochaine visite. Pour une mise
          à jour lourde, <button type="button" className="lien-texte" onClick={() => onNaviguer?.('annonces')}>active d'abord la maintenance</button>.
        </p>

        {!notes && <div className="chargement">Chargement…</div>}
        {notes && notes.length === 0 && (
          <div className="vide">
            Aucune note de version pour l'instant. Publie la première pour présenter aux écoles ce qui a changé.
          </div>
        )}
        {notes && notes.length > 0 && (
          <ol className="historique-versions">
            {notes.map((n) => {
              const type = TYPES_MISE_A_JOUR[n.type] || TYPES_MISE_A_JOUR.nouveaute;
              const brouillon = n.statut === 'brouillon';
              return (
                <li key={n.id} className={`ligne-version ${brouillon ? 'brouillon' : ''}`}>
                  <div className="ligne-version-rail">
                    <span className="pastille-version">v{n.version}</span>
                    <span className="notification-date">{brouillon ? 'Non publiée' : dateCourte(n.publieeLe)}</span>
                  </div>
                  <div className="ligne-version-corps">
                    <div className="fil-version-meta">
                      <span className={`badge ${type.badge}`}>{type.libelle}</span>
                      <span className={`badge ${brouillon ? 'gris' : 'vert'}`}>{brouillon ? 'Brouillon' : 'Publiée'}</span>
                      <span className="note-secondaire" style={{ fontSize: '0.76rem' }}>Visible par : {libelleEspaces(n.espaces)}</span>
                    </div>
                    <h3 className="fil-version-titre">{n.titre}</h3>
                    <p className="fil-version-texte">{n.contenu}</p>
                    <div className="ligne-version-actions">
                      {brouillon && (
                        <button className="secondaire succes" onClick={() => publier(n)} disabled={publicationEnCours === n.id}>
                          {publicationEnCours === n.id ? 'Publication…' : 'Publier'}
                        </button>
                      )}
                      <button className="secondaire" onClick={() => setFormulaire({ note: n })}>Modifier</button>
                      <button className="secondaire danger" onClick={() => setASupprimer(n)}>Supprimer</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {formulaire && (
        <FormulaireNote
          note={formulaire.note}
          versionProposee={derniereVersion}
          onFermer={() => setFormulaire(null)}
          onEnregistre={surEnregistre}
        />
      )}
      {aSupprimer && (
        <ConfirmModal
          titre={`Supprimer la version ${aSupprimer.version} ?`}
          boutonConfirmer="Supprimer"
          onConfirmer={supprimer}
          onAnnuler={() => setASupprimer(null)}
        >
          {aSupprimer.statut === 'publiee'
            ? "Cette note disparaîtra aussi de la fenêtre « Nouveautés » des utilisateurs. Le code déployé n'est pas touché."
            : 'Ce brouillon sera définitivement supprimé.'}
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireNote({ note, versionProposee, onFermer, onEnregistre }) {
  const edition = Boolean(note);
  const [form, setForm] = useState(() => ({
    version: note?.version || versionSuivante(versionProposee, 'nouveaute'),
    type: note?.type || 'nouveaute',
    titre: note?.titre || '',
    contenu: note?.contenu || '',
    espaces: note ? (note.espaces?.length ? note.espaces : [...ESPACES_NOTES]) : [...ESPACES_NOTES],
  }));
  const [versionTouchee, setVersionTouchee] = useState(edition);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState('');

  function changerType(type) {
    setForm((f) => ({ ...f, type, version: versionTouchee ? f.version : versionSuivante(versionProposee, type) }));
  }

  function basculerEspace(espace) {
    setForm((f) => ({
      ...f,
      espaces: f.espaces.includes(espace) ? f.espaces.filter((e) => e !== espace) : [...f.espaces, espace],
    }));
  }

  async function envoyer(publier) {
    setErreur('');
    setEnCours(publier ? 'publier' : 'enregistrer');
    try {
      const res = edition
        ? await client.put(`/superadmin/mises-a-jour/${note.id}`, form)
        : await client.post('/superadmin/mises-a-jour', { ...form, publier });
      onEnregistre(res.data.miseAJour, !edition && publier);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer cette note"));
      setEnCours(null);
    }
  }

  return (
    <Modal titre={edition ? `Modifier la version ${note.version}` : 'Publier une mise à jour'} onFermer={onFermer} largeur={600}>
      <form className="formulaire" onSubmit={(e) => { e.preventDefault(); envoyer(!edition); }}>
        <div className="ligne-champs">
          <div className="champ" style={{ maxWidth: 170 }}>
            <label>Version</label>
            <input
              value={form.version}
              onChange={(e) => { setVersionTouchee(true); setForm({ ...form, version: e.target.value }); }}
              placeholder="1.4.0"
              required
            />
          </div>
          <div className="champ">
            <label>Type</label>
            <select value={form.type} onChange={(e) => changerType(e.target.value)}>
              {Object.entries(TYPES_MISE_A_JOUR).map(([id, t]) => <option key={id} value={id}>{t.libelle}</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label>Titre</label>
          <input
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
            placeholder="Ex. Export des bulletins en un clic"
            maxLength={140}
            required
          />
        </div>
        <div className="champ">
          <label>Ce qui change</label>
          <textarea
            rows={6}
            value={form.contenu}
            onChange={(e) => setForm({ ...form, contenu: e.target.value })}
            placeholder="Décris la nouveauté du point de vue des utilisateurs : ce qu'ils peuvent faire maintenant, et où le trouver."
            maxLength={4000}
            required
          />
        </div>
        <div className="champ">
          <label>Espaces qui la verront</label>
          <div className="cases-choix">
            {ESPACES_NOTES.map((espace) => {
              const choisi = form.espaces.includes(espace);
              return (
                <button
                  key={espace}
                  type="button"
                  className={`case-choix ${choisi ? 'choisie' : ''}`}
                  aria-pressed={choisi}
                  onClick={() => basculerEspace(espace)}
                >
                  <span className="case-choix-coche">{choisi && <IconCheck />}</span>
                  <span>{LIBELLES_ESPACES[espace]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          {edition ? (
            <button type="submit" className="primaire" disabled={Boolean(enCours)}>
              {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          ) : (
            <>
              <button type="button" className="secondaire" onClick={() => envoyer(false)} disabled={Boolean(enCours)}>
                {enCours === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer en brouillon'}
              </button>
              <button type="submit" className="primaire" disabled={Boolean(enCours)}>
                <IconSend />
                {enCours === 'publier' ? 'Publication…' : 'Publier maintenant'}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
