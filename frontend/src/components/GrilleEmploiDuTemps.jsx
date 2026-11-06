import { Fragment, useEffect, useMemo, useState } from 'react';
import { JOURS, libelleSalle } from '../utils/jours';
import { IconMapPin, IconClose, IconPlus } from './icons';

// Tuiles pleines aux couleurs du motif tissé : une couleur par matière,
// attribuée dans l'ordre alphabétique pour limiter les doublons.
const TEINTES = [
  ['var(--edu-marine)', '#fff'], ['var(--edu-bleu)', '#fff'], ['var(--edu-teal)', '#fff'], ['var(--edu-vert)', '#fff'], ['var(--edu-or)', 'var(--edu-marine)'],
];
const cleMatiere = (matiere) => (matiere || '').trim().toLowerCase();
// Plages proposées à l'Académie tant que la grille est vide.
const PLAGES_DEFAUT = [['08:00', '10:00'], ['10:15', '12:15'], ['14:00', '16:00']];
// En dessous de cette durée, l'écart entre deux plages n'est pas une pause.
const PAUSE_MIN = 30;

function versMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
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
// (Académie : case vide pour ajouter un cours, croix pour le retirer). Grille
// de cours : une ligne par plage horaire réellement utilisée, pauses marquées,
// sans heures vides. Sur téléphone, elle devient un agenda jour par jour.
export default function GrilleEmploiDuTemps({ creneaux, onAjouter, onRetirer }) {
  const etroit = useEstEtroit();
  const aujourdhui = indexAujourdhui();
  const [jourMobile, setJourMobile] = useState(aujourdhui >= 0 ? aujourdhui : 0);
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(new Date()), 60 * 1000);
    return () => clearInterval(minuteur);
  }, []);

  const { plages, parJour, totalMinutes, matieres, couleurs } = useMemo(() => {
    const groupes = JOURS.map((jour) => creneaux
      .filter((c) => c.jour === jour)
      .sort((x, y) => versMinutes(x.heureDebut) - versMinutes(y.heureDebut)));
    const distinctes = [...new Set(creneaux.map((c) => cleMatiere(c.matiere)).filter(Boolean))].sort();
    const paires = creneaux.length ? creneaux.map((c) => [c.heureDebut, c.heureFin]) : (onAjouter ? PLAGES_DEFAUT : []);
    const uniques = [...new Map(paires.map(([d, f]) => [`${d}|${f}`, [d, f]])).values()]
      .sort((x, y) => versMinutes(x[0]) - versMinutes(y[0]) || versMinutes(x[1]) - versMinutes(y[1]));
    return {
      plages: uniques,
      parJour: groupes,
      totalMinutes: creneaux.reduce((t, c) => t + Math.max(0, versMinutes(c.heureFin) - versMinutes(c.heureDebut)), 0),
      matieres: distinctes.length,
      couleurs: new Map(distinctes.map((m, i) => [m, TEINTES[i % TEINTES.length]])),
    };
  }, [creneaux, Boolean(onAjouter)]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const enCours = (c, i) => i === aujourdhui && minutesMaintenant >= versMinutes(c.heureDebut) && minutesMaintenant < versMinutes(c.heureFin);
  const stylesTuile = (c) => {
    const [fond, encre] = couleurs.get(cleMatiere(c.matiere)) || TEINTES[0];
    return { '--teinte': fond, '--encre': encre };
  };
  const prochain = aujourdhui >= 0 ? parJour[aujourdhui].find((c) => versMinutes(c.heureDebut) > minutesMaintenant) : null;

  const resume = (
    <div className="edt-resume">
      <span><strong>{creneaux.length}</strong> cours par semaine</span>
      <span><strong>{duree(totalMinutes)}</strong> de cours</span>
      <span><strong>{matieres}</strong> matière{matieres > 1 ? 's' : ''}</span>
      {prochain && <span className="edt-prochain">Prochain cours : <strong>{prochain.matiere || 'Cours'}</strong> à {prochain.heureDebut}</span>}
    </div>
  );

  const boutonRetirer = (c) => onRetirer && (
    <button type="button" className="edt-retirer" onClick={() => onRetirer(c)} aria-label={`Retirer ${c.matiere || 'ce cours'}`} title="Retirer ce cours">
      <IconClose />
    </button>
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
            <li key={c.id}>
              <div className="edt-agenda-heures">
                <strong>{c.heureDebut}</strong>
                <span>{c.heureFin}</span>
              </div>
              <div className="edt-tuile" style={stylesTuile(c)}>
                <strong>{c.matiere || 'Cours'}</strong>
                <span className="edt-tuile-info">{[duree(versMinutes(c.heureFin) - versMinutes(c.heureDebut)), libelleSalle(c.salle)].filter(Boolean).join(' · ')}</span>
                {enCours(c, jourMobile) && <span className="edt-en-cours">En cours</span>}
                {boutonRetirer(c)}
              </div>
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
      <div className="edt-defilement">
        <table className="edt-table">
          <thead>
            <tr>
              <th scope="col" className="edt-coin">Horaire</th>
              {JOURS.map((jour, i) => (
                <th key={jour} scope="col" className={i === aujourdhui ? 'aujourdhui' : ''}>
                  <span>{jour}</span>
                  <small>{i === aujourdhui ? 'Aujourd’hui' : parJour[i].length ? `${parJour[i].length} cours` : 'Libre'}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plages.map(([debut, fin], n) => {
              const ecart = n > 0 ? versMinutes(debut) - versMinutes(plages[n - 1][1]) : 0;
              return (
                <Fragment key={`${debut}|${fin}`}>
                  {ecart >= PAUSE_MIN && (
                    <tr className="edt-pause"><td colSpan={JOURS.length + 1}><span>Pause · {duree(ecart)}</span></td></tr>
                  )}
                  <tr>
                    <th scope="row" className="edt-plage">
                      <strong>{debut}</strong>
                      <span>{fin}</span>
                      <small>{duree(versMinutes(fin) - versMinutes(debut))}</small>
                    </th>
                    {JOURS.map((jour, i) => {
                      const cours = parJour[i].filter((c) => c.heureDebut === debut && c.heureFin === fin);
                      return (
                        <td key={jour} className={i === aujourdhui ? 'aujourdhui' : ''}>
                          {cours.map((c) => (
                            <div key={c.id} className={`edt-tuile ${enCours(c, i) ? 'actuelle' : ''}`} style={stylesTuile(c)} title={`${c.matiere || 'Cours'}, ${debut} à ${fin}${c.salle ? `, ${libelleSalle(c.salle)}` : ''}`}>
                              <strong>{c.matiere || 'Cours'}</strong>
                              {c.salle && <span className="edt-tuile-info"><IconMapPin />{libelleSalle(c.salle)}</span>}
                              {enCours(c, i) && <span className="edt-en-cours">En cours</span>}
                              {boutonRetirer(c)}
                            </div>
                          ))}
                          {cours.length === 0 && onAjouter && (
                            <button type="button" className="edt-case-vide" onClick={() => onAjouter({ jour, heureDebut: debut, heureFin: fin })} aria-label={`Ajouter un cours le ${jour.toLowerCase()} de ${debut} à ${fin}`}>
                              <IconPlus />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
            {onAjouter && (
              <tr className="edt-autre">
                <th scope="row" className="edt-plage"><small>Autre horaire</small></th>
                {JOURS.map((jour) => (
                  <td key={jour}>
                    <button type="button" className="edt-case-vide petite" onClick={() => onAjouter({ jour, heureDebut: '16:15', heureFin: '18:15' })} aria-label={`Ajouter un cours le ${jour.toLowerCase()} à un autre horaire`}>
                      <IconPlus />
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
