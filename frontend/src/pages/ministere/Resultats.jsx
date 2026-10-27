import { useState } from 'react';
import { useNational, pct, nombre, note, EtatChargement, tonReussite } from './commun';

const TRIS = {
  reussite: { libelle: 'Taux de réussite', cle: (e) => e.tauxReussite ?? -1 },
  moyenne: { libelle: 'Moyenne', cle: (e) => e.moyenne ?? -1 },
  effectif: { libelle: 'Effectif', cle: (e) => e.effectif },
};

// Classement des établissements par résultats, et indicateurs d'assiduité.
export default function Resultats() {
  const { donnees, erreur } = useNational();
  const [tri, setTri] = useState('reussite');
  if (!donnees) return <EtatChargement erreur={erreur} />;
  const classes = [...donnees.etablissements].sort((a, b) => TRIS[tri].cle(b) - TRIS[tri].cle(a));

  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Classement des établissements</h2>
        <div className="onglets-secondaires compact" role="tablist">
          {Object.entries(TRIS).map(([k, t]) => <button key={k} type="button" className={tri === k ? 'actif' : ''} onClick={() => setTri(k)}>{t.libelle}</button>)}
        </div>
      </div>
      <div className="table-scroll">
        <table className="table-ministere">
          <thead><tr><th>Rang</th><th>Établissement</th><th>Province</th><th>Étudiants</th><th>Évalués</th><th>Admis</th><th>Réussite</th><th>Moyenne</th><th>Abs. non justifiées / étudiant</th><th>Retards</th></tr></thead>
          <tbody>
            {classes.map((e, i) => (
              <tr key={e.id}>
                <td className="cellule-nombre">{i + 1}</td>
                <td className="cellule-nom">{e.nom}</td>
                <td>{e.province || ''}</td>
                <td className="cellule-nombre">{nombre(e.effectif)}</td>
                <td className="cellule-nombre">{nombre(e.evalues)}</td>
                <td className="cellule-nombre">{nombre(e.admis)}</td>
                <td className="cellule-nombre" style={{ color: tonReussite(e.tauxReussite), fontWeight: 700 }}>{pct(e.tauxReussite)}</td>
                <td className="cellule-nombre">{note(e.moyenne)}</td>
                <td className="cellule-nombre">{String(e.absencesParEtudiant).replace('.', ',')}</td>
                <td className="cellule-nombre">{nombre(e.retards)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note-bas">Réussite : étudiants dont la moyenne pondérée des notes finales ((CC + examen) / 2) atteint le seuil de validation fixé par leur établissement.</p>
    </section>
  );
}
