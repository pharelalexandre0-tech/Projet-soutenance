import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { reglesEtablissement } from '../../utils/seuils';

export default function RelevesNotes({ eleveId, eleve }) {
  const [notes, setNotes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [etablissement, setEtablissement] = useState(null);
  const [etatsUE, setEtatsUE] = useState(new Map());
  const SEUIL_VALIDATION_UE = reglesEtablissement(etablissement).seuil;

  useEffect(() => {
    client.get('/etablissement').then((res) => setEtablissement(res.data.etablissement));
  }, []);

  function charger(silencieux = false) {
    if (!eleveId) return;
    if (!silencieux) setChargement(true);
    client.get(`/notes/eleve/${eleveId}`).then((res) => {
      setNotes(res.data.notes);
      setChargement(false);
    }).catch(() => setChargement(false));
    client.get('/scolarite/parcours').then((res) => {
      setEtatsUE(new Map(res.data.semestres.flatMap((s) => s.ues.map((u) => [u.ueId, u]))));
    }).catch(() => {});
  }
  useEffect(() => { charger(); }, [eleveId]);
  useActualisation(() => charger(true));

  // Regroupement par UE puis par matière, pour afficher le relevé comme un
  // vrai registre de notes plutôt qu'une liste plate.
  const parUE = new Map();
  notes.forEach((n) => {
    const ue = n.Matiere?.UniteEnseignement;
    const cle = ue?.id ?? 'sans-ue';
    if (!parUE.has(cle)) parUE.set(cle, { ue, matieres: [] });
    parUE.get(cle).matieres.push(n);
  });
  const groupes = [...parUE.values()];
  const semestreLibelle = groupes.find((g) => g.ue?.Semestre)?.ue.Semestre;

  const notees = notes.filter((n) => n.noteFinale != null);
  const poidsGlobal = notees.reduce((s, n) => s + (n.Matiere?.coefficient ?? 1), 0);
  const moyenneGlobale = poidsGlobal > 0
    ? Math.round((notees.reduce((s, n) => s + n.noteFinale * (n.Matiere?.coefficient ?? 1), 0) / poidsGlobal) * 100) / 100
    : null;
  const validees = notees.filter((n) => n.noteFinale >= SEUIL_VALIDATION_UE && !n.eliminatoire).length;

  return (
    <div className="carte document-academique document-suivi">
      <div className="releve-entete">
        <div className="releve-etablissement">{etablissement ? `${etablissement.nom}, ${etablissement.ville}, ${etablissement.pays}` : '…'}</div>
        <h2 className="releve-titre">Relevé de notes</h2>
      </div>

      {eleve && (
        <div className="releve-identite">
          <div><span>Étudiant</span><strong>{eleve.prenom} {eleve.nom}</strong></div>
          <div><span>Matricule</span><strong>{eleve?.matricule || `ETU-${String(eleveId).padStart(5, '0')}`}</strong></div>
          <div><span>Filière</span><strong>{eleve.Classe ? `${eleve.Classe.nom} (${eleve.Classe.niveau})` : 'Non renseigné'}</strong></div>
          <div><span>Semestre en cours</span><strong>{semestreLibelle ? `${semestreLibelle.libelle} (${semestreLibelle.anneeScolaire})` : 'Non renseigné'}</strong></div>
        </div>
      )}

      {notees.length > 0 && (
        <div className="releve-bilan">
          <div className="releve-bilan-item">
            <span>Moyenne à ce jour</span>
            <strong className={moyenneGlobale >= 10 ? 'reussite' : 'echec'}>{moyenneGlobale}/20</strong>
          </div>
          <div className="releve-bilan-item">
            <span>Matières validées</span>
            <strong>{validees} / {notees.length}</strong>
          </div>
        </div>
      )}

      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && notes.length === 0 && <div className="vide">Aucune moyenne enregistrée pour le moment</div>}

      {!chargement && notes.length > 0 && (
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
            {groupes.map(({ ue, matieres }) => {
              const notees2 = matieres.filter((n) => n.noteFinale != null);
              const poidsTotal = notees2.reduce((s, n) => s + (n.Matiere?.coefficient ?? 1), 0);
              const moyenneUE = poidsTotal > 0
                ? Math.round((notees2.reduce((s, n) => s + n.noteFinale * (n.Matiere?.coefficient ?? 1), 0) / poidsTotal) * 100) / 100
                : null;
              const eliminatoireUE = matieres.some((n) => n.eliminatoire);
              const rattrapageUE = matieres.some((n) => n.session === 'rattrapage');
              const seuilAtteintUE = moyenneUE != null && moyenneUE >= SEUIL_VALIDATION_UE && !eliminatoireUE;
              // Le serveur donne le résultat exact (compensation, jury compris).
              const etat = etatsUE.get(ue?.id);
              const resultatUE = moyenneUE == null
                ? null
                : etat ? { texte: etat.libelle, classe: etat.acquise ? 'vert' : etat.etat === 'eliminatoire' ? 'rouge' : 'gris' }
                : eliminatoireUE ? { texte: rattrapageUE ? 'Éliminatoire (rattrapage)' : 'Éliminatoire', classe: 'rouge' }
                : seuilAtteintUE ? { texte: rattrapageUE ? 'Validée au rattrapage' : 'UE validée', classe: 'vert' }
                : rattrapageUE ? { texte: 'Non validée', classe: 'rouge' }
                : { texte: 'Passe en rattrapage', classe: 'rouge' };
              return (
                <Fragment key={ue?.id ?? 'sans-ue'}>
                  <tr className="ligne-ue">
                    <td colSpan={4}>{ue ? `${ue.code} : ${ue.intitule}` : 'Autre'}</td>
                    <td className="chiffre" />
                    <td className="chiffre">{moyenneUE != null ? `${moyenneUE}/20` : 'N/A'}</td>
                    <td className="chiffre">{resultatUE && <span className={`badge ${resultatUE.classe}`}>{resultatUE.texte}</span>}</td>
                  </tr>
                  {matieres.map((n) => {
                    const badgeMatiere = n.noteFinale == null
                      ? null
                      : n.eliminatoire ? { texte: 'éliminatoire', classe: 'rouge' } : n.noteFinale >= SEUIL_VALIDATION_UE ? { texte: 'validé', classe: 'vert' } : { texte: 'non validé', classe: 'rouge' };
                    return (
                      <tr className="ligne-matiere" key={n.matiereId}>
                        <td>{n.Matiere?.code ?? 'N/A'}</td>
                        <td>{n.Matiere?.intitule}{n.session === 'rattrapage' && <span className="note-secondaire"> (rattrapage)</span>}</td>
                        <td className="chiffre">{n.Matiere?.coefficient ?? 1}</td>
                        <td className="chiffre">{n.moyenneCC ?? 'N/A'}</td>
                        <td className="chiffre">{n.moyenneExamen ?? 'N/A'}</td>
                        <td className="chiffre">
                          <span className={`note-finale ${n.noteFinale != null && n.noteFinale >= SEUIL_VALIDATION_UE && !n.eliminatoire ? 'reussite' : 'echec'}`}>
                            {n.noteFinale ?? 'N/A'}
                          </span>
                        </td>
                        <td className="chiffre">{badgeMatiere && <span className={`badge ${badgeMatiere.classe}`}>{badgeMatiere.texte}</span>}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
