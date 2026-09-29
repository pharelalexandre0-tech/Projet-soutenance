import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import useActualisation from '../hooks/useActualisation';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import Tiroir from './Tiroir';
import Toast from './Toast';
import { messageErreur } from '../utils/erreurs';
import { dateCourte, dateHeure } from '../utils/plateforme';
import {
  IconeFonctionnalite, IconExternal, IconBot, IconEnvoyer, IconPlus, IconSearch, IconTrash, IconCircleCheck,
  IconChevronRight, IconInbox,
} from './icons';

// Onglet d'une fonctionnalité personnalisée, créée par le superadmin et
// ajoutée à cette école : une page d'information, l'accès à un service en
// ligne, un assistant qui répond aux questions, un formulaire de demande
// adressé à l'Académie, ou un registre tenu par l'Académie.
export default function PageExtension({ extension }) {
  if (extension.type === 'assistant') return <ExtensionAssistant extension={extension} />;
  if (extension.type === 'formulaire') return <ExtensionFormulaire extension={extension} />;
  if (extension.type === 'registre') return <ExtensionRegistre extension={extension} />;
  if (extension.type === 'lien') return <ExtensionLien extension={extension} />;
  return (
    <div className="carte">
      <div className="page-extension-contenu">{extension.contenu}</div>
    </div>
  );
}

function ExtensionLien({ extension }) {
  let domaine = extension.url;
  try {
    domaine = new URL(extension.url).host;
  } catch {
    // Adresse déjà validée côté serveur : on garde le texte brut au pire.
  }
  return (
    <div className="carte">
      <div className="service-externe">
        <span className="tuile-fonctionnalite grande personnalisee"><IconeFonctionnalite nom={extension.icone} /></span>
        <div className="service-externe-textes">
          <strong>{extension.nom}</strong>
          <p>{extension.description}</p>
          <span className="mono">{domaine}</span>
        </div>
        <a className="bouton-primaire" href={extension.url} target="_blank" rel="noopener noreferrer">
          {extension.libelleBouton || 'Ouvrir le service'}
          <IconExternal />
        </a>
      </div>
    </div>
  );
}

const LIBELLES_AUTEURS = { etudiant: 'Étudiant', parent: 'Parent', academie: 'Académie', finance: 'Finance' };

function useDonneesExtension(cle) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  function charger() {
    return client.get(`/extensions/${cle}`)
      .then((res) => { setDonnees(res.data); setErreur(''); })
      .catch((err) => setErreur(messageErreur(err, 'impossible de charger cet onglet')));
  }
  useEffect(() => { setDonnees(null); charger(); }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  useActualisation(charger, { domaines: ['extensions'] });
  return { donnees, erreur, charger, setDonnees };
}

// ---- Assistant ------------------------------------------------------------

function ExtensionAssistant({ extension }) {
  const { donnees, erreur, charger } = useDonneesExtension(extension.cle);
  if (erreur) return <div className="message-erreur">{erreur}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;
  return (
    <div className={extension.gestion ? 'grille-assistant' : ''}>
      <Conversation extension={extension} historique={donnees.historique} titreEssai={extension.gestion && !extension.utilisation} />
      {extension.gestion && <QuestionsPosees extension={extension} questions={donnees.questions || []} onChange={charger} />}
    </div>
  );
}

const DELAI_MIN_REPONSE_MS = 700;

