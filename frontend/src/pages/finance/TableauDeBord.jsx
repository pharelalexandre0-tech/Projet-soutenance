import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import AnneauProgression from '../../components/AnneauProgression';
import ChiffreAnime from '../../components/ChiffreAnime';
import { IconBanknote, IconCard, IconAlertTriangle, IconWallet } from '../../components/icons';
import { totalElevesParClasses } from '../../utils/totaux';
import { useFonctionnaliteOuverte } from '../../context/PlateformeContext';
import { useAuth } from '../../context/AuthContext';

export default function TableauDeBord({ onNaviguer }) {
  const estOuverte = useFonctionnaliteOuverte();
  const { profil } = useAuth();
  const [impayes, setImpayes] = useState([]);
  const [totalEleves, setTotalEleves] = useState(0);

  function charger() {
    client.get('/finance/impayes').then((res) => setImpayes(res.data.impayes)).catch(() => {});
    client.get('/classes').then((res) => {
      setTotalEleves(totalElevesParClasses(res.data.classes));
    }).catch(() => {});
  }
  useEffect(charger, []);
  useActualisation(charger);

  const montantTotalDu = impayes.reduce((acc, f) => acc + (f.montant - f.montantRegle), 0);
  const elevesConcernes = new Set(impayes.map((f) => f.eleveId)).size;
  const enRetard = impayes.filter((f) => new Date(f.dateEcheance) < new Date()).length;
  const tauxAJour = totalEleves > 0 ? Math.round(((totalEleves - elevesConcernes) / totalEleves) * 100) : null;

  const tauxRecouvrement = tauxAJour;
  return (
    <div className="console-plateforme">
      <section className="console-entete">
        <div>
          <p className="console-date">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2>{profil?.prenom ? `Bonjour ${profil.prenom}.` : 'Situation financière'}</h2>
          <p className="console-etat">
            <span className={`point-etat ${enRetard ? 'alerte' : 'ok'}`} aria-hidden="true" />
            {impayes.length === 0 ? 'Aucun impayé : tous les étudiants sont à jour.' : `${montantTotalDu.toLocaleString('fr-FR')} FCFA restent à encaisser auprès de ${elevesConcernes} étudiant${elevesConcernes > 1 ? 's' : ''}${tauxRecouvrement != null ? ` · ${tauxRecouvrement} % à jour` : ''}.`}
          </p>
        </div>
        <div className="console-actions">
          <button type="button" className="primaire" onClick={() => onNaviguer?.('frais')}><IconBanknote /> Frais &amp; paiements</button>
          <button type="button" className="secondaire" onClick={() => onNaviguer?.('impayes')}><IconAlertTriangle /> Voir les impayés</button>
          {estOuverte('paie') && <button type="button" className="secondaire" onClick={() => onNaviguer?.('salaires')}><IconWallet /> Verser un salaire</button>}
        </div>
      </section>
      <div className="stats-grid">
        <div className={`stat-tile ${impayes.length > 0 ? 'tile-rouge' : 'tile-vert'}`}>
          <div className="stat-tile-haut">
            <span className="libelle">Frais impayés</span>
            <span className="puce-icone petite"><IconAlertTriangle width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={impayes.length} /></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">FCFA restant dû</span>
            <span className="puce-icone petite"><IconBanknote width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={montantTotalDu} formateur={(n) => n.toLocaleString('fr-FR')} /></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut">
            <span className="libelle">Élèves concernés</span>
            <span className="puce-icone petite"><IconCard width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={elevesConcernes} /></div>
        </div>
        <div className={`stat-tile ${enRetard > 0 ? 'tile-or' : 'tile-vert'}`}>
          <div className="stat-tile-haut">
            <span className="libelle">Échéances dépassées</span>
            <span className="puce-icone petite"><IconWallet width={16} height={16} /></span>
          </div>
          <div className="valeur"><ChiffreAnime valeur={enRetard} /></div>
        </div>
      </div>

      <div className="grille-3">
        <div className="carte" style={{ gridColumn: 'span 2' }}>
          <h2>Impayés les plus urgents</h2>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Élève</th><th>Libellé</th><th>Reste dû</th><th>Échéance</th></tr></thead>
              <tbody>
                {[...impayes]
                  .sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance))
                  .slice(0, 6)
                  .map((f) => (
                    <tr key={f.id}>
                      <td>{f.Eleve?.prenom} {f.Eleve?.nom}</td>
                      <td>{f.libelle}</td>
                      <td>{(f.montant - f.montantRegle).toLocaleString('fr-FR')} FCFA</td>
                      <td>{f.dateEcheance}</td>
                    </tr>
                  ))}
                {impayes.length === 0 && <tr><td colSpan={4} className="vide">Aucun impayé</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="carte panneau-anneau">
          <h2 style={{ alignSelf: 'flex-start' }}>Élèves à jour</h2>
          {tauxAJour === null ? (
            <div className="vide">Aucun élève inscrit</div>
          ) : (
            <>
              <AnneauProgression valeur={tauxAJour} sousLabel="à jour" couleur="var(--primaire)" />
              <div className="legende-anneau">
                <div className="legende-item">
                  <span className="legende-pastille" style={{ background: 'var(--primaire)' }} />
                  À jour ({totalEleves - elevesConcernes})
                </div>
                <div className="legende-item">
                  <span className="legende-pastille" style={{ background: 'var(--erreur)' }} />
                  En impayé ({elevesConcernes})
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
