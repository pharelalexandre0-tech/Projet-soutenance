import Tiroir from './Tiroir';
import { IconCalendarAlert, IconPencil, IconInfo } from './icons';

const STATUTS = {
  present: { texte: 'Présent', badge: 'vert' },
  absent: { texte: 'Absent', badge: 'rouge' },
  retard: { texte: 'Retard', badge: 'or' },
};

function dateLongue(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function note(v) {
  return v === null || v === undefined ? '' : Number(v).toFixed(2).replace('.', ',');
}

// Ce qu'un professeur a envoyé depuis son accès temporaire, tel quel :
// feuille d'appel complète ou liste des notes. Affiché dans un panneau
// latéral depuis "Feuilles d'appel" ou "Comptes éphémères".
export default function DetailCompteRendu({ compteRendu: cr, onFermer }) {
  const appel = cr.tache === 'saisie_absences';
  const r = cr.resume || {};
  const tauxPresence = appel && cr.effectif ? Math.round((r.presents / cr.effectif) * 100) : null;

  return (
    <Tiroir
      titre={appel ? "Feuille d'appel" : 'Notes saisies'}
      sousTitre={`${cr.classe || 'Classe supprimée'}, ${dateLongue(cr.date)}`}
      icone={<span className="tuile-fonctionnalite">{appel ? <IconCalendarAlert /> : <IconPencil />}</span>}
      onFermer={onFermer}
    >
      <section className="tiroir-section">
        <dl className="fiche-compte">
          <div><dt>Professeur</dt><dd>{cr.professeur || 'Professeur retiré'}</dd></div>
          {!appel && <div><dt>Matière</dt><dd>{cr.matiere}</dd></div>}
          {!appel && <div><dt>Évaluation</dt><dd>{cr.categorie === 'examen' ? 'Examen' : 'Contrôle continu'}{cr.evaluation ? `, ${cr.evaluation}` : ''}</dd></div>}
          <div><dt>Envoyé le</dt><dd>{new Date(cr.envoyeLe).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</dd></div>
        </dl>
      </section>

      <section className="tiroir-section">
        {appel ? (
          <dl className="chiffres-classe chiffres-4">
            <div><dt>Présents</dt><dd className="ton-reussite">{r.presents ?? 0}</dd></div>
            <div><dt>Absents</dt><dd className="ton-echec">{r.absents ?? 0}</dd></div>
            <div><dt>Retards</dt><dd className="ton-attente">{r.retards ?? 0}</dd></div>
            <div><dt>Présence</dt><dd>{tauxPresence !== null ? `${tauxPresence} %` : ''}</dd></div>
          </dl>
        ) : (
          <dl className="chiffres-classe chiffres-4">
            <div><dt>Notes</dt><dd>{r.saisies ?? 0}<small> / {cr.effectif}</small></dd></div>
            <div><dt>Moyenne</dt><dd>{note(r.moyenne)}</dd></div>
            <div><dt>Plus basse</dt><dd>{note(r.min)}</dd></div>
            <div><dt>Plus haute</dt><dd>{note(r.max)}</dd></div>
          </dl>
        )}
      </section>

      <section className="tiroir-section">
        <h3 className="tiroir-section-titre">{appel ? 'Liste d’appel' : 'Notes sur 20'}</h3>
        <ol className="liste-compte-rendu">
          {(cr.lignes || []).map((l, i) => (
            <li key={l.eleveId ?? i} className={appel ? `statut-${l.statut}` : ''}>
              <span className="acces-numero">{i + 1}</span>
              <span className="acces-eleve">
                <strong>{l.nom} {l.prenom}</strong>
                {l.matricule && <small>{l.matricule}</small>}
              </span>
              {appel ? (
                <span className="liste-compte-rendu-statut">
                  <span className={`badge ${STATUTS[l.statut]?.badge || 'gris'}`}>{STATUTS[l.statut]?.texte || l.statut}</span>
                  {l.statut !== 'present' && l.justifie !== undefined && (
                    <small className={l.justifie ? 'ton-reussite' : 'note-secondaire'}>{l.justifie ? 'Justifiée' : 'Non justifiée'}</small>
                  )}
                </span>
              ) : (
                <strong className={`liste-compte-rendu-note ${l.valeur === null ? 'note-secondaire' : l.valeur >= 10 ? 'ton-reussite' : 'ton-echec'}`}>
                  {l.valeur === null ? 'Sans note' : note(l.valeur)}
                </strong>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="encart-info">
        <IconInfo />
        <span>
          {appel
            ? "Chaque absence et chaque retard ont été ajoutés au dossier de l'élève (onglet Absences de l'étudiant et du parent), qui ont été prévenus par notification et e-mail. Ils comptent aussi dans le score de risque de décrochage."
            : "Ces moyennes ont été enregistrées dans les notes de la matière (page Notes) et comptent dans le bulletin et le score de risque de décrochage."}
        </span>
      </div>
    </Tiroir>
  );
}