function Conversation({ extension, historique, titreEssai }) {
  const config = extension.configuration || { accueil: '', sujets: [] };
  // Fil local : l'historique enregistré, puis les échanges de cette visite.
  const [fil, setFil] = useState(() => historique.flatMap(versMessages));
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const zoneRef = useRef(null);

  useEffect(() => {
    const zone = zoneRef.current;
    if (zone) zone.scrollTo({ top: zone.scrollHeight, behavior: 'smooth' });
  }, [fil, enCours]);

  async function envoyer(question) {
    const texte = question.trim();
    if (!texte || enCours) return;
    setErreur('');
    setSaisie('');
    setFil((f) => [...f, { de: 'moi', texte, id: `q-${Date.now()}` }]);
    setEnCours(true);
    const debut = Date.now();
    try {
      const res = await client.post(`/extensions/${extension.cle}/questions`, { question: texte });
      await new Promise((r) => setTimeout(r, Math.max(0, DELAI_MIN_REPONSE_MS - (Date.now() - debut))));
      setFil((f) => [...f, versMessages(res.data.entree)[1]]);
    } catch (err) {
      setErreur(messageErreur(err, "l'assistant n'a pas pu répondre"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte assistant">
      <div className="assistant-entete">
        <span className="assistant-avatar"><IconBot /></span>
        <div>
          <strong>{titreEssai ? `Essayer « ${extension.nom} »` : extension.nom}</strong>
          <span className="assistant-etat"><span className="point-en-ligne" /> Répond immédiatement</span>
        </div>
      </div>

      <div className="assistant-fil" ref={zoneRef} aria-live="polite">
        <Bulle de="assistant">{config.accueil}</Bulle>
        {fil.length === 0 && config.sujets.length > 0 && (
          <Suggestions sujets={config.sujets.slice(0, 6)} onChoisir={envoyer} />
        )}
        {fil.map((m) => (
          <div key={m.id}>
            <Bulle de={m.de} inconnue={m.inconnue}>{m.texte}</Bulle>
            {m.suggestions?.length > 0 && m === fil[fil.length - 1] && !enCours && (
              <Suggestions sujets={m.suggestions} onChoisir={envoyer} />
            )}
          </div>
        ))}
        {enCours && (
          <div className="bulle assistant en-train" aria-label="L'assistant écrit">
            <span /><span /><span />
          </div>
        )}
      </div>

      {erreur && <div className="message-erreur" style={{ margin: '0 0 10px' }}>{erreur}</div>}
      <form className="assistant-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(saisie); }}>
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          maxLength={300}
          placeholder="Écrivez votre question…"
          aria-label="Votre question"
        />
        <button type="submit" className="primaire" disabled={!saisie.trim() || enCours} aria-label="Envoyer">
          <IconEnvoyer />
        </button>
      </form>
    </div>
  );
}

function versMessages(entree) {
  return [
    { de: 'moi', texte: entree.donnees.question, id: `q-${entree.id}` },
    {
      de: 'assistant',
      texte: entree.donnees.reponse,
      inconnue: entree.statut === 'sans-reponse',
      suggestions: entree.donnees.suggestions || [],
      id: `r-${entree.id}`,
    },
  ];
}

function Bulle({ de, inconnue, children }) {
  return <div className={`bulle ${de} ${inconnue ? 'inconnue' : ''}`}>{children}</div>;
}

function Suggestions({ sujets, onChoisir }) {
  return (
    <div className="assistant-suggestions">
      {sujets.map((s) => <button key={s} type="button" onClick={() => onChoisir(s)}>{s}</button>)}
    </div>
  );
}

function QuestionsPosees({ extension, questions, onChange }) {
  const [filtre, setFiltre] = useState('');
  const [ouverte, setOuverte] = useState(null);
  const [confirmation, setConfirmation] = useState(false);
  const [toast, setToast] = useState(null);
  const sansReponse = questions.filter((q) => q.statut === 'sans-reponse').length;
  const affichees = filtre ? questions.filter((q) => q.statut === filtre) : questions;

  async function effacer() {
    const res = await client.delete(`/extensions/${extension.cle}/questions`);
    setConfirmation(false);
    setToast({ message: `${res.data.supprimees} question${res.data.supprimees > 1 ? 's' : ''} effacée${res.data.supprimees > 1 ? 's' : ''}.`, type: 'succes' });
    onChange();
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Questions posées</h2>
        {questions.length > 0 && (
          <button className="secondaire danger" onClick={() => setConfirmation(true)}><IconTrash /> Tout effacer</button>
        )}
      </div>
      <p className="note-secondaire texte-aide">
        Les questions sans réponse vous montrent ce que l'assistant ne sait pas encore : transmettez-les au support
        EduSphere pour qu'il complète ses réponses.
      </p>
      <div className="barre-outils">
        <div className="filtres-puces" role="group" aria-label="Filtrer les questions">
          <button className={filtre === '' ? 'actif' : ''} onClick={() => setFiltre('')}>Toutes ({questions.length})</button>
          <button className={filtre === 'sans-reponse' ? 'actif' : ''} onClick={() => setFiltre('sans-reponse')}>Sans réponse ({sansReponse})</button>
          <button className={filtre === 'repondue' ? 'actif' : ''} onClick={() => setFiltre('repondue')}>Répondues ({questions.length - sansReponse})</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Posée le</th><th>Par</th><th>Question</th><th>Résultat</th><th aria-label="Détail" /></tr></thead>
          <tbody>
            {affichees.map((q) => (
              <tr key={q.id} className="ligne-cliquable" onClick={() => setOuverte(q)}>
                <td className="cellule-date">{dateHeure(q.createdAt)}</td>
                <td>{q.auteurNom}</td>
                <td className="cellule-description">{q.donnees.question}</td>
                <td>
                  <span className={`badge ${q.statut === 'repondue' ? 'vert' : 'or'}`}>
                    {q.statut === 'repondue' ? 'Répondue' : 'Sans réponse'}
                  </span>
                </td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {affichees.length === 0 && (
              <tr><td colSpan={5} className="vide">{questions.length ? 'Aucune question dans ce filtre.' : "Personne n'a encore interrogé l'assistant."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {ouverte && (
        <Modal titre="Question posée à l'assistant" onFermer={() => setOuverte(null)} largeur={560}>
          <dl className="details-extension">
            <div className="details-ligne"><dt>Posée par</dt><dd>{ouverte.auteurNom} ({LIBELLES_AUTEURS[ouverte.auteurEspace] || ouverte.auteurEspace})</dd></div>
            <div className="details-ligne"><dt>Le</dt><dd>{dateHeure(ouverte.createdAt)}</dd></div>
            <div className="details-ligne"><dt>Question</dt><dd>{ouverte.donnees.question}</dd></div>
            <div className="details-ligne"><dt>Réponse donnée</dt><dd>{ouverte.donnees.reponse}</dd></div>
          </dl>
        </Modal>
      )}
      {confirmation && (
        <ConfirmModal titre="Effacer toutes les questions ?" boutonConfirmer="Tout effacer" onConfirmer={effacer} onAnnuler={() => setConfirmation(false)}>
          L'historique des {questions.length} questions posées à l'assistant sera supprimé, y compris dans les
          conversations des utilisateurs.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

// ---- Formulaire -----------------------------------------------------------

const STATUTS_DEMANDE = {
  nouvelle: { libelle: 'Reçue', pluriel: 'Reçues', badge: 'bleu' },
  'en-cours': { libelle: 'En cours', pluriel: 'En cours', badge: 'or' },
  traitee: { libelle: 'Traitée', pluriel: 'Traitées', badge: 'vert' },
};

function ExtensionFormulaire({ extension }) {
  const { donnees, erreur, charger } = useDonneesExtension(extension.cle);
  if (erreur) return <div className="message-erreur">{erreur}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;
  if (extension.gestion) return <DemandesRecues extension={extension} demandes={donnees.demandes} onChange={charger} />;
  return (
    <>
      <NouvelleDemande extension={extension} onEnvoyee={charger} />
      <MesDemandes extension={extension} demandes={donnees.demandes} />
    </>
  );
}

function ChampValeur({ champ, valeur, onChange }) {
  const id = `champ-${champ.id}`;
  const commun = { id, value: valeur || '', onChange: (e) => onChange(e.target.value), required: champ.obligatoire };
  let saisie;
  if (champ.type === 'long') saisie = <textarea rows={4} maxLength={3000} {...commun} />;
  else if (champ.type === 'choix') {
    saisie = (
      <select {...commun}>
        <option value="">Choisir…</option>
        {champ.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else {
    const types = { nombre: 'number', date: 'date', email: 'email', telephone: 'tel', lien: 'url' };
    saisie = <input type={types[champ.type] || 'text'} maxLength={300} {...commun} />;
  }
  return (
    <div className="champ">
      <label htmlFor={id}>{champ.libelle}{!champ.obligatoire && <span className="facultatif"> (facultatif)</span>}</label>
      {saisie}
    </div>
  );
}

function NouvelleDemande({ extension, onEnvoyee }) {
  const champs = extension.configuration?.champs || [];
  const [valeurs, setValeurs] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function envoyer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post(`/extensions/${extension.cle}/demandes`, { valeurs });
      setValeurs({});
      setConfirmation(res.data.message);
      onEnvoyee();
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'envoyer la demande"));
    } finally {
      setEnCours(false);
    }
  }

  if (confirmation) {
    return (
      <div className="carte demande-envoyee">
        <span className="demande-envoyee-icone"><IconCircleCheck /></span>
        <div>
          <strong>Demande envoyée</strong>
          <p>{confirmation}</p>
        </div>
        <button className="secondaire" onClick={() => setConfirmation('')}>Nouvelle demande</button>
      </div>
    );
  }

  return (
    <div className="carte">
      <div className="entete-carte"><h2>Nouvelle demande</h2></div>
      <form className="formulaire formulaire-extension" onSubmit={envoyer}>
        {champs.map((c) => (
          <ChampValeur key={c.id} champ={c} valeur={valeurs[c.id]} onChange={(v) => setValeurs((x) => ({ ...x, [c.id]: v }))} />
        ))}
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="actions-carte">
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Envoi…' : "Envoyer à l'Académie"}</button>
        </div>
      </form>
    </div>
  );
}

function valeurLisible(champ, valeur) {
  if (!valeur) return '';
  if (champ?.type === 'date') return dateCourte(valeur);
  return valeur;
}

function DetailDemande({ champs, demande }) {
  return (
    <dl className="details-extension">
      {champs.map((c) => (
        <div key={c.id} className="details-ligne">
          <dt>{c.libelle}</dt>
          <dd>{valeurLisible(c, demande.donnees[c.id]) || <span className="note-secondaire">Non renseigné</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function MesDemandes({ extension, demandes }) {
  const champs = extension.configuration?.champs || [];
  const [ouverte, setOuverte] = useState(null);
  const principal = champs[0];
  return (
    <div className="carte">
      <div className="entete-carte"><h2>Mes demandes</h2></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Envoyée le</th><th>{principal?.libelle || 'Demande'}</th><th>Statut</th><th>Réponse de l'Académie</th><th aria-label="Détail" /></tr></thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d.id} className="ligne-cliquable" onClick={() => setOuverte(d)}>
                <td className="cellule-date">{dateHeure(d.createdAt)}</td>
                <td>{valeurLisible(principal, d.donnees[principal?.id]) || '-'}</td>
                <td><span className={`badge ${STATUTS_DEMANDE[d.statut]?.badge}`}>{STATUTS_DEMANDE[d.statut]?.libelle}</span></td>
                <td className="cellule-description">{d.reponseAcademie || <span className="note-secondaire">Pas encore de réponse</span>}</td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {demandes.length === 0 && <tr><td colSpan={5} className="vide">Vous n'avez encore envoyé aucune demande.</td></tr>}
          </tbody>
        </table>
      </div>
      {ouverte && (
        <Modal titre={`Demande du ${dateCourte(ouverte.createdAt)}`} onFermer={() => setOuverte(null)} largeur={560}>
          <div style={{ marginBottom: 14 }}>
            <span className={`badge ${STATUTS_DEMANDE[ouverte.statut]?.badge}`}>{STATUTS_DEMANDE[ouverte.statut]?.libelle}</span>
          </div>
          <DetailDemande champs={champs} demande={ouverte} />
          {ouverte.reponseAcademie && (
            <div className="reponse-academie"><strong>Réponse de l'Académie</strong><p>{ouverte.reponseAcademie}</p></div>
          )}
        </Modal>
      )}
    </div>
  );
}

function DemandesRecues({ extension, demandes, onChange }) {
  const champs = extension.configuration?.champs || [];
  const [filtre, setFiltre] = useState('');
  const [ouverteId, setOuverteId] = useState(null);
  const [toast, setToast] = useState(null);
  const principal = champs[0];
  const compte = (s) => demandes.filter((d) => d.statut === s).length;
  const affichees = filtre ? demandes.filter((d) => d.statut === filtre) : demandes;
  const ouverte = demandes.find((d) => d.id === ouverteId);

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Demandes reçues</h2>
        <span className="badge bleu">{compte('nouvelle')} à traiter</span>
      </div>
      <p className="note-secondaire texte-aide">
        Envoyées depuis l'onglet « {extension.nom} ». Le demandeur est notifié à chaque changement de statut et lit
        votre réponse dans son espace.
      </p>
      <div className="barre-outils">
        <div className="filtres-puces" role="group" aria-label="Filtrer les demandes">
          <button className={filtre === '' ? 'actif' : ''} onClick={() => setFiltre('')}>Toutes ({demandes.length})</button>
          {Object.entries(STATUTS_DEMANDE).map(([id, s]) => (
            <button key={id} className={filtre === id ? 'actif' : ''} onClick={() => setFiltre(id)}>{s.pluriel} ({compte(id)})</button>
          ))}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Reçue le</th><th>Demandeur</th><th>Espace</th><th>{principal?.libelle || 'Demande'}</th><th>Statut</th><th aria-label="Traiter" /></tr></thead>
          <tbody>
            {affichees.map((d) => (
              <tr key={d.id} className="ligne-cliquable" onClick={() => setOuverteId(d.id)}>
                <td className="cellule-date">{dateHeure(d.createdAt)}</td>
                <td>{d.auteurNom}</td>
                <td>{LIBELLES_AUTEURS[d.auteurEspace] || d.auteurEspace}</td>
                <td>{valeurLisible(principal, d.donnees[principal?.id]) || '-'}</td>
                <td><span className={`badge ${STATUTS_DEMANDE[d.statut]?.badge}`}>{STATUTS_DEMANDE[d.statut]?.libelle}</span></td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {affichees.length === 0 && (
              <tr><td colSpan={6} className="vide">{demandes.length ? 'Aucune demande dans ce filtre.' : 'Aucune demande reçue pour le moment.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {ouverte && (
        <TraitementDemande
          extension={extension}
          demande={ouverte}
          onFermer={() => setOuverteId(null)}
          onEnregistree={() => { setToast({ message: 'Demande mise à jour, le demandeur est prévenu.', type: 'succes' }); onChange(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function TraitementDemande({ extension, demande, onFermer, onEnregistree }) {
  const [statut, setStatut] = useState(demande.statut);
  const [reponse, setReponse] = useState(demande.reponseAcademie || '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const modifie = statut !== demande.statut || reponse.trim() !== (demande.reponseAcademie || '');

  async function enregistrer() {
    setEnCours(true);
    setErreur('');
    try {
      await client.put(`/extensions/${extension.cle}/demandes/${demande.id}`, { statut, reponseAcademie: reponse });
      onEnregistree();
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Tiroir
      titre={demande.auteurNom}
      sousTitre={`${LIBELLES_AUTEURS[demande.auteurEspace] || ''}, demande du ${dateHeure(demande.createdAt)}`}
      icone={<span className="tuile-fonctionnalite personnalisee"><IconInbox /></span>}
      onFermer={onFermer}
      pied={<button className="primaire" onClick={enregistrer} disabled={!modifie || enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>}
    >
      <section className="tiroir-section">
        <h3 className="tiroir-section-titre">Contenu de la demande</h3>
        <DetailDemande champs={extension.configuration?.champs || []} demande={demande} />
      </section>
      <section className="tiroir-section">
        <h3 className="tiroir-section-titre">Traitement</h3>
        <div className="formulaire">
          <div className="champ">
            <label htmlFor="statut-demande">Statut</label>
            <select id="statut-demande" value={statut} onChange={(e) => setStatut(e.target.value)}>
              {Object.entries(STATUTS_DEMANDE).map(([id, s]) => <option key={id} value={id}>{s.libelle}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="reponse-demande">Réponse au demandeur (facultatif)</label>
            <textarea id="reponse-demande" rows={4} maxLength={1000} value={reponse} onChange={(e) => setReponse(e.target.value)}
              placeholder="Ex. Votre attestation est prête, à retirer au secrétariat." />
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
      </section>
    </Tiroir>
  );
}

// ---- Registre -------------------------------------------------------------

function CelluleRegistre({ colonne, valeur }) {
  if (!valeur) return <span className="note-secondaire">-</span>;
  if (colonne.type === 'lien') {
    return (
      <a href={valeur} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="lien-registre">
        Ouvrir <IconExternal width={13} height={13} />
      </a>
    );
  }
  if (colonne.type === 'date') return dateCourte(valeur);
  return valeur;
}

function ExtensionRegistre({ extension }) {
  const { donnees, erreur, charger } = useDonneesExtension(extension.cle);
  const colonnes = extension.configuration?.colonnes || [];
  const [recherche, setRecherche] = useState('');
  const [edition, setEdition] = useState(null); // null | {} (ajout) | { element }
  const [toast, setToast] = useState(null);

  const affiches = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    const elements = donnees?.elements || [];
    return texte ? elements.filter((e) => Object.values(e.donnees).join(' ').toLowerCase().includes(texte)) : elements;
  }, [donnees, recherche]);

  if (erreur) return <div className="message-erreur">{erreur}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>{extension.nom} ({donnees.elements.length})</h2>
        {extension.gestion && <button className="primaire" onClick={() => setEdition({})}><IconPlus /> Ajouter une ligne</button>}
      </div>
      {extension.gestion && (
        <p className="note-secondaire texte-aide">
          Chaque ligne ajoutée apparaît aussitôt dans les espaces qui consultent ce registre. Cliquez sur une ligne pour la modifier.
        </p>
      )}
      <div className="barre-outils">
        <label className="champ-recherche">
          <IconSearch />
          <input placeholder="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {colonnes.map((c) => <th key={c.id}>{c.libelle}</th>)}
              {extension.gestion && <th aria-label="Modifier" />}
            </tr>
          </thead>
          <tbody>
            {affiches.map((e) => (
              <tr key={e.id} className={extension.gestion ? 'ligne-cliquable' : ''} onClick={extension.gestion ? () => setEdition({ element: e }) : undefined}>
                {colonnes.map((c) => (
                  <td key={c.id} className={c.type === 'long' ? 'cellule-description' : c.type === 'date' ? 'cellule-date' : ''}>
                    <CelluleRegistre colonne={c} valeur={e.donnees[c.id]} />
                  </td>
                ))}
                {extension.gestion && <td className="cellule-chevron"><IconChevronRight /></td>}
              </tr>
            ))}
            {affiches.length === 0 && (
              <tr>
                <td colSpan={colonnes.length + (extension.gestion ? 1 : 0)} className="vide">
                  {donnees.elements.length ? 'Aucune ligne ne correspond à la recherche.' : 'Le registre est vide pour le moment.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {edition && (
        <EditionLigne
          extension={extension}
          element={edition.element}
          onFermer={() => setEdition(null)}
          onFait={(message) => { setEdition(null); setToast({ message, type: 'succes' }); charger(); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function EditionLigne({ extension, element, onFermer, onFait }) {
  const colonnes = (extension.configuration?.colonnes || []).map((c) => ({ ...c, obligatoire: false }));
  const [valeurs, setValeurs] = useState(element?.donnees || {});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [suppression, setSuppression] = useState(false);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      if (element) await client.put(`/extensions/${extension.cle}/elements/${element.id}`, { valeurs });
      else await client.post(`/extensions/${extension.cle}/elements`, { valeurs });
      onFait(element ? 'Ligne modifiée.' : 'Ligne ajoutée au registre.');
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer la ligne"));
      setEnCours(false);
    }
  }

  async function supprimer() {
    await client.delete(`/extensions/${extension.cle}/elements/${element.id}`);
    onFait('Ligne supprimée.');
  }

  return (
    <>
      <Modal titre={element ? 'Modifier la ligne' : 'Nouvelle ligne'} onFermer={onFermer} largeur={560}>
        <form className="formulaire" onSubmit={enregistrer}>
          {colonnes.map((c) => (
            <ChampValeur key={c.id} champ={c} valeur={valeurs[c.id]} onChange={(v) => setValeurs((x) => ({ ...x, [c.id]: v }))} />
          ))}
          {erreur && <div className="message-erreur">{erreur}</div>}
          <div className="confirmation-actions">
            {element && (
              <button type="button" className="secondaire danger" onClick={() => setSuppression(true)} style={{ marginRight: 'auto' }}>
                <IconTrash /> Supprimer
              </button>
            )}
            <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
            <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : element ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </form>
      </Modal>
      {suppression && (
        <ConfirmModal titre="Supprimer cette ligne ?" boutonConfirmer="Supprimer" onConfirmer={supprimer} onAnnuler={() => setSuppression(false)}>
          Elle disparaîtra du registre dans tous les espaces.
        </ConfirmModal>
      )}
    </>
  );
}
