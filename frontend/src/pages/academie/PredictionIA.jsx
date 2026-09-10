import { useEffect, useState } from 'react';
import client from '../../api/client';

const STYLE_NIVEAU = { faible: 'vert', moyen: 'or', eleve: 'rouge' };

// Diagramme d'activité 7 : déclencher l'analyse -> collecte -> calcul du
// score -> alerte si seuil dépassé -> l'Académie consulte le dossier et
// décide d'une action.
export default function PredictionIA() {
  const [alertes, setAlertes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierResultat, setDernierResultat] = useState(null);

  function charger() {
    client.get('/predictions/alertes').then((res) => setAlertes(res.data.alertes));
  }
  useEffect(charger, []);

  async function lancerAnalyse() {
    setEnCours(true);
    try {
      const res = await client.post('/predictions/executer');
      setDernierResultat(res.data);
      charger();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <h2>Prédiction IA — élèves à risque</h2>
      <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem' }}>
        Analyse périodique (notes + absences) calculant un score de risque de décrochage par élève.
        Au-delà du seuil d'alerte, l'équipe pédagogique est notifiée ; la décision d'action (suivi,
        entretien, soutien) reste humaine.
      </p>
      <button className="primaire" onClick={lancerAnalyse} disabled={enCours}>
        {enCours ? 'Analyse en cours…' : "Lancer l'analyse maintenant"}
      </button>
      {dernierResultat && (
        <div className="message-succes" style={{ marginTop: 10 }}>
          {dernierResultat.analysés} élève(s) analysé(s), {dernierResultat.alertesGenerees} alerte(s) générée(s).
        </div>
      )}

      <h3 style={{ marginTop: 22 }}>Alertes actives</h3>
      <table>
        <thead><tr><th>Élève</th><th>Score</th><th>Niveau</th><th>Facteurs clés</th><th>Date</th></tr></thead>
        <tbody>
          {alertes.map((a) => (
            <tr key={a.id}>
              <td>{a.Eleve?.prenom} {a.Eleve?.nom}</td>
              <td>{a.scoreRisque}/100</td>
              <td><span className={`badge ${STYLE_NIVEAU[a.niveauRisque]}`}>{a.niveauRisque}</span></td>
              <td>{a.facteursCles}</td>
              <td>{new Date(a.dateCalcul).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
          {alertes.length === 0 && <tr><td colSpan={5} className="vide">Aucune alerte active</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
