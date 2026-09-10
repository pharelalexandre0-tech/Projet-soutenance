import { useEffect, useState } from 'react';
import client from '../../api/client';
import AnneauProgression from '../../components/AnneauProgression';
import ChiffreAnime from '../../components/ChiffreAnime';
import { IconDashboard, IconUsers, IconKey, IconPencil, IconCalendarAlert, IconBrain } from '../../components/icons';

function niveauAbsenteisme(taux) {
  if (taux <= 5) return 'vert';
  if (taux <= 15) return 'or';
  return 'rouge';
}

export default function TableauDeBord({ onNaviguer }) {
  const [classes, setClasses] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [absences, setAbsences] = useState(null);

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs));
    client.get('/absences/statistiques').then((res) => setAbsences(res.data));
  }, []);

  const totalEleves = classes.reduce((acc, c) => acc + (c.Eleves?.length ?? 0), 0);
  const maxEffectif = Math.max(1, ...classes.map((c) => c.Eleves?.length ?? 0));
  const tauxNonJustifie = absences?.tauxNonJustifie ?? 0;
  const tauxJustifie = absences && absences.total > 0 ? Math.round((absences.justifiees / absences.total) * 100) : null;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Classes ouvertes</span>
            <span className="puce-icone petite"><IconDashboard width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={classes.length} /></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Élèves inscrits</span>
            <span className="puce-icone petite"><IconUsers width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={totalEleves} /></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Professeurs actifs</span>
            <span className="puce-icone petite"><IconKey width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={professeurs.length} /></div>
        </div>
        <div className={`stat-tile tile-${niveauAbsenteisme(tauxNonJustifie)}`}>
          <div className="stat-tile-haut">
            <span className="libelle">Absences non justifiées</span>
            <span className="puce-icone petite"><IconCalendarAlert width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={tauxNonJustifie} suffixe="%" /></div>
        </div>
      </div>

      <div className="grille-3">
        <div className="carte">
          <h2>Effectif par classe</h2>
          {classes.length === 0 && <div className="vide">Aucune classe pour le moment</div>}
          <div className="barres-liste">
            {classes.map((c) => {
              const effectif = c.Eleves?.length ?? 0;
              return (
                <div className="barre-ligne" key={c.id}>
                  <span>{c.nom}</span>
                  <div className="barre-piste">
                    <div className="barre-remplissage" style={{ width: `${(effectif / maxEffectif) * 100}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--police-mono)' }}>{effectif}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="carte panneau-anneau">
          <h2 style={{ alignSelf: 'flex-start' }}>Répartition des absences</h2>
          {tauxJustifie === null ? (
            <div className="vide">Aucune absence enregistrée</div>
          ) : (
            <>
              <AnneauProgression valeur={tauxJustifie} sousLabel="justifiées" couleur="var(--succes)" />
              <div className="legende-anneau">
                <div className="legende-item">
                  <span className="legende-pastille" style={{ background: 'var(--succes)' }} />
                  Justifiées ({absences.justifiees})
                </div>
                <div className="legende-item">
                  <span className="legende-pastille" style={{ background: 'var(--erreur)' }} />
                  Non justifiées ({absences.nonJustifiees})
                </div>
              </div>
            </>
          )}
        </div>

        <div className="carte">
          <h2>Actions rapides</h2>
          <div className="actions-rapides">
            <button className="action-rapide" onClick={() => onNaviguer?.('eleves')}>
              <span className="puce-icone petite"><IconUsers width={16} height={16} /></span>
              Inscrire un élève
            </button>
            <button className="action-rapide" onClick={() => onNaviguer?.('notes')}>
              <span className="puce-icone petite"><IconPencil width={16} height={16} /></span>
              Saisir des notes
            </button>
            <button className="action-rapide" onClick={() => onNaviguer?.('absences')}>
              <span className="puce-icone petite"><IconCalendarAlert width={16} height={16} /></span>
              Signaler une absence
            </button>
            <button className="action-rapide" onClick={() => onNaviguer?.('prediction')}>
              <span className="puce-icone petite"><IconBrain width={16} height={16} /></span>
              Lancer la prédiction IA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
