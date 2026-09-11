import { Fragment, useEffect, useState } from 'react';
import client from '../api/client';

function mention(moyenne) {
  if (moyenne == null) return '—';
  if (moyenne >= 18) return 'Excellent';
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

// Une UE passée par le rattrapage n'est jamais étiquetée "validée" au même
// titre qu'une validation en session normale, même si la moyenne recalculée
// franchit le seuil — elle reste distinctement marquée "Rattrapage".
function resultatUE(ligneUE) {
  if (ligneUE.eliminatoire) return { texte: ligneUE.session === 'rattrapage' ? 'Éliminatoire (rattrapage)' : 'Éliminatoire', classe: 'rouge' };
  if (ligneUE.session === 'rattrapage') return { texte: 'Rattrapage', classe: 'or' };
  if (ligneUE.valide) return { texte: 'UE validée', classe: 'vert' };
  return { texte: 'Passe en rattrapage', classe: 'rouge' };
}

// Rendu unique du bulletin, partagé par l'espace Étudiant (consultation) et
// l'espace Académie (consultation + envoi) — pour que le document affiché
// à l'écran, celui téléchargé en PDF et celui envoyé par e-mail soient
// toujours rigoureusement le même, jamais trois versions divergentes.
export default function BulletinDocument({ eleveId, eleve, semestre, bulletin, detail, resume, actions }) {
  const [etablissement, setEtablissement] = useState(null);

  useEffect(() => {
    client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement));
  }, []);

  if (!bulletin || !resume) return null;
  const admis = resume.admis;

  return (
    <div className="document-academique document-officiel" style={{ marginTop: 22 }}>
      <div className="releve-entete">
        <div className="releve-etablissement">{etablissement ? `${etablissement.nom} — ${etablissement.ville}, ${etablissement.pays}` : '…'}</div>
        <h2 className="releve-titre">Bulletin de notes</h2>
      </div>
      <div className="releve-reference">
        N° BUL-{String(semestre?.id ?? '').padStart(2, '0')}{String(eleveId).padStart(4, '0')}-{bulletin.id} · document officiel de fin de semestre
      </div>

      <div className="releve-identite">
        <div><span>Étudiant</span><strong>{eleve ? `${eleve.prenom} ${eleve.nom}` : `#${eleveId}`}</strong></div>
        <div><span>Matricule</span><strong>ETU-{String(eleveId).padStart(5, '0')}</strong></div>
        <div><span>Filière</span><strong>{eleve?.Classe ? `${eleve.Classe.nom} (${eleve.Classe.niveau})` : '—'}</strong></div>
        <div><span>Semestre</span><strong>{semestre ? `${semestre.libelle} (${semestre.anneeScolaire})` : '—'}</strong></div>
      </div>

      {resume.sessionGlobale === 'rattrapage' && (
        <div className="message-erreur" style={{ marginBottom: 16 }}>
          Ce bulletin intègre les résultats de la session de rattrapage pour les UE non validées en session normale.
        </div>
      )}

      <div className="table-scroll">
        <table className="table-releve">
          <thead>
            <tr>
              <th>Code</th>
              <th>Unité d'enseignement / Matière</th>
              <th className="chiffre">Coef.</th>
              <th className="chiffre">Moy. CC</th>
              <th className="chiffre">Moy. Examen</th>
              <th className="chiffre">Note / 20</th>
              <th className="chiffre">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {(detail || []).map((ligneUE) => {
              const resUE = resultatUE(ligneUE);
              return (
                <Fragment key={ligneUE.ue}>
                  <tr className="ligne-ue">
                    <td colSpan={4}>{ligneUE.code ? `${ligneUE.code} — ` : ''}{ligneUE.ue} · {ligneUE.credits} crédits</td>
                    <td className="chiffre" />
                    <td className="chiffre">{ligneUE.moyenne}/20</td>
                    <td className="chiffre"><span className={`badge ${resUE.classe}`}>{resUE.texte}</span></td>
                  </tr>
                  {(ligneUE.matieres || []).map((m) => {
                    const badgeMatiere = m.eliminatoire ? { texte: 'éliminatoire', classe: 'rouge' } : m.noteFinale >= 10 ? { texte: 'validé', classe: 'vert' } : { texte: 'non validé', classe: 'rouge' };
                    return (
                      <tr className="ligne-matiere" key={m.matiere}>
                        <td>{m.code ?? '—'}</td>
                        <td>{m.matiere}{m.session === 'rattrapage' && <span className="note-secondaire"> (rattrapage)</span>}</td>
                        <td className="chiffre">{m.coefficient}</td>
                        <td className="chiffre">{m.moyenneCC ?? '—'}</td>
                        <td className="chiffre">{m.moyenneExamen ?? '—'}</td>
                        <td className="chiffre"><span className={`note-finale ${m.noteFinale >= 10 && !m.eliminatoire ? 'reussite' : 'echec'}`}>{m.noteFinale}</span></td>
                        <td className="chiffre"><span className={`badge ${badgeMatiere.classe}`}>{badgeMatiere.texte}</span></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="releve-pied">
        <div><span>Moyenne générale</span><strong className={bulletin.moyenneGenerale >= 10 ? 'reussite' : 'echec'}>{bulletin.moyenneGenerale}/20</strong></div>
        <div><span>Crédits validés</span><strong>{bulletin.creditsValides} / {resume.creditsTotal}</strong></div>
        <div><span>Mention</span><strong>{mention(bulletin.moyenneGenerale)}</strong></div>
        <div><span>Décision</span><strong className={admis ? 'reussite' : 'echec'}>{admis ? 'Admis(e)' : 'Non validé(e)'}</strong></div>
      </div>

      <div className="releve-signature">
        <div>
          Fait le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          {bulletin.fichierPDF && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href={bulletin.fichierPDF} target="_blank" rel="noreferrer">Télécharger le bulletin (PDF)</a>
              {actions}
            </div>
          )}
        </div>
        <div className="cachet">Cachet &amp;<br />signature</div>
      </div>
    </div>
  );
}
