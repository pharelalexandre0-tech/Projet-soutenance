import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import AnneauProgression from '../../components/AnneauProgression';
import ChiffreAnime from '../../components/ChiffreAnime';
import {
  IconDashboard, IconUsers, IconKey, IconPencil, IconCalendarAlert, IconAlertTriangle, IconDocument, IconUserPlus, IconCircleCheck,
  IconShield, IconMessage, IconBanknote, IconChevronRight,
} from '../../components/icons';
import { totalElevesParClasses } from '../../utils/totaux';
import { useFonctionnaliteOuverte } from '../../context/PlateformeContext';

function niveauAbsenteisme(taux) {
  if (taux <= 5) return 'vert';
  if (taux <= 15) return 'or';
  return 'rouge';
}
function couleurReussite(taux) {
  if (taux >= 70) return 'var(--succes)';
  if (taux >= 40) return 'var(--alerte)';
  return 'var(--erreur)';
}

const ICONES_JOURNAL = {
  inscription: IconUserPlus, notes: IconCircleCheck, absences: IconCalendarAlert, incident: IconAlertTriangle,
  paiements: IconBanknote, professeur: IconKey, documents: IconShield, message: IconMessage,
};

function libelleJour(iso) {
  const d = new Date(iso);
  const aujourdhui = new Date();
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  if (d.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === hier.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Journal des sept derniers jours de l'école, regroupé par jour : ce qui a
// été inscrit, saisi, signalé, payé, émis, avec un lien vers la page où agir.
function JournalDuJour({ evenements, onNaviguer }) {
  if (!evenements) return <div className="chargement">Chargement…</div>;
  if (evenements.length === 0) return <div className="vide">Aucune activité ces sept derniers jours.</div>;
  const parJour = [];
  evenements.forEach((e) => {
    const libelle = libelleJour(e.heure);
    const dernier = parJour[parJour.length - 1];
    if (dernier?.libelle === libelle) dernier.lignes.push(e); else parJour.push({ libelle, lignes: [e] });
  });
  return parJour.map((j) => (
    <div key={j.libelle}>
      <h3 className="journal-jour-date">{j.libelle}</h3>
      <ol className="journal-jour">
        {j.lignes.map((e, i) => {
          const Icone = ICONES_JOURNAL[e.type] || IconDocument;
          return (
            <li key={`${e.type}-${e.heure}-${i}`}>
              <span className="journal-heure">{new Date(e.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className={`journal-pastille ${e.ton}`}><Icone /></span>
              <span className="journal-texte"><strong>{e.titre}</strong>{e.detail && <span>{e.detail}</span>}</span>
              {e.page ? <button type="button" className="bouton-texte" onClick={() => onNaviguer?.(e.page)}>Ouvrir <IconChevronRight /></button> : <span />}
            </li>
          );
        })}
      </ol>
    </div>
  ));
}

export default function TableauDeBord({ onNaviguer }) {
  const estOuverte = useFonctionnaliteOuverte();
  const [classes, setClasses] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [absences, setAbsences] = useState(null);
  const [academique, setAcademique] = useState(null);
  const [journal, setJournal] = useState(null);

  function charger() {
    client.get('/tableau-de-bord/journal').then((res) => setJournal(res.data.evenements)).catch(() => setJournal((j) => j || []));
    client.get('/classes').then((res) => setClasses(res.data.classes)).catch(() => {});
    client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs)).catch(() => {});
    client.get('/absences/statistiques').then((res) => setAbsences(res.data)).catch(() => {});
    client.get('/tableau-de-bord/academique').then((res) => setAcademique(res.data)).catch(() => {});
  }
  useEffect(charger, []);
  // Les moyennes par UE demandent un calcul complet : un seul rechargement
  // pour une série de changements rapprochés.
  useActualisation(charger, { delai: 1500 });

  const totalEleves = totalElevesParClasses(classes);
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
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Moyenne générale</span>
            <span className="puce-icone petite"><IconDocument width={16} height={16} /></span>
          </div>
          <div className="valeur">
            {academique?.moyenneGenerale != null ? <ChiffreAnime valeur={academique.moyenneGenerale} suffixe="/20" /> : 'N/A'}
          </div>
        </div>
        <div className={`stat-tile tile-${niveauAbsenteisme(tauxNonJustifie)}`}>
          <div className="stat-tile-haut">
            <span className="libelle">Absences non justifiées</span>
            <span className="puce-icone petite"><IconCalendarAlert width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={tauxNonJustifie} suffixe="%" /></div>
        </div>
      </div>

      <div className="accueil-dossier">
        <section className="carte">
          <div className="entete-carte"><h2>Journal de l’établissement</h2><span className="note-secondaire">7 derniers jours</span></div>
          <JournalDuJour evenements={journal} onNaviguer={onNaviguer} />
        </section>
        <div className="colonne-empilee">
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
              {estOuverte('acces-temporaires') && (
                <button className="action-rapide" onClick={() => onNaviguer?.('comptes')}>
                  <span className="puce-icone petite"><IconKey width={16} height={16} /></span>
                  Générer un accès professeur
                </button>
              )}
              {estOuverte('prediction') && (
                <button className="action-rapide" onClick={() => onNaviguer?.('prediction')}>
                  <span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span>
                  Voir les alertes décrochage
                </button>
              )}
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

        </div>
      </div>

      <div className="grille-2">
        <div className="carte">
          <h2>Effectif par classe</h2>
          {classes.length === 0 && <div className="vide">Aucune classe pour le moment</div>}
          <div className="barres-liste">
            {classes.map((c) => {
              const effectif = c.Eleves?.length ?? 0;
              return (
                <div className="barre-ligne" key={c.id}>
                  <span>{c.nom} ({c.niveau})</span>
                  <div className="barre-piste">
                    <div className="barre-remplissage" style={{ width: `${(effectif / maxEffectif) * 100}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--police-mono)' }}>{effectif}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="carte">
          <h2>Taux de réussite par UE</h2>
          {(!academique || academique.reussiteParUE.length === 0) && <div className="vide">Aucune moyenne calculée pour le moment</div>}
          <div className="barres-liste">
            {academique?.reussiteParUE.map((u) => (
              <div className="barre-ligne" key={u.code}>
                <span>{u.intitule}</span>
                <div className="barre-piste">
                  <div className="barre-remplissage" style={{ width: `${u.tauxReussite}%`, background: couleurReussite(u.tauxReussite) }} />
                </div>
                <span style={{ textAlign: 'right', fontFamily: 'var(--police-mono)' }}>{u.tauxReussite}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
