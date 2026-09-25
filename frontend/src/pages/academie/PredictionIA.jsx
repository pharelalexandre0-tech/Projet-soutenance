import { useEffect, useState } from 'react';
import client from '../../api/client';
import ChiffreAnime from '../../components/ChiffreAnime';
import { IconAlertTriangle } from '../../components/icons';
import Comportement from './Comportement';

const STYLE_NIVEAU = { faible: 'vert', moyen: 'or', eleve: 'rouge' };
const LIBELLE_NIVEAU = { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' };

// Diagramme d'activité 7 : déclencher l'analyse -> collecte -> calcul du
// score -> alerte si seuil dépassé -> l'Académie consulte le dossier et
// décide d'une action. Le signalement de comportement vit ici (sous-onglet)
// plutôt que dans un onglet "Absences" à part : c'est un des trois signaux
// de ce même calcul (notes, absences, comportement), pas un sujet séparé.
export default function PredictionIA() {
  const [onglet, setOnglet] = useState('alertes');
  return (
    <div>
      <div className="onglets-secondaires">
        <button className={onglet === 'alertes' ? 'actif' : ''} onClick={() => setOnglet('alertes')}>Alertes décrochage</button>
        <button className={onglet === 'comportement' ? 'actif' : ''} onClick={() => setOnglet('comportement')}>Signaler un comportement</button>
      </div>
      {onglet === 'alertes' && <Alertes />}
      {onglet === 'comportement' && <Comportement />}
    </div>
  );
}

function Alertes() {
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

  const parNiveau = { faible: 0, moyen: 0, eleve: 0 };
  alertes.forEach((a) => { if (parNiveau[a.niveauRisque] !== undefined) parNiveau[a.niveauRisque] += 1; });
  // Les plus urgentes en premier — une liste de 40 élèves dans l'ordre de
  // calcul obligerait à tout parcourir pour repérer qui a le score le plus haut.
  const alertesTriees = [...alertes].sort((a, b) => b.scoreRisque - a.scoreRisque);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Élèves analysés</span>
            <span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={alertes.length} /></div>
        </div>
        <div className={`stat-tile ${parNiveau.eleve > 0 ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque élevé</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.eleve} /></div>
        </div>
        <div className={`stat-tile ${parNiveau.moyen > 0 ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque moyen</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.moyen} /></div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Risque faible</span></div>
          <div className="valeur"><ChiffreAnime valeur={parNiveau.faible} /></div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-section">
          <h2>Alertes décrochage</h2>
          <button className="primaire" onClick={lancerAnalyse} disabled={enCours}>
            {enCours ? 'Analyse en cours…' : "Lancer l'analyse maintenant"}
          </button>
        </div>
        <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -8, marginBottom: 16 }}>
          Analyse périodique des notes, absences et incidents de comportement, qui calcule un score de risque de
          décrochage par élève. Au-delà du seuil d'alerte, l'équipe pédagogique est notifiée ; la décision d'action
          (suivi, entretien, soutien) reste humaine.
        </p>
        {dernierResultat && (
          <div className="message-succes" style={{ marginBottom: 14 }}>
            {dernierResultat.analysés} élève(s) analysé(s), {dernierResultat.alertesGenerees} alerte(s) générée(s).
          </div>
        )}

        <div className="table-scroll">
          <table>
            <thead><tr><th>Élève</th><th>Score</th><th>Niveau</th><th>Facteurs clés</th><th>Date</th></tr></thead>
            <tbody>
              {alertesTriees.map((a) => (
                <tr key={a.id}>
                  <td>{a.Eleve?.prenom} {a.Eleve?.nom}</td>
                  <td style={{ fontFamily: 'var(--police-mono)' }}>{a.scoreRisque}/100</td>
                  <td><span className={`badge ${STYLE_NIVEAU[a.niveauRisque]}`}>{LIBELLE_NIVEAU[a.niveauRisque] || a.niveauRisque}</span></td>
                  <td>{a.facteursCles}</td>
                  <td>{new Date(a.dateCalcul).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
              {alertes.length === 0 && <tr><td colSpan={5} className="vide">Aucun élève analysé pour l'instant, lance l'analyse ci-dessus</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

