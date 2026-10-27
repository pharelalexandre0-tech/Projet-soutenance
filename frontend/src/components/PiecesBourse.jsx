import { useRef, useState } from 'react';
import client from '../api/client';
import BoutonDocument from './BoutonDocument';
import { messageErreur } from '../utils/erreurs';
import { IconUpload, IconDownload, IconTrash, IconCircleCheck, IconShield } from './icons';

const STATUTS = { depose: ['Téléversée', 'vert'], valide: ['Téléversée', 'vert'], refuse: ['À remplacer', 'rouge'] };
const ORIGINES = { etudiant: 'Étudiant', parent: 'Parent', academie: 'Établissement', plateforme: 'Générée et certifiée' };
const taille = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
const TAILLE_MAX = 5 * 1024 * 1024;

// Pièces d'un dossier de bourse ANBG, rangées par type : dépôt (PDF, PNG ou
// JPEG, 5 Mo au plus), téléchargement et retrait par l'étudiant.
export default function PiecesBourse({ vue, urlDepot, onChange, modifiable = true, peutGenerer = false, retirer = null }) {
  const [enCours, setEnCours] = useState('');
  const [erreur, setErreur] = useState('');
  const champs = useRef({});

  async function deposer(type, fichier) {
    if (!fichier) return;
    setErreur('');
    if (fichier.size > TAILLE_MAX) { setErreur('Fichier trop lourd : 5 Mo au plus.'); return; }
    setEnCours(type);
    try {
      await client.post(urlDepot, fichier, { params: { type, nom: fichier.name }, headers: { 'Content-Type': fichier.type || 'application/octet-stream' } });
      await onChange();
    } catch (e) {
      setErreur(messageErreur(e, 'dépôt impossible'));
    } finally {
      setEnCours('');
      if (champs.current[type]) champs.current[type].value = '';
    }
  }

  async function generer(type) {
    setEnCours(type);
    setErreur('');
    try {
      await client.post('/bourse/moi/pieces/generer', null, { params: { type } });
      await onChange();
    } catch (e) {
      setErreur(messageErreur(e, 'génération impossible'));
    } finally {
      setEnCours('');
    }
  }

  return (
    <div className="pieces-bourse">
      {erreur && <div className="message-erreur">{erreur}</div>}
      {vue.types.map((t) => {
        const pieces = vue.pieces.filter((p) => p.type === t.valeur);
        const valide = pieces.some((p) => p.statut === 'valide');
        return (
          <section key={t.valeur} className={`piece-type ${valide ? 'validee' : ''}`}>
            <div className="piece-type-entete">
              <div>
                <strong>{t.libelle}</strong>
                <span className="note-secondaire">{t.obligatoire ? 'Obligatoire' : 'Facultatif'}{t.generable && peutGenerer ? ' · peut être générée par EduSphere' : ''}</span>
              </div>
              {modifiable && (
                <div className="actions-entete">
                  {t.generable && peutGenerer && (
                    <button type="button" className="secondaire petit" disabled={Boolean(enCours)} onClick={() => generer(t.valeur)}>
                      <IconShield /> {enCours === t.valeur ? 'Génération…' : 'Générer (certifiée)'}
                    </button>
                  )}
                  <label className={`bouton-depot ${enCours ? 'inactif' : ''}`}>
                    <IconUpload /> {enCours === t.valeur ? 'Envoi…' : 'Téléverser'}
                    <input
                      ref={(el) => { champs.current[t.valeur] = el; }}
                      type="file" accept="application/pdf,image/png,image/jpeg" hidden disabled={Boolean(enCours)}
                      onChange={(e) => deposer(t.valeur, e.target.files?.[0])}
                    />
                  </label>
                </div>
              )}
            </div>
            {pieces.length === 0 && <p className="piece-vide">{t.obligatoire ? 'Aucune pièce : à fournir.' : 'Aucune pièce.'}</p>}
            {pieces.map((p) => (
              <div key={p.id} className="piece-ligne">
                <span className="piece-nom">{p.statut === 'valide' && <IconCircleCheck />}{p.nomFichier}</span>
                <span className="note-secondaire">{taille(p.taille)} · {ORIGINES[p.origine]} · {new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                <span className={`badge ${STATUTS[p.statut][1]}`}>{STATUTS[p.statut][0]}</span>
                {p.commentaire && <span className={`piece-commentaire ${p.statut === 'refuse' ? 'refus' : ''}`}>{p.commentaire}</span>}
                <span className="piece-actions">
                  <BoutonDocument className="bouton-icone" chemin={`/api/bourse/pieces/${p.id}/fichier`} title="Télécharger"><IconDownload /></BoutonDocument>
                  {retirer && p.statut !== 'valide' && modifiable && <button type="button" className="bouton-icone" title="Retirer" aria-label="Retirer la pièce" onClick={() => retirer(p)}><IconTrash /></button>}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
