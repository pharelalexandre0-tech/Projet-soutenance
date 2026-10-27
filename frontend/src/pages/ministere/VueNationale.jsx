import { useNational, pct, nombre, note, dateFr, BarreTaux, EtatChargement, tonReussite } from './commun';
import { IconBuilding, IconUsers, IconGraduationCap, IconTrendingDown, IconShield, IconChevronRight, IconCalendarAlert } from '../../components/icons';

// Accueil du ministère : la situation nationale d'un coup d'œil.
export default function VueNationale({ onNaviguer }) {
  const { donnees, erreur } = useNational();
  if (!donnees) return <EtatChargement erreur={erreur} />;
  const t = donnees.totaux;
  const maxProvince = Math.max(1, ...donnees.parProvince.map((p) => p.effectif));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Établissements sous tutelle</span><span className="puce-icone petite"><IconBuilding /></span></div>
          <div className="valeur">{t.etablissements}</div>
          <small className="stat-tile-note">{t.agrees} agréé{t.agrees > 1 ? 's' : ''}, {t.enInstruction} en instruction</small>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Étudiants inscrits</span><span className="puce-icone petite"><IconUsers /></span></div>
          <div className="valeur">{nombre(t.effectif)}</div>
          <small className="stat-tile-note">{nombre(t.enseignants)} enseignants</small>
        </div>
        <div className="stat-tile" style={{ '--tuile': tonReussite(t.tauxReussite) }}>
          <div className="stat-tile-haut"><span className="libelle">Taux de réussite national</span><span className="puce-icone petite"><IconGraduationCap /></span></div>
          <div className="valeur">{pct(t.tauxReussite)}</div>
          <small className="stat-tile-note">{nombre(t.admis)} admis sur {nombre(t.evalues)} évalués</small>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Moyenne nationale</span><span className="puce-icone petite"><IconGraduationCap /></span></div>
          <div className="valeur">{note(t.moyenne)}<small className="valeur-unite">/20</small></div>
        </div>
        <div className={`stat-tile ${t.risqueEleve ? 'tile-rouge' : ''}`}>
          <div className="stat-tile-haut"><span className="libelle">Étudiants à risque élevé</span><span className="puce-icone petite"><IconTrendingDown /></span></div>
          <div className="valeur">{nombre(t.risqueEleve)}</div>
          <small className="stat-tile-note">{nombre(t.risqueMoyen)} à risque moyen</small>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Documents certifiés</span><span className="puce-icone petite"><IconShield /></span></div>
          <div className="valeur">{nombre(t.documentsEmis)}</div>
          <small className="stat-tile-note">{nombre(t.documentsVerifies)} vérification(s) en ligne</small>
        </div>
      </div>

      <div className="accueil-dossier">
        <section className="carte">
          <div className="entete-carte"><h2>Répartition par province</h2><span className="note-secondaire">{donnees.parProvince.length} province(s) représentée(s)</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Province</th><th>Établissements</th><th>Étudiants</th><th>Poids</th><th>Évalués</th><th>Réussite</th><th>À risque élevé</th></tr></thead>
              <tbody>
                {donnees.parProvince.map((p) => (
                  <tr key={p.cle}>
                    <td className="cellule-nom">{p.libelle}</td>
                    <td className="cellule-nombre">{p.etablissements}</td>
                    <td className="cellule-nombre">{nombre(p.effectif)}</td>
                    <td><div className="barre-piste mini"><div className="barre-remplissage" style={{ width: `${(p.effectif / maxProvince) * 100}%` }} /></div></td>
                    <td className="cellule-nombre">{nombre(p.evalues)}</td>
                    <td className="cellule-nombre" style={{ color: tonReussite(p.tauxReussite), fontWeight: 700 }}>{pct(p.tauxReussite)}</td>
                    <td className="cellule-nombre">{nombre(p.risqueEleve)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note-bas">Provinces sans établissement affilié : {donnees.provinces.filter((p) => !donnees.parProvince.some((x) => x.cle === p)).join(', ') || 'aucune'}.</p>
        </section>

        <div className="colonne-empilee">
          <section className="carte">
            <h2>Agréments</h2>
            <dl className="registre-chiffres">
              <div><dt>Agréés</dt><dd className="ton-vert">{t.agrees}</dd></div>
              <div><dt>Provisoires</dt><dd>{t.provisoires}</dd></div>
              <div><dt>En instruction</dt><dd className="ton-or">{t.enInstruction}</dd></div>
              <div><dt>Suspendus ou retirés</dt><dd className="ton-rouge">{t.suspendusOuRetires}</dd></div>
            </dl>
            <button type="button" className="bouton-texte" onClick={() => onNaviguer?.('etablissements')}>Instruire les dossiers <IconChevronRight /></button>
          </section>
          <section className="carte">
            <h2>Échéances d’agrément (90 jours)</h2>
            {donnees.agrementsAEcheance.length === 0 && <div className="vide">Aucun agrément n’arrive à échéance.</div>}
            <ul className="liste-echeances">
              {donnees.agrementsAEcheance.map((a) => (
                <li key={a.id}><IconCalendarAlert /><span><strong>{a.nom}</strong><small>{a.libelleAgrement}, expire le {dateFr(a.agrementExpiration)}</small></span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="grille-2">
        <section className="carte">
          <h2>Réussite par niveau</h2>
          {donnees.parNiveau.length === 0 && <div className="vide">Aucune note enregistrée dans les établissements.</div>}
          <div className="barres-liste">
            {donnees.parNiveau.map((n) => <BarreTaux key={n.niveau} libelle={n.niveau} taux={n.tauxReussite} sousLibelle={`${nombre(n.evalues)} évalués, moyenne ${note(n.moyenne)}`} />)}
          </div>
        </section>
        <section className="carte">
          <h2>Réussite par type d’établissement</h2>
          <div className="barres-liste">
            {donnees.parType.map((p) => <BarreTaux key={p.cle} libelle={p.libelle} taux={p.tauxReussite} sousLibelle={`${p.etablissements} établissement(s), ${nombre(p.effectif)} étudiants`} />)}
          </div>
        </section>
      </div>
      <p className="note-bas">
        Données agrégées par établissement, sans aucune information nominative, lues {donnees.lectureRestreinte ? 'par un accès PostgreSQL en lecture seule limité aux vues statistiques' : 'depuis la base'} le {new Date(donnees.calculeLe).toLocaleString('fr-FR')}.
      </p>
    </>
  );
}
