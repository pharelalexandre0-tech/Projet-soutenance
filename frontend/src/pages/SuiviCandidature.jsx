import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import PagePublique from '../components/PagePublique';
import { messageErreur } from '../utils/erreurs';
import { IconCheck } from '../components/icons';

const lireFichier = (f) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); });
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const TONS = { deposee: 'bleu', en_examen: 'bleu', piece_demandee: 'or', liste_attente: 'or', acceptee: 'vert', refusee: 'rouge', inscrite: 'vert' };
const LIBELLES = { deposee: 'Dossier déposé', en_examen: 'En étude', piece_demandee: 'Pièce demandée', liste_attente: 'Liste d’attente', acceptee: 'Accepté', refusee: 'Non retenu', inscrite: 'Inscrit' };

// Suivi public d'une candidature : numéro de dossier + e-mail du dépôt.
export default function SuiviCandidature() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ numero: params.get('numero') || '', email: '' });
  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [info, setInfo] = useState('');

  async function appeler(url, corps = {}) {
    setEnCours(true);
    setErreur('');
    setInfo('');
    try {
      const r = await client.post(`/preinscriptions-publiques/${url}`, { ...form, ...corps });
      return r.data;
    } catch (err) {
      setErreur(messageErreur(err, 'action impossible'));
      return null;
    } finally {
      setEnCours(false);
    }
  }
  async function consulter(e) {
    e.preventDefault();
    const d = await appeler('suivi');
    if (d) setDossier(d.dossier);
  }
  async function ajouterPiece() {
    if (!fichier) { setErreur('choisissez le fichier à ajouter'); return; }
    if (fichier.size > 2 * 1024 * 1024) { setErreur('le fichier dépasse 2 Mo'); return; }
    const d = await appeler('suivi/pieces', { pieces: [{ type: 'autre', nomFichier: fichier.name, contenu: await lireFichier(fichier) }] });
    if (d) { setDossier(d.dossier); setFichier(null); setInfo('Pièce ajoutée : l’établissement reprend l’étude de votre dossier.'); }
  }
  async function renvoyer() {
    const d = await appeler('suivi/renvoyer-lien');
    if (d) setInfo('Un nouveau lien d’inscription vient de vous être envoyé par e-mail.');
  }

  return (
    <PagePublique surtitre="Candidature" titre="Suivre mon dossier" introduction="Saisissez le numéro de dossier reçu au dépôt et l’adresse e-mail utilisée." retour="Retour à l’accueil">
      <div className="candidature">
        {!dossier && (
          <form className="carte formulaire candidature-carte" onSubmit={consulter}>
            <div className="ligne-champs">
              <div className="champ"><label htmlFor="s-num">Numéro de dossier</label><input id="s-num" className="mono" placeholder="PRE-2026-A1B2C3" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value.toUpperCase() })} required /></div>
              <div className="champ"><label htmlFor="s-mail">E-mail du dépôt</label><input id="s-mail" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            </div>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <div className="candidature-actions">
              <Link to="/preinscription" className="lien-texte">Déposer une nouvelle candidature</Link>
              <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Recherche…' : 'Voir mon dossier'}</button>
            </div>
          </form>
        )}

        {dossier && (
          <div className="carte candidature-carte">
            <div className="suivi-tete">
              <div>
                <p className="note-secondaire" style={{ margin: 0 }}>Dossier <span className="mono">{dossier.numero}</span>, déposé le {dateFr(dossier.deposeLe)}</p>
                <h2 style={{ margin: '4px 0' }}>{dossier.prenom} {dossier.nom}</h2>
                <p className="note-secondaire" style={{ margin: 0 }}>{dossier.ecole?.nom} · {dossier.niveauDemande}{dossier.profil ? ` · ${dossier.profil}` : ''}</p>
              </div>
              <span className={`badge ${TONS[dossier.statut]}`}>{LIBELLES[dossier.statut]}</span>
            </div>

            <ol className="suivi-frise">
              {dossier.etapes.map((e) => (
                <li key={e.cle} className={e.etat}>
                  <span className="suivi-point">{e.etat === 'faite' ? <IconCheck width={12} height={12} /> : null}</span>
                  <span>{e.libelle}</span>
                </li>
              ))}
            </ol>

            <div className={`suivi-explication ${TONS[dossier.statut]}`}>
              <p style={{ margin: 0 }}>{dossier.explication}</p>
              {dossier.message && <p style={{ margin: '8px 0 0' }}><strong>Message de l’établissement :</strong> {dossier.message}</p>}
            </div>

            {dossier.statut === 'piece_demandee' && (
              <div className="formulaire" style={{ marginTop: 16 }}>
                <p style={{ margin: 0 }}><strong>Pièce demandée :</strong> {dossier.pieceDemandee}</p>
                <label className={`piece-ligne ${fichier ? 'jointe' : ''}`} htmlFor="s-piece">
                  <span className="piece-nom">Fichier (PDF, JPEG ou PNG, 2 Mo au plus)</span>
                  <span className="piece-fichier">{fichier ? fichier.name : 'Choisir un fichier'}</span>
                  <input id="s-piece" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFichier(e.target.files[0] || null)} />
                </label>
                <button type="button" className="primaire" disabled={enCours} onClick={ajouterPiece}>{enCours ? 'Envoi…' : 'Ajouter la pièce'}</button>
              </div>
            )}

            {dossier.peutRecevoirLien && (
              <div className="formulaire" style={{ marginTop: 16 }}>
                <p style={{ margin: 0 }}>Admis en <strong>{dossier.classe?.niveau}</strong> ({dossier.classe?.nom}). Le lien pour finaliser votre inscription a été envoyé par e-mail.</p>
                <button type="button" className="secondaire" disabled={enCours} onClick={renvoyer}>Je n’ai pas reçu le lien : le renvoyer</button>
              </div>
            )}

            {dossier.pieces.length > 0 && (
              <details className="suivi-pieces">
                <summary>Pièces de votre dossier ({dossier.pieces.length})</summary>
                <ul>{dossier.pieces.map((p, i) => <li key={i}>{p.type} : {p.nomFichier}</li>)}</ul>
              </details>
            )}
            {info && <div className="message-succes" style={{ marginTop: 12 }}>{info}</div>}
            {erreur && <div className="message-erreur" style={{ marginTop: 12 }}>{erreur}</div>}
            <p className="note-secondaire" style={{ margin: '16px 0 0' }}>Une question ? Contactez {dossier.ecole?.nom}{dossier.ecole?.email ? ` : ${dossier.ecole.email}` : ''}{dossier.ecole?.telephone ? `, ${dossier.ecole.telephone}` : ''}.</p>
          </div>
        )}
      </div>
    </PagePublique>
  );
}
