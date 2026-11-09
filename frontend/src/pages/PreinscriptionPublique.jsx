import { useEffect, useState } from 'react';
import client from '../api/client';
import PagePublique from '../components/PagePublique';
import { messageErreur } from '../utils/erreurs';

const CYCLES = { licence: 'Licence', master: 'Master', doctorat: 'Doctorat' };
const NIVEAUX = ['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat'];
const PIECES = [['identite', 'Pièce d’identité'], ['diplome', 'Diplôme d’accès (baccalauréat, licence…)'], ['releve', 'Relevé de notes'], ['photo', 'Photo d’identité']];
const lireFichier = (f) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); });

// Préinscription en ligne, sans compte : le candidat choisit l'établissement
// et la formation, remplit son dossier et joint ses pièces.
export default function PreinscriptionPublique() {
  const [offres, setOffres] = useState(null);
  const [form, setForm] = useState({ etablissementId: '', formationId: '', niveauDemande: 'Licence 1', nom: '', prenom: '', dateNaissance: '', sexe: '', email: '', telephone: '', nationalite: 'Gabonaise', diplomeAcces: '', anneeDiplome: '', mentionDiplome: '', etablissementOrigine: '', siteWeb: '' });
  const [fichiers, setFichiers] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [numero, setNumero] = useState('');
  useEffect(() => { client.get('/preinscriptions-publiques/offres').then((r) => setOffres(r.data.etablissements)).catch(() => setOffres([])); }, []);
  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ecole = (offres || []).find((e) => String(e.id) === String(form.etablissementId));

  async function deposer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const pieces = [];
      for (const [type, f] of Object.entries(fichiers)) {
        if (!f) continue;
        if (f.size > 2 * 1024 * 1024) throw new Error(`le fichier « ${f.name} » dépasse 2 Mo`);
        pieces.push({ type, nomFichier: f.name, contenu: await lireFichier(f) });
      }
      const r = await client.post('/preinscriptions-publiques', { ...form, pieces });
      setNumero(r.data.numero);
    } catch (err) {
      setErreur(err.response ? messageErreur(err, 'le dépôt a échoué') : err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <PagePublique surtitre="Candidature" titre="Préinscription en ligne" introduction="Déposez votre dossier auprès d’un établissement d’enseignement supérieur. Vous recevrez la réponse par e-mail." retour="Retour à l’accueil">
      {numero ? (
        <div className="carte">
          <h2>Dossier déposé</h2>
          <p>Votre dossier a été enregistré sous le numéro <strong className="mono">{numero}</strong>. Un e-mail de confirmation vous a été envoyé ; l’établissement vous répondra après examen.</p>
        </div>
      ) : (
        <form className="carte formulaire" onSubmit={deposer} style={{ maxWidth: 820, margin: '0 auto' }}>
          {offres && offres.length === 0 && <div className="vide">Aucun établissement n’accepte de préinscription en ligne pour le moment.</div>}
          <h3>Établissement et formation</h3>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pp-ecole">Établissement</label><select id="pp-ecole" value={form.etablissementId} onChange={(e) => setForm({ ...form, etablissementId: e.target.value, formationId: '' })} required><option value="">Choisir</option>{(offres || []).map((o) => <option key={o.id} value={o.id}>{o.nom}{o.ville ? ` (${o.ville})` : ''}</option>)}</select></div>
            <div className="champ"><label htmlFor="pp-niveau">Niveau demandé</label><select id="pp-niveau" value={form.niveauDemande} onChange={maj('niveauDemande')}>{NIVEAUX.map((n) => <option key={n}>{n}</option>)}</select></div>
          </div>
          {ecole?.formations?.length > 0 && (
            <div className="champ"><label htmlFor="pp-form">Formation</label><select id="pp-form" value={form.formationId} onChange={maj('formationId')}><option value="">Indifférent</option>{ecole.formations.map((f) => <option key={f.id} value={f.id}>{CYCLES[f.cycle]} {f.mention}{f.parcours ? `, ${f.parcours}` : ''}</option>)}</select></div>
          )}
          <h3>Identité</h3>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pp-nom">Nom</label><input id="pp-nom" value={form.nom} onChange={maj('nom')} required /></div>
            <div className="champ"><label htmlFor="pp-prenom">Prénom</label><input id="pp-prenom" value={form.prenom} onChange={maj('prenom')} required /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pp-naiss">Date de naissance</label><input id="pp-naiss" type="date" value={form.dateNaissance} onChange={maj('dateNaissance')} /></div>
            <div className="champ"><label htmlFor="pp-sexe">Sexe</label><select id="pp-sexe" value={form.sexe} onChange={maj('sexe')}><option value="">Non précisé</option><option value="F">Féminin</option><option value="M">Masculin</option></select></div>
            <div className="champ"><label htmlFor="pp-nat">Nationalité</label><input id="pp-nat" value={form.nationalite} onChange={maj('nationalite')} /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pp-mail">E-mail</label><input id="pp-mail" type="email" value={form.email} onChange={maj('email')} required /></div>
            <div className="champ"><label htmlFor="pp-tel">Téléphone</label><input id="pp-tel" inputMode="tel" value={form.telephone} onChange={maj('telephone')} /></div>
          </div>
          <h3>Diplôme d’accès</h3>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="pp-dip">Diplôme</label><input id="pp-dip" placeholder="ex. Baccalauréat série C" value={form.diplomeAcces} onChange={maj('diplomeAcces')} /></div>
            <div className="champ" style={{ maxWidth: 140 }}><label htmlFor="pp-an">Année</label><input id="pp-an" value={form.anneeDiplome} onChange={maj('anneeDiplome')} /></div>
            <div className="champ" style={{ maxWidth: 180 }}><label htmlFor="pp-men">Mention</label><input id="pp-men" value={form.mentionDiplome} onChange={maj('mentionDiplome')} /></div>
          </div>
          <div className="champ"><label htmlFor="pp-orig">Établissement d’origine</label><input id="pp-orig" value={form.etablissementOrigine} onChange={maj('etablissementOrigine')} /></div>
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.siteWeb} onChange={maj('siteWeb')} style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
          <h3>Pièces du dossier <small className="note-secondaire">(PDF, JPEG ou PNG, 2 Mo au plus chacune)</small></h3>
          {PIECES.map(([type, libelle]) => (
            <div className="champ" key={type}><label htmlFor={`pp-${type}`}>{libelle}</label><input id={`pp-${type}`} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFichiers({ ...fichiers, [type]: e.target.files[0] || null })} /></div>
          ))}
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Envoi du dossier…' : 'Déposer mon dossier'}</button>
        </form>
      )}
    </PagePublique>
  );
}
