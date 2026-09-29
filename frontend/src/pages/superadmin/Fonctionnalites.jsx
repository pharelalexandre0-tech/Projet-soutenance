import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { LIBELLES_ESPACES, ESPACES_NOTES } from '../../utils/plateforme';
import {
  IconSearch, IconPlus, IconCheck, IconChevronRight, IconInfo, IconEdit, IconTrash, IconExternal,
  IconeFonctionnalite, ICONES_FONCTIONNALITES,
} from '../../components/icons';

export const LIBELLES_TYPES = {
  module: 'Module intégré',
  page: "Page d'information",
  lien: 'Service en ligne',
  assistant: 'Assistant (chatbot)',
  formulaire: 'Formulaire de demande',
  registre: 'Registre',
};

const FILTRES = [
  { id: '', libelle: 'Toutes' },
  { id: 'integree', libelle: 'Modules intégrés' },
  { id: 'personnalisee', libelle: 'Personnalisées' },
];

export function TuileFonctionnalite({ fonctionnalite, grande = false }) {
  return (
    <span className={`tuile-fonctionnalite ${fonctionnalite.integree ? '' : 'personnalisee'} ${grande ? 'grande' : ''}`}>
      <IconeFonctionnalite nom={fonctionnalite.icone} />
    </span>
  );
}

