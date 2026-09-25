import { useEffect, useState } from 'react';
import client from '../../api/client';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  IconUsers, IconAlertTriangle, IconActivity, IconClock, IconSearch, IconChevronRight, IconRocket, IconTrendingDown, IconDatabase,
} from '../../components/icons';

const NIVEAUX = [
  { id: '', libelle: 'Tous' },
  { id: 'eleve', libelle: 'Risque élevé' },
  { id: 'moyen', libelle: 'Risque moyen' },
  { id: 'faible', libelle: 'Risque faible' },
];
const STYLE_NIVEAU = { faible: 'vert', moyen: 'or', eleve: 'rouge' };
const LIBELLE_NIVEAU = { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' };
const ALGORITHMES = { foret_aleatoire: 'Forêt aléatoire', regression_logistique: 'Régression logistique' };

const pct = (v) => `${Math.round((v || 0) * 1000) / 10}`.replace('.', ',');
const dec = (v) => (v ?? 0).toFixed(3).replace('.', ',');

// Facteurs expliquant le score (JSON produit par le modèle, ou ancien texte).
function lireFacteurs(brut) {
  try {
    const d = JSON.parse(brut);
    return { facteurs: d.facteurs || [], sansNotes: !!d.sansNotes };
  } catch {
    return { facteurs: brut ? [{ texte: brut }] : [], sansNotes: false };
  }
}

function dateCourte(d) {
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Diagramme d'activité 7 : déclencher l'analyse -> le modèle d'apprentissage
// automatique calcule la probabilité d'échec de chaque élève -> alerte au-delà
// du seuil -> l'Académie consulte le dossier et décide d'une action humaine.
export default function AlertesDecrochage() {
  const [alertes, setAlertes] = useState(null);
  const [modele, setModele] = useState(null);
  const [classes, setClasses] = useState([]);
  const [niveau, setNiveau] = useState('');
  const [classeId, setClasseId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [entrainementEnCours, setEntrainementEnCours] = useState(false);
  const [dossier, setDossier] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/predictions/alertes').then((res) => setAlertes(res.data.alertes)).catch(() => setAlertes([]));
    client.get('/predictions/modele').then((res) => setModele(res.data.modele)).catch(() => setModele(null));
  }
  useEffect(() => {
    charger();
    client.get('/classes').then((res) => setClasses(res.data.classes));
  }, []);

  async function lancerAnalyse() {
    setAnalyseEnCours(true);
    try {
      const res = await client.post('/predictions/executer');
      setToast({ message: `${res.data.analysés} élève(s) analysé(s), ${res.data.alertesGenerees} en risque élevé.`, type: 'succes' });
      charger();
    } catch (err) {
      setToast({ message: messageErreur(err, "l'analyse a échoué"), type: 'erreur' });
    } finally {
      setAnalyseEnCours(false);
    }
  }

  async function reentrainer() {
    setEntrainementEnCours(true);
    try {
      const res = await client.post('/predictions/modele/entrainer');
      setToast({ message: `Modèle v${res.data.modele.version} entraîné (${ALGORITHMES[res.data.modele.algorithme]}, AUC ${dec(res.data.modele.metriques.auc)}), scores recalculés.`, type: 'succes' });
      charger();
    } catch (err) {
      setToast({ message: messageErreur(err, "l'entraînement a échoué"), type: 'erreur' });
    } finally {
      setEntrainementEnCours(false);
    }
  }

  async function ouvrirDossier(a) {
    setDossier({ alerte: a, historique: null });
    const res = await client.get(`/predictions/eleve/${a.eleveId}`).catch(() => null);
    setDossier({ alerte: a, historique: res?.data?.predictions || [] });
  }

  const liste = [...(alertes || [])].sort((a, b) => b.scoreRisque - a.scoreRisque);
  const compte = (n) => liste.filter((a) => a.niveauRisque === n).length;
  const r = recherche.trim().toLowerCase();
  const affichees = liste
    .filter((a) => !niveau || a.niveauRisque === niveau)
    .filter((a) => !classeId || String(a.Eleve?.classeId) === classeId)
    .filter((a) => !r || `${a.Eleve?.prenom} ${a.Eleve?.nom} ${a.Eleve?.nom} ${a.Eleve?.prenom}`.toLowerCase().includes(r));
  const derniere = liste.reduce((d, a) => (!d || new Date(a.dateCalcul) > new Date(d) ? a.dateCalcul : d), null);
  const autre = modele && Object.entries(modele.comparaison).find(([cle]) => cle !== modele.algorithme);
  const importanceMax = modele ? Math.max(...modele.importances.map((i) => i.importance), 0.001) : 1;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Élèves analysés</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{alertes ? liste.length : '…'}</div>
        </div>
        <div className={`stat-tile ${compte('eleve') ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque élevé (60 % et plus)</span><span className="puce-icone petite"><IconAlertTriangle /></span></div>
          <div className="valeur">{alertes ? compte('eleve') : '…'}</div>
        </div>
        <div className={`stat-tile ${compte('moyen') ? 'tile-or' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Risque moyen (30 à 60 %)</span><span className="puce-icone petite"><IconActivity /></span></div>
          <div className="valeur">{alertes ? compte('moyen') : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Dernière analyse</span><span className="puce-icone petite"><IconClock /></span></div>
          <div className="valeur valeur-montant">{derniere ? dateCourte(derniere) : 'Jamais'}</div>
        </div>
      </div>

      <section className="carte">
        <div className="entete-carte">
          <h2>Modèle de prédiction {modele && <span className="entete-carte-compteur">v{modele.version}</span>}</h2>
          <div className="actions-carte">
            <button type="button" className="secondaire" onClick={reentrainer} disabled={entrainementEnCours || analyseEnCours}>
              <IconDatabase /> {entrainementEnCours ? 'Entraînement…' : 'Réentraîner le modèle'}
            </button>
            <button type="button" className="primaire" onClick={lancerAnalyse} disabled={analyseEnCours || entrainementEnCours}>
              <IconRocket /> {analyseEnCours ? 'Analyse…' : "Lancer l'analyse"}
            </button>
          </div>
        </div>
        {!modele && <div className="chargement">Chargement du modèle…</div>}
        {modele && (
          <div className="modele-ia">
            <div className="modele-ia-fiche">
              <p className="modele-ia-resume">
                Apprentissage automatique supervisé : le modèle estime la <strong>probabilité qu'un élève ne valide pas son semestre</strong> à
                partir de {modele.importances.length} signaux observés en cours de semestre (notes de contrôle continu, assiduité,
                comportement, paiements).
              </p>
              <dl className="fiche-compte">
                <div><dt>Algorithme retenu</dt><dd>{ALGORITHMES[modele.algorithme]}</dd></div>
                <div>
                  <dt>Choisi face à</dt>
                  <dd>
                    {autre ? `${ALGORITHMES[autre[0]]} (AUC ${dec(autre[1].validationCroisee.aucMoyenne)} contre ${dec(modele.comparaison[modele.algorithme].validationCroisee.aucMoyenne)}, validation croisée à 5 plis)` : ''}
                  </dd>
                </div>
                <div><dt>Données d'apprentissage</dt><dd>{modele.donnees.total.toLocaleString('fr-FR')} parcours, dont {modele.donnees.reels} dossiers réels ; {modele.donnees.test} gardés pour le test</dd></div>
                <div><dt>Entraîné le</dt><dd>{new Date(modele.entraineLe).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</dd></div>
              </dl>
              <div className="metriques-ia">
                <div><span>AUC</span><strong>{dec(modele.metriques.auc)}</strong></div>
                <div><span>Exactitude</span><strong>{pct(modele.metriques.exactitude)} %</strong></div>
                <div><span>Précision</span><strong>{pct(modele.metriques.precision)} %</strong></div>
                <div><span>Rappel</span><strong>{pct(modele.metriques.rappel)} %</strong></div>
                <div><span>F1</span><strong>{dec(modele.metriques.f1)}</strong></div>
              </div>
              <p className="note-secondaire modele-ia-note">Mesures sur le jeu de test ({modele.donnees.test} parcours jamais vus pendant l'apprentissage).</p>
            </div>
            <div className="modele-ia-importances">
              <h3>Signaux les plus déterminants</h3>
              <ul>
                {modele.importances.slice(0, 7).map((i) => (
                  <li key={i.cle}>
                    <span className="importance-libelle">{i.libelle}</span>
                    <span className="importance-piste"><span style={{ width: `${(i.importance / importanceMax) * 100}%` }} /></span>
                    <span className="importance-valeur">{pct(i.importance)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="carte">
        <div className="entete-carte">
          <h2>Élèves à suivre <span className="entete-carte-compteur">{affichees.length}</span></h2>
        </div>
        <div className="barre-outils">
          <label className="champ-recherche">
            <IconSearch />
            <input type="search" placeholder="Rechercher un élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un élève" />
          </label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Filtrer par classe" className="filtre-select">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
          <div className="filtres-puces" role="group" aria-label="Filtrer par niveau de risque">
            {NIVEAUX.map((n) => (
              <button key={n.id} type="button" className={niveau === n.id ? 'actif' : ''} onClick={() => setNiveau(n.id)}>{n.libelle}</button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="table-alertes">
            <thead><tr><th>Élève</th><th>Classe</th><th>Probabilité d'échec</th><th>Niveau</th><th>Principaux facteurs</th><th>Analysé le</th><th aria-label="Dossier" /></tr></thead>
            <tbody>
              {affichees.map((a) => {
                const { facteurs, sansNotes } = lireFacteurs(a.facteursCles);
                return (
                  <tr key={a.id} className="ligne-cliquable" onClick={() => ouvrirDossier(a)}>
                    <td className="cellule-nom">{a.Eleve?.nom} {a.Eleve?.prenom}</td>
                    <td>{a.Eleve?.Classe?.nom}</td>
                    <td>
                      <span className={`jauge-risque niveau-${a.niveauRisque}`}>
                        <span className="jauge-risque-piste"><span style={{ width: `${a.scoreRisque}%` }} /></span>
                        <strong>{String(a.scoreRisque).replace('.', ',')} %</strong>
                      </span>
                    </td>
                    <td><span className={`badge ${STYLE_NIVEAU[a.niveauRisque]}`}>{LIBELLE_NIVEAU[a.niveauRisque]}</span></td>
                    <td className="cellule-facteurs">
                      {sansNotes && <span className="facteur-puce neutre">aucune note de CC</span>}
                      {facteurs.map((f) => <span key={f.cle || f.texte} className="facteur-puce">{f.texte}</span>)}
                      {!facteurs.length && !sansNotes && <span className="note-secondaire">Aucun signal préoccupant</span>}
                    </td>
                    <td className="note-secondaire">{dateCourte(a.dateCalcul)}</td>
                    <td className="cellule-chevron"><IconChevronRight /></td>
                  </tr>
                );
              })}
              {alertes && affichees.length === 0 && (
                <tr><td colSpan={7} className="vide">{liste.length === 0 ? "Aucune analyse pour l'instant : lancez l'analyse." : 'Aucun élève ne correspond.'}</td></tr>
              )}
              {!alertes && <tr><td colSpan={7} className="chargement">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {dossier && (
        <Tiroir
          titre={`${dossier.alerte.Eleve?.prenom} ${dossier.alerte.Eleve?.nom}`}
          sousTitre={dossier.alerte.Eleve?.Classe ? `${dossier.alerte.Eleve.Classe.nom} (${dossier.alerte.Eleve.Classe.niveau})` : undefined}
          icone={<span className="tuile-fonctionnalite"><IconTrendingDown /></span>}
          onFermer={() => setDossier(null)}
        >
          <section className="tiroir-section">
            <div className={`score-dossier niveau-${dossier.alerte.niveauRisque}`}>
              <span>Probabilité de ne pas valider le semestre</span>
              <strong>{String(dossier.alerte.scoreRisque).replace('.', ',')} %</strong>
              <span className={`badge ${STYLE_NIVEAU[dossier.alerte.niveauRisque]}`}>Risque {LIBELLE_NIVEAU[dossier.alerte.niveauRisque].toLowerCase()}</span>
            </div>
          </section>
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Ce qui pèse dans ce score</h3>
            {(() => {
              const { facteurs, sansNotes } = lireFacteurs(dossier.alerte.facteursCles);
              if (!facteurs.length) return <p className="note-secondaire">{sansNotes ? "Aucune note de contrôle continu n'est encore saisie : le modèle s'appuie sur les autres signaux." : 'Aucun signal ne pèse nettement dans le score.'}</p>;
              return (
                <ul className="facteurs-dossier">
                  {facteurs.map((f) => (
                    <li key={f.cle || f.texte}>
                      <span>{f.texte}</span>
                      {f.impact !== undefined && <strong>+{String(f.impact).replace('.', ',')} pts</strong>}
                    </li>
                  ))}
                </ul>
              );
            })()}
            <p className="note-secondaire" style={{ marginTop: 10 }}>Points de probabilité en moins si l'élève avait sur ce signal la valeur typique d'un élève qui réussit.</p>
          </section>
          <section className="tiroir-section">
            <h3 className="tiroir-section-titre">Historique des analyses</h3>
            {!dossier.historique && <div className="chargement">Chargement…</div>}
            {dossier.historique && (
              <ul className="historique-risque">
                {dossier.historique.slice(0, 10).map((p) => (
                  <li key={p.id}>
                    <span>{dateCourte(p.dateCalcul)}</span>
                    <span className={`badge ${STYLE_NIVEAU[p.niveauRisque]}`}>{String(p.scoreRisque).replace('.', ',')} %</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="encart-info">
            <IconAlertTriangle />
            <span>Le score est une aide à la décision : l'action (entretien, suivi, soutien) reste une décision de l'équipe pédagogique.</span>
          </div>
        </Tiroir>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
