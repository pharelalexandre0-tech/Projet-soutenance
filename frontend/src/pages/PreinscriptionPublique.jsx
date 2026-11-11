import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import PagePublique from '../components/PagePublique';
import { messageErreur } from '../utils/erreurs';
import { IconCheck } from '../components/icons';

const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const SERIES_BAC = ['A1', 'A2', 'B', 'C', 'D', 'E', 'F', 'G1', 'G2', 'G3', 'Autre'];
const MENTIONS = ['Passable', 'Assez bien', 'Bien', 'Très bien'];
const ETAPES = ['Profil', 'Établissement', 'Identité', 'Parcours', 'Pièces', 'Vérification'];
const DESCRIPTIONS = {
  bachelier: 'Vous venez d’obtenir le baccalauréat et entrez en première année de Licence.',
  licence: 'Vous êtes déjà en Licence et entrez en deuxième ou troisième année, ou changez d’établissement.',
  master: 'Vous avez une Licence et candidatez en Master 1 ou en Master 2.',
};
const lireFichier = (f) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); });
const anneeCourante = new Date().getFullYear();

const VIDE = {
  profil: '', etablissementId: '', formationId: '', niveauDemande: '',
  nom: '', prenom: '', dateNaissance: '', sexe: '', nationalite: 'Gabonaise', villeResidence: '', email: '', telephone: '',
  serieBac: '', anneeDiplome: '', mentionDiplome: '', numeroTable: '', etablissementOrigine: '',
  filiereActuelle: '', dernierNiveauValide: '', creditsAcquis: '', specialiteLicence: '', moyenneDiplome: '', motivation: '', siteWeb: '',
};

