import { useNational, pct, nombre, EtatChargement } from './commun';
import { IconInfo } from '../../components/icons';

// Alertes nationales de décrochage : nombre d'étudiants à risque par
// établissement (prédiction des écoles), sans aucun nom.
export default function Alertes() {
  const { donnees, erreur } = useNational();
  if (!donnees) return <EtatChargement erreur={erreur} />;
  const liste = [...donnees.etablissements].sort((a, b) => (b.tauxRisque ?? 0) - (a.tauxRisque ?? 0));
  const max = Math.max(1, ...liste.map((e) => e.tauxRisque || 0));

  return (
    <>
      <div className="encart-info" style={{ marginBottom: 20 }}>
        <IconInfo />
        <span>
          Chaque établissement calcule le risque de décrochage de ses étudiants (notes, assiduité, comportement, paiements). Le ministère n’en reçoit que
          les totaux : aucun nom ne quitte l’établissement. Un taux élevé appelle un échange avec sa direction des études.
        </span>
      </div>
      <section className="carte">
        <div className="entete-carte"><h2>Établissements à surveiller</h2><span className="note-secondaire">{nombre(donnees.totaux.risqueEleve)} étudiants à risque élevé au total</span></div>
        <div className="table-scroll">
          <table className="table-ministere">
            <thead><tr><th>Établissement</th><th>Province</th><th>Étudiants</th><th>Risque élevé</th><th>Risque moyen</th><th>Part à risque élevé</th><th>Absences non justifiées</th></tr></thead>
            <tbody>
              {liste.map((e) => (
                <tr key={e.id}>
                  <td className="cellule-nom">{e.nom}</td>
                  <td>{e.province || ''}</td>
                  <td className="cellule-nombre">{nombre(e.effectif)}</td>
                  <td className="cellule-nombre" style={{ color: e.risqueEleve ? 'var(--erreur)' : undefined, fontWeight: 700 }}>{nombre(e.risqueEleve)}</td>
                  <td className="cellule-nombre">{nombre(e.risqueMoyen)}</td>
                  <td>
                    <span className="jauge-risque niveau-eleve">
                      <span className="jauge-risque-piste"><span style={{ width: `${((e.tauxRisque || 0) / max) * 100}%` }} /></span>
                      <strong>{pct(e.tauxRisque)}</strong>
                    </span>
                  </td>
                  <td className="cellule-nombre">{nombre(e.absencesNonJustifiees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
