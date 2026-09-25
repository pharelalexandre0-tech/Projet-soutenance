import { Fragment, useEffect, useState } from 'react';
import client from '../api/client';
import { IconDownload } from './icons';

function mention(moyenne) {
  if (moyenne == null) return 'Non évalué';
  if (moyenne >= 18) return 'Excellent';
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

// Une UE passée par le rattrapage n'est jamais étiquetée "validée" au même
// titre qu'une validation en session normale, même si la moyenne recalculée
// franchit le seuil : elle reste distinctement marquée "Rattrapage".
function resultatUE(ligneUE) {
  if (ligneUE.eliminatoire) return { texte: ligneUE.session === 'rattrapage' ? 'Éliminatoire (rattr.)' : 'Éliminatoire', ton: 'echec' };
  if (ligneUE.session === 'rattrapage') return { texte: 'Rattrapage', ton: 'attente' };
  if (ligneUE.valide) return { texte: 'Validée', ton: 'reussite' };
  return { texte: 'À rattraper', ton: 'echec' };
}

function resultatMatiere(m) {
  if (m.eliminatoire) return { texte: 'Éliminatoire', ton: 'echec' };
  return m.noteFinale >= 10 ? { texte: 'Acquis', ton: 'reussite' } : { texte: 'Non acquis', ton: 'echec' };
}

function note(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  const n = Number(valeur);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : String(valeur);
}

function sigleDe(etab) {
  if (etab?.sigle) return etab.sigle.slice(0, 5).toUpperCase();
  return (etab?.nom || 'ES').split(/\s+/).filter((m) => m.length > 2).map((m) => m[0]).join('').slice(0, 4).toUpperCase();
}

// Rendu unique du bulletin, partagé par l'espace Étudiant/Parents et
// l'espace Académie : le document affiché, celui téléchargé en PDF et celui
// envoyé par e-mail sont toujours le même, à l'identité de l'établissement.
export default function BulletinDocument({ eleveId, eleve, semestre, bulletin, detail, resume, actions }) {
  const [etablissement, setEtablissement] = useState(null);

  useEffect(() => {
    client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement)).catch(() => {});
  }, []);

  if (!bulletin || !resume) return null;
  const lignes = detail || [];
  const sansNotes = lignes.length === 0;
  const admis = resume.admis;
  const reference = `BUL-${String(semestre?.id ?? '').padStart(2, '0')}${String(eleveId).padStart(4, '0')}-${bulletin.id}`;
  const adresse = [etablissement?.boitePostale, etablissement?.ville, etablissement?.pays].filter(Boolean).join(', ');
  const contacts = [etablissement?.telephone, etablissement?.email].filter(Boolean).join('  ·  ');
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bulletin-conteneur">
      <article className="bulletin" aria-label="Bulletin de notes">
        <header className="bulletin-entete">
          <div className="bulletin-ecole">
            {etablissement?.logo
              ? <img className="bulletin-logo" src={etablissement.logo} alt={`Logo ${etablissement.nom}`} />
              : <span className="bulletin-logo bulletin-logo-sigle">{sigleDe(etablissement)}</span>}
            <div className="bulletin-ecole-textes">
              <strong>{etablissement?.nom || '…'}</strong>
              {etablissement?.devise && <em>{etablissement.devise}</em>}
              {adresse && <span>{adresse}</span>}
              {contacts && <span>{contacts}</span>}
            </div>
          </div>
          <div className="bulletin-titre">
            <span className="bulletin-surtitre">Année {semestre?.anneeScolaire || ''}</span>
            <h2>Bulletin de notes</h2>
            <span className="bulletin-periode">{semestre?.libelle || ''}</span>
            <span className="bulletin-reference">Réf. {reference}</span>
          </div>
        </header>

        <dl className="bulletin-identite">
          <div><dt>Nom et prénom</dt><dd>{eleve ? `${eleve.nom} ${eleve.prenom}` : `#${eleveId}`}</dd></div>
          <div><dt>Matricule</dt><dd className="mono">{eleve?.matricule || 'Non attribué'}</dd></div>
          <div><dt>Classe</dt><dd>{eleve?.Classe?.nom || 'Non renseignée'}</dd></div>
          <div><dt>Niveau</dt><dd>{eleve?.Classe?.niveau || 'Non renseigné'}</dd></div>
        </dl>

        {resume.sessionGlobale === 'rattrapage' && (
          <p className="bulletin-avis">Ce bulletin intègre les résultats de la session de rattrapage pour les UE non validées en session normale.</p>
        )}

        <div className="bulletin-table-zone">
          <table className="bulletin-table">
            <thead>
              <tr>
                <th className="col-code">Code</th>
                <th>Unité d'enseignement / Matière</th>
                <th className="chiffre">Coef.</th>
                <th className="chiffre">CC</th>
                <th className="chiffre">Examen</th>
                <th className="chiffre">Moyenne</th>
                <th className="col-resultat">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligneUE) => {
                const resUE = resultatUE(ligneUE);
                return (
                  <Fragment key={ligneUE.ue}>
                    <tr className="bulletin-ue">
                      <td className="col-code">{ligneUE.code || ''}</td>
                      <td colSpan={4}>
                        {ligneUE.ue}
                        <span className="bulletin-credits">{ligneUE.credits} crédit{ligneUE.credits > 1 ? 's' : ''}</span>
                      </td>
                      <td className="chiffre">{note(ligneUE.moyenne)}</td>
                      <td className={`col-resultat ton-${resUE.ton}`}>{resUE.texte}</td>
                    </tr>
                    {(ligneUE.matieres || []).map((m) => {
                      const res = resultatMatiere(m);
                      return (
                        <tr className="bulletin-matiere" key={m.matiere}>
                          <td className="col-code">{m.code || ''}</td>
                          <td>{m.matiere}{m.session === 'rattrapage' && <span className="bulletin-session"> (rattrapage)</span>}</td>
                          <td className="chiffre">{m.coefficient}</td>
                          <td className="chiffre">{note(m.moyenneCC)}</td>
                          <td className="chiffre">{note(m.moyenneExamen)}</td>
                          <td className={`chiffre note-finale ton-${res.ton}`}>{note(m.noteFinale)}</td>
                          <td className={`col-resultat ton-${res.ton}`}>{res.texte}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {sansNotes && (
                <tr><td colSpan={7} className="bulletin-vide">Aucune note n'a encore été enregistrée pour ce semestre.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <dl className="bulletin-synthese">
          <div>
            <dt>Moyenne générale</dt>
            <dd className={sansNotes ? '' : bulletin.moyenneGenerale >= 10 ? 'ton-reussite' : 'ton-echec'}>
              {sansNotes ? 'Non évaluée' : <>{note(bulletin.moyenneGenerale)}<small> / 20</small></>}
            </dd>
          </div>
          <div><dt>Crédits validés</dt><dd>{bulletin.creditsValides}<small> / {resume.creditsTotal}</small></dd></div>
          <div><dt>Mention</dt><dd>{sansNotes ? 'Non évalué' : mention(bulletin.moyenneGenerale)}</dd></div>
          <div>
            <dt>Décision</dt>
            <dd className={sansNotes ? '' : admis ? 'ton-reussite' : 'ton-echec'}>{sansNotes ? 'En attente' : admis ? 'Admis(e)' : 'Ajourné(e)'}</dd>
          </div>
        </dl>

        <footer className="bulletin-pied">
          <div className="bulletin-fait">Fait à {etablissement?.ville || '…'}, le {dateDuJour}</div>
          <div className="bulletin-signature">
            <span>Le Directeur des études</span>
            <span className="bulletin-signature-zone" aria-hidden="true" />
            <span className="bulletin-signature-legende">Signature et cachet</span>
          </div>
        </footer>
        <p className="bulletin-mentions">
          Document établi par {etablissement?.nom || "l'établissement"} via EduSphere · Réf. {reference} · Toute rature ou surcharge annule ce document.
        </p>
      </article>

      {(bulletin.fichierPDF || actions) && (
        <div className="bulletin-actions">
          {bulletin.fichierPDF && (
            <a className="bouton-lien-secondaire" href={bulletin.fichierPDF} target="_blank" rel="noreferrer"><IconDownload /> Télécharger le PDF</a>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