// Candidature en ligne, en six étapes courtes. Le formulaire et les pièces
// demandées dépendent du profil : nouveau bachelier, étudiant en Licence ou
// candidat en Master. Le candidat suit ensuite son dossier avec son numéro.
export default function PreinscriptionPublique() {
  const [ref, setRef] = useState(null);
  const [etape, setEtape] = useState(0);
  const [form, setForm] = useState(VIDE);
  const [fichiers, setFichiers] = useState({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [depot, setDepot] = useState(null);

  useEffect(() => { client.get('/preinscriptions-publiques/offres').then((r) => setRef(r.data)).catch(() => setRef({ etablissements: [], profils: [], pieces: {} })); }, []);
  const maj = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErreur(''); };
  const profil = ref?.profils.find((p) => p.cle === form.profil);
  const ecole = ref?.etablissements.find((e) => String(e.id) === String(form.etablissementId));
  const formations = useMemo(() => (ecole?.formations || []).filter((f) => !profil || f.cycle === profil.cycle), [ecole, profil]);
  const piecesProfil = profil ? [...profil.pieces.obligatoires.map((t) => [t, true]), ...profil.pieces.facultatives.map((t) => [t, false])] : [];

  function choisirProfil(cle) {
    const p = ref.profils.find((x) => x.cle === cle);
    setForm({ ...form, profil: cle, niveauDemande: p.niveaux[0], formationId: '' });
    setFichiers({});
    setErreur('');
  }

  // Contrôle de l'étape avant de passer à la suivante.
  function verifier(i) {
    if (i === 0 && !form.profil) return 'choisissez votre profil';
    if (i === 1 && !form.etablissementId) return 'choisissez l’établissement';
    if (i === 2) {
      if (!form.nom.trim() || !form.prenom.trim()) return 'indiquez votre nom et votre prénom';
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'indiquez une adresse e-mail valide : toutes les réponses y seront envoyées';
    }
    if (i === 3) {
      if (form.profil === 'bachelier' && (!form.serieBac || !form.anneeDiplome)) return 'indiquez la série et l’année du baccalauréat';
      if (form.profil === 'licence' && (!form.etablissementOrigine.trim() || !form.dernierNiveauValide)) return 'indiquez votre établissement actuel et le dernier niveau validé';
      if (form.profil === 'master' && (!form.specialiteLicence.trim() || !form.anneeDiplome)) return 'indiquez la spécialité et l’année de votre Licence';
    }
    if (i === 4) {
      const manque = piecesProfil.filter(([t, obligatoire]) => obligatoire && !fichiers[t]);
      if (manque.length) return `ajoutez les pièces obligatoires : ${manque.map(([t]) => ref.pieces[t].toLowerCase()).join(', ')}`;
      const tropGros = Object.values(fichiers).find((f) => f && f.size > 2 * 1024 * 1024);
      if (tropGros) return `le fichier « ${tropGros.name} » dépasse 2 Mo`;
    }
    return '';
  }
  function suivant() {
    const e = verifier(etape);
    if (e) { setErreur(e); return; }
    setErreur('');
    setEtape(etape + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function envoyer() {
    setEnCours(true);
    setErreur('');
    try {
      const pieces = [];
      for (const [type, f] of Object.entries(fichiers)) if (f) pieces.push({ type, nomFichier: f.name, contenu: await lireFichier(f) });
      const r = await client.post('/preinscriptions-publiques', { ...form, pieces });
      setDepot({ numero: r.data.numero, email: form.email.trim(), ecole: ecole?.nom });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErreur(err.response ? messageErreur(err, 'l’envoi a échoué') : err.message);
    } finally {
      setEnCours(false);
    }
  }

  if (depot) return <Confirmation depot={depot} />;

  return (
    <PagePublique surtitre="Candidature" titre="Candidater en ligne" introduction="Déposez votre dossier sans vous déplacer. Vous recevez un numéro de dossier pour suivre chaque étape, jusqu’à votre inscription." retour="Retour à l’accueil">
      <div className="candidature">
        <ol className="candidature-etapes" aria-label="Étapes de la candidature">
          {ETAPES.map((e, i) => (
            <li key={e} className={i < etape ? 'faite' : i === etape ? 'active' : ''} aria-current={i === etape ? 'step' : undefined}>
              <span className="candidature-etape-num">{i < etape ? <IconCheck width={14} height={14} /> : i + 1}</span>
              <span className="candidature-etape-nom">{e}</span>
            </li>
          ))}
        </ol>

        <div className="carte formulaire candidature-carte">
          {!ref && <div className="chargement">Chargement…</div>}
          {ref && ref.etablissements.length === 0 && (
            <div className="vide">Aucun établissement n’a encore ouvert ses candidatures en ligne. Revenez bientôt ou contactez directement l’établissement.</div>
          )}

          {ref && ref.etablissements.length > 0 && etape === 0 && (
            <>
              <h2>Quel est votre profil ?</h2>
              <div className="profil-choix" role="radiogroup" aria-label="Profil du candidat">
                {ref.profils.map((p) => (
                  <button key={p.cle} type="button" role="radio" aria-checked={form.profil === p.cle} className={`profil-carte ${form.profil === p.cle ? 'choisi' : ''}`} onClick={() => choisirProfil(p.cle)}>
                    <strong>{p.libelle}</strong>
                    <span>{DESCRIPTIONS[p.cle]}</span>
                    <small>{p.niveaux.join(' ou ')}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {etape === 1 && (
            <>
              <h2>Établissement et formation</h2>
              <div className="champ"><label htmlFor="c-ecole">Établissement</label>
                <select id="c-ecole" value={form.etablissementId} onChange={(e) => setForm({ ...form, etablissementId: e.target.value, formationId: '' })}>
                  <option value="">Choisir un établissement</option>
                  {ref.etablissements.map((o) => <option key={o.id} value={o.id}>{o.nom}{o.ville ? ` (${o.ville})` : ''}</option>)}
                </select>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-niveau">Niveau demandé</label>
                  <select id="c-niveau" value={form.niveauDemande} onChange={maj('niveauDemande')}>{profil.niveaux.map((n) => <option key={n}>{n}</option>)}</select>
                </div>
                {formations.length > 0 && (
                  <div className="champ"><label htmlFor="c-formation">Formation souhaitée</label>
                    <select id="c-formation" value={form.formationId} onChange={maj('formationId')}>
                      <option value="">Je ne sais pas encore</option>
                      {formations.map((f) => <option key={f.id} value={f.id}>{CYCLES[f.cycle]} {f.mention}{f.parcours ? `, ${f.parcours}` : ''}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {etape === 2 && (
            <>
              <h2>Votre identité</h2>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-nom">Nom</label><input id="c-nom" autoComplete="family-name" value={form.nom} onChange={maj('nom')} /></div>
                <div className="champ"><label htmlFor="c-prenom">Prénom(s)</label><input id="c-prenom" autoComplete="given-name" value={form.prenom} onChange={maj('prenom')} /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-naiss">Date de naissance</label><input id="c-naiss" type="date" value={form.dateNaissance} onChange={maj('dateNaissance')} /></div>
                <div className="champ"><label htmlFor="c-sexe">Sexe</label><select id="c-sexe" value={form.sexe} onChange={maj('sexe')}><option value="">Non précisé</option><option value="F">Féminin</option><option value="M">Masculin</option></select></div>
                <div className="champ"><label htmlFor="c-nat">Nationalité</label><input id="c-nat" value={form.nationalite} onChange={maj('nationalite')} /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-mail">E-mail</label><input id="c-mail" type="email" autoComplete="email" placeholder="prenom.nom@gmail.com" value={form.email} onChange={maj('email')} /></div>
                <div className="champ"><label htmlFor="c-tel">Téléphone</label><input id="c-tel" inputMode="tel" autoComplete="tel" placeholder="077 12 34 56" value={form.telephone} onChange={maj('telephone')} /></div>
                <div className="champ"><label htmlFor="c-ville">Ville de résidence</label><input id="c-ville" value={form.villeResidence} onChange={maj('villeResidence')} /></div>
              </div>
              <p className="note-secondaire" style={{ margin: 0 }}>Toutes les réponses de l’établissement seront envoyées à cette adresse e-mail.</p>
            </>
          )}

          {etape === 3 && form.profil === 'bachelier' && (
            <>
              <h2>Votre baccalauréat</h2>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-serie">Série</label><select id="c-serie" value={form.serieBac} onChange={maj('serieBac')}><option value="">Choisir</option>{SERIES_BAC.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="champ"><label htmlFor="c-an">Année d’obtention</label><select id="c-an" value={form.anneeDiplome} onChange={maj('anneeDiplome')}><option value="">Choisir</option>{Array.from({ length: 6 }, (_, i) => String(anneeCourante - i)).map((a) => <option key={a}>{a}</option>)}</select></div>
                <div className="champ"><label htmlFor="c-mention">Mention</label><select id="c-mention" value={form.mentionDiplome} onChange={maj('mentionDiplome')}><option value="">Sans mention</option>{MENTIONS.map((m) => <option key={m}>{m}</option>)}</select></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-table">Numéro de table</label><input id="c-table" value={form.numeroTable} onChange={maj('numeroTable')} /></div>
                <div className="champ"><label htmlFor="c-lycee">Lycée d’origine</label><input id="c-lycee" placeholder="Lycée national Léon Mba" value={form.etablissementOrigine} onChange={maj('etablissementOrigine')} /></div>
              </div>
            </>
          )}
          {etape === 3 && form.profil === 'licence' && (
            <>
              <h2>Votre parcours en Licence</h2>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-orig">Établissement actuel ou dernier fréquenté</label><input id="c-orig" value={form.etablissementOrigine} onChange={maj('etablissementOrigine')} /></div>
                <div className="champ"><label htmlFor="c-filiere">Filière</label><input id="c-filiere" placeholder="Informatique" value={form.filiereActuelle} onChange={maj('filiereActuelle')} /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-dernier">Dernier niveau validé</label><select id="c-dernier" value={form.dernierNiveauValide} onChange={maj('dernierNiveauValide')}><option value="">Choisir</option><option>Licence 1</option><option>Licence 2</option></select></div>
                <div className="champ"><label htmlFor="c-credits">Crédits ECTS acquis</label><input id="c-credits" type="number" min="0" max="180" placeholder="60" value={form.creditsAcquis} onChange={maj('creditsAcquis')} /></div>
                <div className="champ"><label htmlFor="c-bac">Baccalauréat (série et année)</label><input id="c-bac" placeholder="Série C, 2024" value={form.diplomeAcces || ''} onChange={maj('diplomeAcces')} /></div>
              </div>
            </>
          )}
          {etape === 3 && form.profil === 'master' && (
            <>
              <h2>Votre Licence</h2>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-spec">Spécialité de la Licence</label><input id="c-spec" placeholder="Informatique de gestion" value={form.specialiteLicence} onChange={maj('specialiteLicence')} /></div>
                <div className="champ"><label htmlFor="c-orig2">Établissement de la Licence</label><input id="c-orig2" value={form.etablissementOrigine} onChange={maj('etablissementOrigine')} /></div>
              </div>
              <div className="ligne-champs">
                <div className="champ"><label htmlFor="c-anl">Année d’obtention</label><select id="c-anl" value={form.anneeDiplome} onChange={maj('anneeDiplome')}><option value="">Choisir</option>{Array.from({ length: 10 }, (_, i) => String(anneeCourante - i)).map((a) => <option key={a}>{a}</option>)}</select></div>
                <div className="champ"><label htmlFor="c-moy">Moyenne de Licence (sur 20)</label><input id="c-moy" inputMode="decimal" placeholder="12,5" value={form.moyenneDiplome} onChange={maj('moyenneDiplome')} /></div>
                <div className="champ"><label htmlFor="c-menl">Mention</label><select id="c-menl" value={form.mentionDiplome} onChange={maj('mentionDiplome')}><option value="">Sans mention</option>{MENTIONS.map((m) => <option key={m}>{m}</option>)}</select></div>
              </div>
              <div className="champ"><label htmlFor="c-motiv">Projet et motivation (facultatif)</label><textarea id="c-motiv" rows={4} maxLength={3000} value={form.motivation} onChange={maj('motivation')} /></div>
            </>
          )}

          {etape === 4 && (
            <>
              <h2>Pièces du dossier</h2>
              <p className="note-secondaire" style={{ marginTop: -4 }}>PDF, JPEG ou PNG, 2 Mo au plus par pièce. Une photo nette prise au téléphone convient.</p>
              <div className="pieces-liste">
                {piecesProfil.map(([type, obligatoire]) => (
                  <label key={type} className={`piece-ligne ${fichiers[type] ? 'jointe' : ''}`} htmlFor={`c-piece-${type}`}>
                    <span className="piece-nom">{ref.pieces[type]} {obligatoire ? <span className="badge or">Obligatoire</span> : <span className="badge gris">Facultatif</span>}</span>
                    <span className="piece-fichier">{fichiers[type] ? fichiers[type].name : 'Choisir un fichier'}</span>
                    <input id={`c-piece-${type}`} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { setFichiers({ ...fichiers, [type]: e.target.files[0] || null }); setErreur(''); }} />
                  </label>
                ))}
              </div>
            </>
          )}

          {etape === 5 && (
            <>
              <h2>Vérifiez votre dossier</h2>
              <dl className="fiche-dossier">
                <div><dt>Profil</dt><dd>{profil.libelle}</dd></div>
                <div><dt>Établissement</dt><dd>{ecole?.nom}</dd></div>
                <div><dt>Niveau demandé</dt><dd>{form.niveauDemande}</dd></div>
                <div><dt>Formation</dt><dd>{formations.find((f) => String(f.id) === form.formationId)?.mention || 'Non précisée'}</dd></div>
                <div><dt>Candidat</dt><dd>{form.prenom} {form.nom.toUpperCase()}</dd></div>
                <div><dt>E-mail</dt><dd>{form.email}</dd></div>
                {form.profil === 'bachelier' && <div><dt>Baccalauréat</dt><dd>Série {form.serieBac}, {form.anneeDiplome}{form.mentionDiplome ? `, ${form.mentionDiplome}` : ''}</dd></div>}
                {form.profil === 'licence' && <div><dt>Parcours</dt><dd>{form.dernierNiveauValide} validée, {form.etablissementOrigine}{form.creditsAcquis ? `, ${form.creditsAcquis} crédits` : ''}</dd></div>}
                {form.profil === 'master' && <div><dt>Licence</dt><dd>{form.specialiteLicence}, {form.anneeDiplome}{form.moyenneDiplome ? `, ${form.moyenneDiplome}/20` : ''}</dd></div>}
                <div><dt>Pièces jointes</dt><dd>{Object.values(fichiers).filter(Boolean).length}</dd></div>
              </dl>
              <p className="note-secondaire" style={{ margin: 0 }}>En envoyant ce dossier, vous certifiez l’exactitude des informations. L’établissement pourra vérifier les pièces fournies.</p>
            </>
          )}

          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.siteWeb} onChange={maj('siteWeb')} style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
          {erreur && <div className="message-erreur">{erreur}</div>}
          {ref && ref.etablissements.length > 0 && (
            <div className="candidature-actions">
              {etape > 0 ? <button type="button" className="secondaire" onClick={() => { setEtape(etape - 1); setErreur(''); }}>Retour</button> : <Link to="/preinscription/suivi" className="lien-texte">J’ai déjà déposé un dossier</Link>}
              {etape < ETAPES.length - 1
                ? <button type="button" className="primaire" onClick={suivant}>Continuer</button>
                : <button type="button" className="primaire" disabled={enCours} onClick={envoyer}>{enCours ? 'Envoi du dossier…' : 'Envoyer ma candidature'}</button>}
            </div>
          )}
        </div>
      </div>
    </PagePublique>
  );
}

function Confirmation({ depot }) {
  return (
    <PagePublique surtitre="Candidature" titre="Dossier envoyé" introduction={`Votre candidature à ${depot.ecole} est enregistrée.`} retour="Retour à l’accueil">
      <div className="carte candidature-carte confirmation-candidature">
        <p className="note-secondaire" style={{ margin: 0 }}>Votre numéro de dossier</p>
        <p className="numero-dossier mono">{depot.numero}</p>
        <p className="note-secondaire" style={{ marginTop: 0 }}>Notez-le : avec votre adresse e-mail ({depot.email}), il permet de suivre votre dossier. Il vous a aussi été envoyé par e-mail.</p>
        <h3>Et maintenant ?</h3>
        <ol className="suite-candidature">
          <li><strong>L’établissement étudie votre dossier.</strong> Il peut vous demander une pièce : vous l’ajoutez depuis la page de suivi.</li>
          <li><strong>Vous recevez sa décision par e-mail.</strong> Acceptation, liste d’attente ou refus.</li>
          <li><strong>Si vous êtes accepté, vous finalisez votre inscription en ligne</strong> avec le lien reçu, et vous réglez les frais d’inscription par mobile money ou plus tard au guichet.</li>
          <li><strong>Votre compte étudiant est créé</strong> : vous recevez vos identifiants et votre matricule.</li>
        </ol>
        <Link className="primaire bouton-lien" to={`/preinscription/suivi?numero=${encodeURIComponent(depot.numero)}`}>Suivre mon dossier</Link>
      </div>
    </PagePublique>
  );
}
