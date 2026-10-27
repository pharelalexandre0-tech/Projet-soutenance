import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';
import { pct, nombre, note, EtatChargement, tonReussite, Telechargements } from './commun';

const CRITERES = {
  reussite: { libelle: 'Taux de réussite', valeur: (e) => pct(e.tauxReussite) },
  moyenne: { libelle: 'Moyenne générale', valeur: (e) => (e.moyenne == null ? 'N/A' : `${note(e.moyenne)} / 20`) },
  effectif: { libelle: 'Effectif', valeur: (e) => `${nombre(e.effectif)} étudiants` },
  assiduite: { libelle: 'Assiduité', valeur: (e) => `${String(e.absencesParEtudiant).replace('.', ',')} abs. / étudiant` },
};

// Classement national des établissements, calculé par le serveur (le même
// que celui des documents PDF et Excel téléchargeables).
export default function Resultats() {
  const [critere, setCritere] = useState('reussite');
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const charger = () => client.get(`/ministere/classement?critere=${critere}`).then((r) => setDonnees(r.data)).catch((e) => setErreur(messageErreur(e, 'classement indisponible')));
  useEffect(() => { setDonnees(null); charger(); }, [critere]);
  useActualisation(charger, { plateforme: true, delai: 2000 });

  const classes = donnees?.classement || [];
  const podium = classes.filter((e) => e.rang && e.rang <= 3);

  return (
    <>
      <section className="carte">
        <div className="entete-carte">
          <div className="onglets-secondaires compact" role="tablist" aria-label="Critère de classement">
            {Object.entries(CRITERES).map(([k, c]) => (
              <button key={k} type="button" role="tab" aria-selected={critere === k} className={critere === k ? 'actif' : ''} onClick={() => setCritere(k)}>{c.libelle}</button>
            ))}
          </div>
          <Telechargements chemin={`/api/ministere/classement?critere=${critere}`} libelle="Télécharger le classement" />
        </div>
        {!donnees && <EtatChargement erreur={erreur} />}
        {donnees && podium.length > 0 && (
          <ol className="podium">
            {podium.map((e) => (
              <li key={e.id} className={`podium-place place-${e.rang}`}>
                <span className="podium-rang">{e.rang}</span>
                <span className="podium-texte">
                  <strong>{e.nom}</strong>
                  <small>{[e.province, e.libelleType].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="podium-valeur">{CRITERES[critere].valeur(e)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {donnees && (
        <section className="carte">
          <div className="entete-carte"><h2>Classement complet par {CRITERES[critere].libelle.toLowerCase()} <span className="entete-carte-compteur">{classes.length}</span></h2></div>
          <div className="table-scroll">
            <table className="table-ministere">
              <thead>
                <tr><th>Rang</th><th>Établissement</th><th>Province</th><th>Type</th><th className="chiffre">Étudiants</th><th className="chiffre">Évalués</th><th className="chiffre">Admis</th><th className="chiffre">Réussite</th><th className="chiffre">Moyenne</th><th className="chiffre">Abs. / étudiant</th><th className="chiffre">Retards</th></tr>
              </thead>
              <tbody>
                {classes.map((e) => (
                  <tr key={e.id}>
                    <td>{e.rang ? <span className={`pastille-rang ${e.rang <= 3 ? 'haut' : ''}`}>{e.rang}</span> : <span className="badge gris" title="Aucun étudiant évalué">Non classé</span>}</td>
                    <td className="cellule-nom">{e.nom}</td>
                    <td>{e.province || ''}</td>
                    <td>{e.libelleType || ''}</td>
                    <td className="chiffre">{nombre(e.effectif)}</td>
                    <td className="chiffre">{nombre(e.evalues)}</td>
                    <td className="chiffre">{nombre(e.admis)}</td>
                    <td className="chiffre" style={{ color: tonReussite(e.tauxReussite), fontWeight: 700 }}>{pct(e.tauxReussite)}</td>
                    <td className="chiffre">{note(e.moyenne)}</td>
                    <td className="chiffre">{String(e.absencesParEtudiant).replace('.', ',')}</td>
                    <td className="chiffre">{nombre(e.retards)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note-bas">Réussite : étudiants dont la moyenne pondérée des notes finales ((CC + examen) / 2) atteint le seuil de validation fixé par leur établissement. Un établissement sans étudiant évalué n’est pas classé sur les résultats.</p>
        </section>
      )}
    </>
  );
}
