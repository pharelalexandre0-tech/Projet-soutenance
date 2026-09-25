import { useEffect, useMemo, useState } from 'react';
import { JOURS } from '../utils/jours';
import { IconMapPin, IconClock, IconClose } from './icons';

const HAUTEUR_HEURE = 64;
const DEBUT_DEFAUT = 8 * 60;
const FIN_DEFAUT = 18 * 60;

// Une teinte de la charte par matière (toujours la même pour une matière
// donnée), pour qu'on repère d'un coup d'œil tous les cours d'une même
// matière dans la semaine.
const TEINTES = ['var(--edu-bleu)', 'var(--edu-teal)', 'var(--edu-vert)', 'var(--edu-or)', 'var(--edu-marine)', 'var(--primaire-fonce)'];

function teinte(matiere) {
  const texte = (matiere || '').toLowerCase();
  let somme = 0;
  for (let i = 0; i < texte.length; i += 1) somme = (somme * 31 + texte.charCodeAt(i)) % 997;
  return TEINTES[somme % TEINTES.length];
}

function versMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function versHeure(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function duree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// Jour courant dans la liste JOURS (lundi = 0), ou -1 le dimanche.
function indexAujourdhui() {
  const j = new Date().getDay();
  return j === 0 ? -1 : j - 1;
}

function useEstEtroit() {
  const requete = '(max-width: 760px)';
  const [etroit, setEtroit] = useState(() => window.matchMedia(requete).matches);
  useEffect(() => {
    const mq = window.matchMedia(requete);
    const surChangement = () => setEtroit(mq.matches);
    mq.addEventListener('change', surChangement);
    return () => mq.removeEventListener('change', surChangement);
  }, []);
  return etroit;
}

// Emploi du temps hebdomadaire, en lecture (étudiant, parent) ou en édition
// (Académie : clic sur une case vide pour ajouter un cours à cette heure,
// croix pour retirer un cours). Sur téléphone, la grille de six colonnes
// devient un agenda jour par jour.
export default function GrilleEmploiDuTemps({ creneaux, onAjouter, onRetirer }) {
  const etroit = useEstEtroit();
  const aujourdhui = indexAujourdhui();
  const [jourMobile, setJourMobile] = useState(aujourdhui >= 0 ? aujourdhui : 0);
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(new Date()), 60 * 1000);
    return () => clearInterval(minuteur);
  }, []);

  const { debut, fin, parJour, totalMinutes, matieres } = useMemo(() => {
    const bornes = creneaux.flatMap((c) => [versMinutes(c.heureDebut), versMinutes(c.heureFin)]);
    const d = Math.floor(Math.min(DEBUT_DEFAUT, ...bornes) / 60) * 60;
    const f = Math.ceil(Math.max(FIN_DEFAUT, ...bornes) / 60) * 60;
    const groupes = JOURS.map((jour) => creneaux
      .filter((c) => c.jour === jour)
      .sort((a, b) => versMinutes(a.heureDebut) - versMinutes(b.heureDebut)));
    return {
      debut: d,
      fin: f,
      parJour: groupes,
      totalMinutes: creneaux.reduce((s, c) => s + Math.max(0, versMinutes(c.heureFin) - versMinutes(c.heureDebut)), 0),
      matieres: new Set(creneaux.map((c) => (c.matiere || '').trim().toLowerCase()).filter(Boolean)).size,
    };
  }, [creneaux]);

  const heures = [];
  for (let m = debut; m < fin; m += 60) heures.push(m);
  const hauteur = ((fin - debut) / 60) * HAUTEUR_HEURE;
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const ligneMaintenant = minutesMaintenant >= debut && minutesMaintenant <= fin
    ? ((minutesMaintenant - debut) / 60) * HAUTEUR_HEURE
    : null;

  function ajouterA(jour, e) {
    if (!onAjouter) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = debut + Math.floor(((e.clientY - rect.top) / HAUTEUR_HEURE)) * 60;
    onAjouter({ jour, heureDebut: versHeure(minutes), heureFin: versHeure(Math.min(minutes + 60, 23 * 60 + 59)) });
  }

  const resume = (
    <div className="edt-resume">
      <span><strong>{creneaux.length}</strong> cours par semaine</span>
      <span><strong>{duree(totalMinutes)}</strong> de cours</span>
      <span><strong>{matieres}</strong> matière{matieres > 1 ? 's' : ''}</span>
    </div>
  );

  if (etroit) {
    const cours = parJour[jourMobile];
    return (
      <div className="edt">
        {resume}
        <div className="edt-jours-mobile" role="tablist">
          {JOURS.map((jour, i) => (
            <button
              key={jour}
              type="button"
              role="tab"
              aria-selected={i === jourMobile}
              className={`${i === jourMobile ? 'actif' : ''} ${i === aujourdhui ? 'aujourdhui' : ''}`}
              onClick={() => setJourMobile(i)}
            >
              {jour.slice(0, 3)}
              <small>{parJour[i].length}</small>
            </button>
          ))}
        </div>
        {cours.length === 0 && <div className="vide">Aucun cours le {JOURS[jourMobile].toLowerCase()}.</div>}
        <ol className="edt-agenda">
          {cours.map((c) => (
            <li key={c.id} style={{ '--teinte': teinte(c.matiere) }}>
              <div className="edt-agenda-heures">
                <strong>{c.heureDebut}</strong>
                <span>{c.heureFin}</span>
              </div>
              <div className="edt-agenda-cours">
                <strong>{c.matiere || 'Cours'}</strong>
                <span>{duree(versMinutes(c.heureFin) - versMinutes(c.heureDebut))}{c.salle ? `, salle ${c.salle}` : ''}</span>
              </div>
              {onRetirer && (
                <button type="button" className="edt-retirer" onClick={() => onRetirer(c)} aria-label={`Retirer ${c.matiere || 'ce cours'}`}>
                  <IconClose />
                </button>
              )}
            </li>
          ))}
        </ol>
        {onAjouter && (
          <button type="button" className="secondaire" style={{ marginTop: 12 }} onClick={() => onAjouter({ jour: JOURS[jourMobile], heureDebut: '08:00', heureFin: '10:00' })}>
            Ajouter un cours le {JOURS[jourMobile].toLowerCase()}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="edt">
      {resume}
      <div className="edt-grille">
        <div className="edt-entete">
          <div className="edt-coin" />
          {JOURS.map((jour, i) => (
            <div key={jour} className={`edt-jour ${i === aujourdhui ? 'aujourdhui' : ''}`}>
              <span>{jour}</span>
              <small>{parJour[i].length ? `${parJour[i].length} cours` : 'Libre'}</small>
            </div>
          ))}
        </div>

        <div className="edt-corps" style={{ height: hauteur, '--hauteur-heure': `${HAUTEUR_HEURE}px` }}>
          <div className="edt-heures">
            {heures.map((m) => (
              <span key={m} style={{ top: ((m - debut) / 60) * HAUTEUR_HEURE }}>{versHeure(m)}</span>
            ))}
          </div>
          {JOURS.map((jour, i) => (
            <div
              key={jour}
              className={`edt-colonne ${i === aujourdhui ? 'aujourdhui' : ''} ${onAjouter ? 'editable' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) ajouterA(jour, e); }}
              title={onAjouter ? `Cliquer pour ajouter un cours le ${jour.toLowerCase()}` : undefined}
            >
              {i === aujourdhui && ligneMaintenant !== null && (
                <div className="edt-maintenant" style={{ top: ligneMaintenant }} aria-label="Heure actuelle" />
              )}
              {parJour[i].map((c) => {
                const d = versMinutes(c.heureDebut);
                const f = Math.max(versMinutes(c.heureFin), d + 20);
                const court = f - d < 50;
                return (
                  <div
                    key={c.id}
                    className={`edt-cours ${court ? 'court' : ''}`}
                    style={{
                      top: ((d - debut) / 60) * HAUTEUR_HEURE + 2,
                      height: ((f - d) / 60) * HAUTEUR_HEURE - 4,
                      '--teinte': teinte(c.matiere),
                    }}
                    title={`${c.matiere || 'Cours'}, ${c.heureDebut} à ${c.heureFin}${c.salle ? `, salle ${c.salle}` : ''}`}
                  >
                    <strong>{c.matiere || 'Cours'}</strong>
                    <span className="edt-cours-info"><IconClock />{c.heureDebut} à {c.heureFin}</span>
                    {c.salle && !court && <span className="edt-cours-info"><IconMapPin />Salle {c.salle}</span>}
                    {onRetirer && (
                      <button type="button" className="edt-retirer" onClick={() => onRetirer(c)} aria-label={`Retirer ${c.matiere || 'ce cours'}`}>
                        <IconClose />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
