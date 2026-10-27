import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { useAuth } from '../../context/AuthContext';
import { useFonctionnaliteOuverte } from '../../context/PlateformeContext';
import { JOURS } from '../../utils/jours';
import {
  IconDocument, IconClipboard, IconCalendarAlert, IconCalendar, IconReceipt, IconMessage, IconGraduationCap, IconChevronRight,
} from '../../components/icons';

const note = (n) => (n == null ? 'N/A' : String(Math.round(n * 100) / 100).replace('.', ','));
const montant = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const STATUTS_BOURSE = { incomplet: 'En préparation', a_corriger: 'En préparation', soumis: 'Envoyé à l’ANBG', valide: 'Envoyé à l’ANBG' };

// Accueil de l'étudiant (et de son parent) : où il en est en un coup d'œil
// (résultat du dernier semestre, assiduité, cours du jour, frais, messages,
// bourse) et l'accès direct à chaque rubrique.
export default function Accueil({ eleveId, eleve, onNaviguer }) {
  const { profil } = useAuth();
  const estOuverte = useFonctionnaliteOuverte();
  const parent = Boolean(profil?.modeParent);
  const [resultat, setResultat] = useState(null);
  const [absences, setAbsences] = useState(null);
  const [cours, setCours] = useState(null);
  const [frais, setFrais] = useState(null);
  const [messages, setMessages] = useState(null);
  const [bourse, setBourse] = useState(null);

  function charger() {
    if (!eleveId) return;
    client.get('/semestres').then(async (r) => {
      const dernier = r.data.semestres[r.data.semestres.length - 1];
      if (!dernier) { setResultat({ vide: true }); return; }
      const b = await client.get(`/bulletins/${eleveId}/${dernier.id}`).catch(() => null);
      setResultat(b ? { semestre: dernier, moyenne: b.data.bulletin?.moyenneGenerale, credits: b.data.creditsTotal, admis: b.data.admis, jury: b.data.decisionJury } : { semestre: dernier });
    }).catch(() => setResultat({ vide: true }));
    client.get(`/absences/eleve/${eleveId}`).then((r) => setAbsences(r.data.absences)).catch(() => setAbsences([]));
    if (eleve?.classeId && estOuverte('emplois-du-temps')) client.get(`/emplois-du-temps?classeId=${eleve.classeId}`).then((r) => setCours(r.data.emplois)).catch(() => setCours([]));
    if (estOuverte('frais-en-ligne')) client.get(`/finance/frais/eleve/${eleveId}`).then((r) => setFrais(r.data.frais)).catch(() => setFrais([]));
    if (estOuverte('communication')) client.get('/messages').then((r) => setMessages(r.data.messages)).catch(() => setMessages([]));
    if (!parent) client.get('/bourse/moi').then((r) => setBourse(r.data.dossier)).catch(() => {});
  }
  useEffect(charger, [eleveId, eleve?.classeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useActualisation(charger, { domaines: ['notes', 'absences', 'emplois-du-temps', 'finance', 'messages', 'bourse', 'bulletins'] });

  const jour = JOURS[(new Date().getDay() + 6) % 7];
  const coursDuJour = (cours || []).filter((c) => c.jour === jour).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  const nonJustifiees = (absences || []).filter((a) => a.type !== 'retard' && !a.justifie).length;
  const retards = (absences || []).filter((a) => a.type === 'retard').length;
  const resteDu = (frais || []).reduce((s, f) => s + Math.max(0, (f.montant || 0) - (f.montantRegle || 0)), 0);
  const dernierMessage = (messages || [])[0];
  const decision = resultat?.jury || (resultat?.admis ? 'Semestre validé' : resultat?.moyenne != null ? 'Rattrapage' : null);

  return (
    <div className="accueil-etudiant">
      <section className="console-entete">
        <div>
          <p className="console-date">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2>{parent ? `Dossier de ${profil?.prenom}` : `Bonjour ${profil?.prenom}.`}</h2>
          <p className="console-etat">{[eleve?.Classe?.nom, eleve?.matricule && `matricule ${eleve.matricule}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="console-actions">
          <button type="button" className="primaire" onClick={() => onNaviguer('bulletin')}><IconDocument /> {parent ? 'Voir le bulletin' : 'Mon bulletin'}</button>
          <button type="button" className="secondaire" onClick={() => onNaviguer('documents')}><IconClipboard /> Documents officiels</button>
        </div>
      </section>

      <dl className="console-chiffres">
        <div className={resultat?.admis === false && resultat?.moyenne != null ? 'attention' : ''}>
          <dt><IconGraduationCap aria-hidden="true" /> Moyenne {resultat?.semestre ? `· ${resultat.semestre.libelle}` : ''}</dt>
          <dd>{resultat ? note(resultat.moyenne) : '…'}</dd>
          <small>{resultat ? (decision || 'Bulletin pas encore établi') : ''}</small>
        </div>
        <div>
          <dt><IconClipboard aria-hidden="true" /> Crédits validés</dt>
          <dd>{resultat?.credits ?? (resultat ? 0 : '…')}</dd>
          <small>{resultat?.semestre ? resultat.semestre.anneeScolaire : ''}</small>
        </div>
        <div className={nonJustifiees ? 'attention' : ''}>
          <dt><IconCalendarAlert aria-hidden="true" /> Absences non justifiées</dt>
          <dd>{absences ? nonJustifiees : '…'}</dd>
          <small>{absences ? `${retards} retard${retards > 1 ? 's' : ''}` : ''}</small>
        </div>
        <div className={resteDu ? 'attention' : ''}>
          <dt><IconReceipt aria-hidden="true" /> Reste à payer</dt>
          <dd className="petit">{frais ? (resteDu ? montant(resteDu) : 'À jour') : estOuverte('frais-en-ligne') ? '…' : 'N/A'}</dd>
          <small>{frais ? `${frais.length} frais` : ''}</small>
        </div>
      </dl>

      <div className="console-grille">
        <section className="carte">
          <div className="entete-carte">
            <h2>Cours d’aujourd’hui</h2>
            {estOuverte('emplois-du-temps') && <button type="button" className="bouton-texte" onClick={() => onNaviguer('emploi')}>Emploi du temps <IconChevronRight /></button>}
          </div>
          {!estOuverte('emplois-du-temps') && <div className="vide">L’emploi du temps n’est pas proposé par l’établissement.</div>}
          {estOuverte('emplois-du-temps') && cours && coursDuJour.length === 0 && <div className="vide">{jour ? `Aucun cours prévu ce ${jour.toLowerCase()}.` : 'Aucun cours le dimanche.'}</div>}
          <ul className="liste-cours-jour">
            {coursDuJour.map((c) => (
              <li key={c.id}>
                <span className="cours-heure">{c.heureDebut} à {c.heureFin}</span>
                <span className="cours-texte"><strong>{c.matiere || 'Cours'}</strong>{c.salle && <small>Salle {c.salle}</small>}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="carte">
          <div className="entete-carte"><h2>À suivre</h2></div>
          <ul className="liste-a-suivre">
            {estOuverte('communication') && (
              <li>
                <IconMessage aria-hidden="true" />
                <span><strong>{dernierMessage ? dernierMessage.titre : 'Aucun message'}</strong>{dernierMessage && <small>{new Date(dernierMessage.dateEnvoi).toLocaleDateString('fr-FR')}</small>}</span>
                <button type="button" className="bouton-texte" onClick={() => onNaviguer('messages')}>Messages <IconChevronRight /></button>
              </li>
            )}
            {!parent && (
              <li>
                <IconGraduationCap aria-hidden="true" />
                <span><strong>Bourse ANBG</strong><small>{bourse ? (STATUTS_BOURSE[bourse.statut] || 'En préparation') : 'Dossier non commencé'}</small></span>
                <button type="button" className="bouton-texte" onClick={() => onNaviguer('bourse')}>Ouvrir <IconChevronRight /></button>
              </li>
            )}
            <li>
              <IconCalendar aria-hidden="true" />
              <span><strong>Absences et retards</strong><small>{absences ? `${absences.length} enregistrement${absences.length > 1 ? 's' : ''}` : ''}</small></span>
              <button type="button" className="bouton-texte" onClick={() => onNaviguer('absences')}>Détail <IconChevronRight /></button>
            </li>
            <li>
              <IconClipboard aria-hidden="true" />
              <span><strong>Relevé de notes</strong><small>Notes de contrôle continu et d’examen</small></span>
              <button type="button" className="bouton-texte" onClick={() => onNaviguer('notes')}>Voir <IconChevronRight /></button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