// Catalogue de toutes les fonctionnalités de la plateforme. Aucune n'est
// imposée à toutes les écoles : chacune s'ajoute école par école (ici,
// depuis sa fiche, ou depuis la fiche de l'école dans "Établissements").
// Les fonctionnalités personnalisées existantes se modifient ou se
// suppriment ici ; on n'en crée plus depuis l'application.
export default function Fonctionnalites() {
  const [donnees, setDonnees] = useState(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState(null); // clé de la fonctionnalité affichée dans le tiroir
  const [enModification, setEnModification] = useState(null); // fonctionnalité en cours de modification
  const [toast, setToast] = useState(null);

  function charger() {
    return client.get('/superadmin/fonctionnalites')
      .then((res) => setDonnees(res.data))
      .catch((err) => setErreurChargement(messageErreur(err, 'impossible de charger les fonctionnalités')));
  }
  useEffect(() => { charger(); }, []);
  useActualisation(charger);

  const affichees = useMemo(() => {
    if (!donnees) return [];
    const texte = recherche.trim().toLowerCase();
    return donnees.fonctionnalites.filter((f) => (!filtre || (filtre === 'integree' ? f.integree : !f.integree))
      && (!texte || `${f.nom} ${f.description}`.toLowerCase().includes(texte)));
  }, [donnees, filtre, recherche]);

  if (erreurChargement) return <div className="message-erreur">{erreurChargement}</div>;
  if (!donnees) return <div className="chargement">Chargement…</div>;

  const totalEcoles = donnees.ecoles.length;
  const fonctionnaliteOuverte = donnees.fonctionnalites.find((f) => f.cle === ouverte);
  const compte = (id) => donnees.fonctionnalites.filter((f) => (!id || (id === 'integree' ? f.integree : !f.integree))).length;

  return (
    <>
      <div className="carte">
        <div className="entete-carte">
          <h2>Catalogue</h2>
        </div>

        <div className="encart-info" style={{ marginBottom: 16 }}>
          <IconInfo />
          <span>
            Chaque école ne reçoit que les fonctionnalités que tu lui ajoutes. Les <strong>modules intégrés</strong> font
            partie du code d'EduSphere : ouvre leur fiche pour les ajouter aux écoles qui en ont besoin. Les
            fonctionnalités <strong>personnalisées</strong> (assistant, formulaire de demande, registre, page
            d'information ou service en ligne) apparaissent comme un onglet dans les espaces choisis : ouvre leur fiche
            pour les attribuer, les modifier ou les supprimer.
          </span>
        </div>

        <div className="barre-outils">
          <div className="filtres-puces" role="group" aria-label="Filtrer le catalogue">
            {FILTRES.map((f) => (
              <button key={f.id} className={filtre === f.id ? 'actif' : ''} onClick={() => setFiltre(f.id)}>
                {f.libelle} ({compte(f.id)})
              </button>
            ))}
          </div>
          <div className="espaceur" />
          <label className="champ-recherche">
            <IconSearch />
            <input placeholder="Rechercher une fonctionnalité" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
        </div>

        <div className="table-scroll">
          <table>
            <thead><tr><th>Fonctionnalité</th><th>Description</th><th>Type</th><th>Espaces</th><th>Écoles</th><th aria-label="Ouvrir la fiche" /></tr></thead>
            <tbody>
              {affichees.map((f) => (
                <tr key={f.cle} className="ligne-cliquable" onClick={() => setOuverte(f.cle)}>
                  <td className="cellule-nom"><span className="cellule-avec-logo"><TuileFonctionnalite fonctionnalite={f} />{f.nom}</span></td>
                  <td className="cellule-description">{f.description}</td>
                  <td><span className={`badge sans-point ${f.integree ? 'bleu' : 'gris'}`}>{LIBELLES_TYPES[f.type]}</span></td>
                  <td><div className="puces">{f.espaces.map((e) => <span key={e} className="puce">{LIBELLES_ESPACES[e] || e}</span>)}</div></td>
                  <td>
                    <div className="jauge-ecoles">
                      <div className="jauge-ecoles-piste"><span style={{ width: `${totalEcoles ? (f.ecoles.length / totalEcoles) * 100 : 0}%` }} /></div>
                      <strong>{f.ecoles.length} / {totalEcoles}</strong>
                    </div>
                  </td>
                  <td className="cellule-chevron"><IconChevronRight /></td>
                </tr>
              ))}
              {affichees.length === 0 && (
                <tr><td colSpan={6} className="vide">{donnees.fonctionnalites.length === 0 ? 'Le catalogue est vide.' : 'Aucune fonctionnalité ne correspond à ce filtre.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {fonctionnaliteOuverte && (
        <GestionFonctionnalite
          fonctionnalite={fonctionnaliteOuverte}
          ecoles={donnees.ecoles}
          onFermer={() => setOuverte(null)}
          onModifier={() => setEnModification(fonctionnaliteOuverte)}
          onMisAJour={(nouvellesDonnees, message) => {
            if (nouvellesDonnees) setDonnees(nouvellesDonnees);
            else charger();
            setToast({ message, type: 'succes' });
          }}
          onSupprimee={(nom) => {
            setOuverte(null);
            charger();
            setToast({ message: `« ${nom} » a été supprimée.`, type: 'succes' });
          }}
        />
      )}

      {enModification && (
        <FormulaireFonctionnalite
          fonctionnalite={enModification}
          icones={donnees.icones}
          onFermer={() => setEnModification(null)}
          onEnregistree={(f) => {
            setEnModification(null);
            charger();
            setToast({ message: `« ${f.nom} » a été modifiée.`, type: 'succes' });
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function GestionFonctionnalite({ fonctionnalite: f, ecoles, onFermer, onModifier, onMisAJour, onSupprimee }) {
  const [choix, setChoix] = useState(f.ecoles);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  useEffect(() => setChoix(f.ecoles), [f]);

  const modifie = choix.length !== f.ecoles.length || choix.some((id) => !f.ecoles.includes(id));

  function basculer(id) {
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function enregistrerEcoles() {
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.put(`/superadmin/fonctionnalites/${f.cle}/ecoles`, { ecoles: choix });
      onMisAJour(res.data, `Écoles de « ${f.nom} » mises à jour.`);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer les écoles"));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    await client.delete(`/superadmin/fonctionnalites/${f.cle}`);
    setConfirmationSuppression(false);
    onSupprimee(f.nom);
  }

  return (
    <>
      <Tiroir
        titre={f.nom}
        sousTitre={LIBELLES_TYPES[f.type]}
        icone={<TuileFonctionnalite fonctionnalite={f} />}
        onFermer={onFermer}
        pied={(
          <>
            {!f.integree && (
              <>
                <button className="secondaire danger" onClick={() => setConfirmationSuppression(true)}><IconTrash /> Supprimer</button>
                <button className="secondaire" onClick={onModifier} style={{ marginRight: 'auto' }}><IconEdit /> Modifier</button>
              </>
            )}
            <button className="primaire" onClick={enregistrerEcoles} disabled={!modifie || enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer les écoles'}
            </button>
          </>
        )}
      >
        <section className="tiroir-section">
          <p style={{ margin: 0, lineHeight: 1.6 }}>{f.description}</p>
        </section>

        <section className="tiroir-section">
          <h3 className="tiroir-section-titre">Espaces où elle apparaît</h3>
          <div className="puces">{f.espaces.map((e) => <span key={e} className="puce">{LIBELLES_ESPACES[e] || e}</span>)}</div>
        </section>

        {f.type === 'lien' && (
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Service ouvert</h3>
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere' }}>
              {f.url} <IconExternal width={14} height={14} />
            </a>
            <p className="note-secondaire" style={{ margin: '6px 0 0', fontSize: 13 }}>Bouton affiché : « {f.libelleBouton} »</p>
          </section>
        )}
        {f.type === 'assistant' && f.configuration && (
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Ce que l'assistant sait ({f.configuration.questions.length} réponses)</h3>
            <ul className="liste-reglages">
              {f.configuration.questions.map((q) => <li key={q.question}>{q.question}</li>)}
            </ul>
          </section>
        )}
        {f.type === 'formulaire' && f.configuration && (
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Champs du formulaire</h3>
            <ul className="liste-reglages">
              {f.configuration.champs.map((c) => (
                <li key={c.id}>{c.libelle} <span className="note-secondaire">({LIBELLES_CHAMPS[c.type]}{c.obligatoire ? ', obligatoire' : ''})</span></li>
              ))}
            </ul>
            <p className="note-secondaire" style={{ margin: '8px 0 0', fontSize: 13 }}>Les demandes arrivent dans l'onglet du même nom de l'espace Académie.</p>
          </section>
        )}
        {f.type === 'registre' && f.configuration && (
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Colonnes du registre</h3>
            <div className="puces">{f.configuration.colonnes.map((c) => <span key={c.id} className="puce">{c.libelle}</span>)}</div>
            <p className="note-secondaire" style={{ margin: '8px 0 0', fontSize: 13 }}>Tenu par l'Académie, consulté dans les espaces choisis.</p>
          </section>
        )}
        {f.type === 'page' && (
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Contenu de la page</h3>
            <div style={{ whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.65, maxHeight: 220, overflowY: 'auto', padding: 12, border: '1px solid var(--bordure)', borderRadius: 10 }}>
              {f.contenu}
            </div>
          </section>
        )}

        <section className="tiroir-section">
          <div className="entete-section">
            <h3 className="tiroir-section-titre" style={{ margin: 0 }}>Écoles équipées ({choix.length} / {ecoles.length})</h3>
            {ecoles.length > 0 && (
              <button type="button" className="bouton-texte" onClick={() => setChoix(choix.length === ecoles.length ? [] : ecoles.map((e) => e.id))}>
                {choix.length === ecoles.length ? 'Tout retirer' : 'Tout sélectionner'}
              </button>
            )}
          </div>
          {ecoles.length === 0 && <div className="vide">Aucune école affiliée pour l'instant.</div>}
          <div className="liste-selection">
            {ecoles.map((e) => {
              const choisie = choix.includes(e.id);
              return (
                <button key={e.id} type="button" className={`option-selection ${choisie ? 'choisie' : ''}`} onClick={() => basculer(e.id)} aria-pressed={choisie}>
                  <span className="case-choix-coche">{choisie && <IconCheck />}</span>
                  <span className="textes">
                    <strong>{e.nom}</strong>
                    <small>{e.ville}{e.statut === 'suspendu' ? ', école verrouillée' : ''}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {erreur && <div className="message-erreur" style={{ marginTop: 12 }}>{erreur}</div>}
        </section>
      </Tiroir>

      {confirmationSuppression && (
        <ConfirmModal
          titre={`Supprimer « ${f.nom} » ?`}
          boutonConfirmer="Supprimer"
          onConfirmer={supprimer}
          onAnnuler={() => setConfirmationSuppression(false)}
        >
          L'onglet disparaîtra des {f.ecoles.length} école{f.ecoles.length > 1 ? 's' : ''} qui l'utilisent. Cette action est définitive.
        </ConfirmModal>
      )}
    </>
  );
}

const LIBELLES_CHAMPS = {
  texte: 'Texte court', long: 'Texte long', nombre: 'Nombre', date: 'Date', choix: 'Liste de choix', email: 'E-mail', telephone: 'Téléphone', lien: 'Lien',
};
const TYPES_CHAMPS = ['texte', 'long', 'nombre', 'date', 'choix', 'email', 'telephone'];
const TYPES_COLONNES = ['texte', 'long', 'nombre', 'date', 'lien'];

// Réglages mis en forme pour l'édition (listes saisies séparées par des
// virgules) ; le serveur accepte les deux formes.
function configurationEditable(type, configuration) {
  if (type === 'assistant') {
    return {
      accueil: configuration?.accueil || '',
      questions: (configuration?.questions || [{ question: '', reponse: '', motsCles: [] }])
        .map((q) => ({ question: q.question, reponse: q.reponse, motsCles: (q.motsCles || []).join(', ') })),
    };
  }
  if (type === 'formulaire') {
    return {
      messageConfirmation: configuration?.messageConfirmation || '',
      champs: (configuration?.champs || [{ libelle: '', type: 'texte', obligatoire: true, options: [] }])
        .map((c) => ({ libelle: c.libelle, type: c.type, obligatoire: c.obligatoire, options: (c.options || []).join(', ') })),
    };
  }
  if (type === 'registre') {
    return { colonnes: (configuration?.colonnes || [{ libelle: '', type: 'texte' }]).map((c) => ({ libelle: c.libelle, type: c.type })) };
  }
  return null;
}

// Modification d'une fonctionnalité personnalisée existante (son type ne
// change pas).
function FormulaireFonctionnalite({ fonctionnalite, icones, onFermer, onEnregistree }) {
  const [form, setForm] = useState(() => ({
    type: fonctionnalite.type,
    nom: fonctionnalite.nom || '',
    description: fonctionnalite.description || '',
    icone: fonctionnalite.icone || 'FileText',
    espaces: fonctionnalite.espaces || ['etudiant'],
    contenu: fonctionnalite.contenu || '',
    url: fonctionnalite.url || '',
    libelleBouton: fonctionnalite.libelleBouton || '',
  }));
  const [reglages, setReglages] = useState(() => configurationEditable(fonctionnalite.type, fonctionnalite.configuration));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const basculer = (champ, valeur) => setForm((f) => ({
    ...f,
    [champ]: f[champ].includes(valeur) ? f[champ].filter((x) => x !== valeur) : [...f[champ], valeur],
  }));

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.put(`/superadmin/fonctionnalites/${fonctionnalite.cle}`, { ...form, configuration: reglages });
      onEnregistree(res.data.fonctionnalite);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'enregistrer cette fonctionnalité"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Modifier « ${fonctionnalite.nom} »`} onFermer={onFermer} largeur={720}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="champ">
          <label htmlFor="f-nom">Nom de l'onglet</label>
          <input id="f-nom" value={form.nom} onChange={(e) => maj('nom', e.target.value)} maxLength={80}
            placeholder={EXEMPLES_NOMS[form.type]} required />
        </div>
        <div className="champ">
          <label htmlFor="f-desc">Description</label>
          <input id="f-desc" value={form.description} onChange={(e) => maj('description', e.target.value)} maxLength={300}
            placeholder="Une phrase affichée sous le titre de l'onglet" required />
        </div>

        <div className="champ">
          <label>Icône</label>
          <div className="grille-icones">
            {icones.map((nom) => {
              const Icone = ICONES_FONCTIONNALITES[nom];
              return (
                <button key={nom} type="button" className={`option-icone ${form.icone === nom ? 'choisie' : ''}`} onClick={() => maj('icone', nom)} aria-label={nom} aria-pressed={form.icone === nom}>
                  {Icone && <Icone />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="champ">
          <label>Espaces où l'onglet apparaît</label>
          <div className="cases-choix">
            {ESPACES_NOTES.map((e) => {
              const choisi = form.espaces.includes(e);
              return (
                <button key={e} type="button" className={`case-choix ${choisi ? 'choisie' : ''}`} onClick={() => basculer('espaces', e)} aria-pressed={choisi}>
                  <span className="case-choix-coche">{choisi && <IconCheck />}</span>
                  <span>{LIBELLES_ESPACES[e]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {form.type === 'assistant' && <EditeurAssistant valeur={reglages} onChange={setReglages} />}
        {form.type === 'formulaire' && <EditeurFormulaire valeur={reglages} onChange={setReglages} />}
        {form.type === 'registre' && <EditeurRegistre valeur={reglages} onChange={setReglages} />}
        {form.type === 'page' && (
          <div className="champ">
            <label htmlFor="f-contenu">Contenu de la page</label>
            <textarea id="f-contenu" rows={8} maxLength={8000} value={form.contenu} onChange={(e) => maj('contenu', e.target.value)}
              placeholder="Le texte affiché dans l'onglet. Les retours à la ligne sont conservés." required />
          </div>
        )}
        {form.type === 'lien' && (
          <div className="ligne-champs">
            <div className="champ" style={{ flex: 2 }}>
              <label htmlFor="f-url">Adresse du service</label>
              <input id="f-url" type="url" value={form.url} onChange={(e) => maj('url', e.target.value)} placeholder="https://" required />
            </div>
            <div className="champ">
              <label htmlFor="f-bouton">Texte du bouton</label>
              <input id="f-bouton" value={form.libelleBouton} onChange={(e) => maj('libelleBouton', e.target.value)} maxLength={60} placeholder="Ouvrir le service" />
            </div>
          </div>
        )}

        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const EXEMPLES_NOMS = {
  assistant: 'Ex. Assistant de scolarité',
  formulaire: 'Ex. Demande de document',
  registre: 'Ex. Offres de stage',
  page: 'Ex. Règlement intérieur',
  lien: 'Ex. Bibliothèque numérique',
};

// Petite liste éditable : une carte par élément, ajout et retrait.
function ListeEditable({ titre, elements, nouveau, max, libelleAjout, onChange, rendu }) {
  const modifier = (i, champ, v) => onChange(elements.map((e, j) => (j === i ? { ...e, [champ]: v } : e)));
  return (
    <div className="champ">
      <label>{titre} ({elements.length}/{max})</label>
      <div className="editeur-lignes">
        {elements.map((e, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="editeur-ligne">
            <div className="editeur-ligne-entete">
              <strong>N° {i + 1}</strong>
              {elements.length > 1 && (
                <button type="button" className="bouton-icone" aria-label="Retirer" onClick={() => onChange(elements.filter((_, j) => j !== i))}>
                  <IconTrash />
                </button>
              )}
            </div>
            {rendu(e, (champ, v) => modifier(i, champ, v))}
          </div>
        ))}
      </div>
      {elements.length < max && (
        <button type="button" className="secondaire" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={() => onChange([...elements, nouveau])}>
          <IconPlus /> {libelleAjout}
        </button>
      )}
    </div>
  );
}

function EditeurAssistant({ valeur, onChange }) {
  return (
    <>
      <div className="champ">
        <label htmlFor="f-accueil">Message d'accueil</label>
        <textarea id="f-accueil" rows={2} maxLength={300} value={valeur.accueil} onChange={(e) => onChange({ ...valeur, accueil: e.target.value })}
          placeholder="Bonjour, je suis l'assistant de l'école. Posez-moi votre question." />
      </div>
      <ListeEditable
        titre="Questions et réponses"
        elements={valeur.questions}
        nouveau={{ question: '', reponse: '', motsCles: '' }}
        max={60}
        libelleAjout="Ajouter une question"
        onChange={(questions) => onChange({ ...valeur, questions })}
        rendu={(q, maj) => (
          <>
            <input value={q.question} onChange={(e) => maj('question', e.target.value)} maxLength={200} placeholder="Question, ex. Quand ont lieu les examens ?" aria-label="Question" />
            <textarea rows={3} value={q.reponse} onChange={(e) => maj('reponse', e.target.value)} maxLength={2000} placeholder="Réponse donnée par l'assistant" aria-label="Réponse" />
            <input value={q.motsCles} onChange={(e) => maj('motsCles', e.target.value)} placeholder="Mots-clés séparés par des virgules, ex. examen, partiel, session" aria-label="Mots-clés" />
          </>
        )}
      />
    </>
  );
}

function EditeurFormulaire({ valeur, onChange }) {
  return (
    <>
      <ListeEditable
        titre="Champs à remplir"
        elements={valeur.champs}
        nouveau={{ libelle: '', type: 'texte', obligatoire: true, options: '' }}
        max={15}
        libelleAjout="Ajouter un champ"
        onChange={(champs) => onChange({ ...valeur, champs })}
        rendu={(c, maj) => (
          <>
            <div className="ligne-champs">
              <div className="champ" style={{ flex: 2 }}>
                <input value={c.libelle} onChange={(e) => maj('libelle', e.target.value)} maxLength={80} placeholder="Intitulé, ex. Document demandé" aria-label="Intitulé du champ" />
              </div>
              <div className="champ">
                <select value={c.type} onChange={(e) => maj('type', e.target.value)} aria-label="Type de champ">
                  {TYPES_CHAMPS.map((t) => <option key={t} value={t}>{LIBELLES_CHAMPS[t]}</option>)}
                </select>
              </div>
            </div>
            {c.type === 'choix' && (
              <input value={c.options} onChange={(e) => maj('options', e.target.value)} placeholder="Choix proposés, séparés par des virgules" aria-label="Choix proposés" />
            )}
            <label className="case-inline">
              <input type="checkbox" checked={c.obligatoire} onChange={(e) => maj('obligatoire', e.target.checked)} /> Obligatoire
            </label>
          </>
        )}
      />
      <div className="champ">
        <label htmlFor="f-confirmation">Message affiché après l'envoi (facultatif)</label>
        <input id="f-confirmation" maxLength={300} value={valeur.messageConfirmation} onChange={(e) => onChange({ ...valeur, messageConfirmation: e.target.value })}
          placeholder="Votre demande a bien été transmise à l'Académie." />
      </div>
    </>
  );
}

function EditeurRegistre({ valeur, onChange }) {
  return (
    <ListeEditable
      titre="Colonnes du registre"
      elements={valeur.colonnes}
      nouveau={{ libelle: '', type: 'texte' }}
      max={8}
      libelleAjout="Ajouter une colonne"
      onChange={(colonnes) => onChange({ ...valeur, colonnes })}
      rendu={(c, maj) => (
        <div className="ligne-champs">
          <div className="champ" style={{ flex: 2 }}>
            <input value={c.libelle} onChange={(e) => maj('libelle', e.target.value)} maxLength={60} placeholder="Intitulé, ex. Entreprise" aria-label="Intitulé de la colonne" />
          </div>
          <div className="champ">
            <select value={c.type} onChange={(e) => maj('type', e.target.value)} aria-label="Type de colonne">
              {TYPES_COLONNES.map((t) => <option key={t} value={t}>{LIBELLES_CHAMPS[t]}</option>)}
            </select>
          </div>
        </div>
      )}
    />
  );
}
