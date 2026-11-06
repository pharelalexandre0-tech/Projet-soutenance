import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { useAuth } from '../../context/AuthContext';
import { IconDocument } from '../../components/icons';

const note = (n) => (n == null ? '-' : String(Math.round(n * 100) / 100).replace('.', ','));
const DECISIONS = { passage: 'Passage', passage_dette: 'Passage avec dette', redoublement: 'Redoublement', sortie: 'Sortie' };
const TONS = { acquise: 'vert', acquise_rattrapage: 'vert', compensee: 'bleu', jury: 'bleu', deja_acquise: 'gris', repassee: 'gris', eliminatoire: 'rouge', non_validee: 'or' };

// Parcours LMD de l'étudiant (et de son parent) : crédits acquis sur tout le
// cycle, UE à repasser, détail par semestre et le système expliqué simplement.
export default function MonParcours({ onNaviguer }) {
  const { profil } = useAuth();
  const parent = Boolean(profil?.modeParent);
  const [p, setP] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => client.get('/scolarite/parcours').then((r) => { setP(r.data); setErreur(false); }).catch(() => setErreur(true));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['notes', 'comptes-ephemeres', 'unites-enseignement', 'matieres', 'semestres', 'formations', 'deliberations', 'passage', 'etablissement'] });

  if (erreur) return <div className="message-erreur">Le parcours n’a pas pu être chargé. Réessayez dans un instant.</div>;
  if (!p) return <div className="chargement">Chargement…</div>;

  // Un repère par année du cycle (60 crédits par an en LMD).
  const annees = p.creditsRequis % 60 === 0 ? p.creditsRequis / 60 : 0;
  const prefixe = p.cycle === 'master' ? 'M' : p.cycle === 'licence' ? 'L' : 'Année ';
  const r = p.regles;

  return (
    <div className="parcours-lmd">
      <section className="carte">
        <div className="entete-carte">
          <h2>{parent ? 'Parcours LMD de votre enfant' : 'Mon parcours LMD'}</h2>
          <button type="button" className="secondaire" onClick={() => onNaviguer?.('documents')}><IconDocument /> Relevé officiel</button>
        </div>
        <p className="parcours-formation">
          {[p.libelleCycle, p.formation?.mention, p.formation?.parcours, p.classe?.nom].filter(Boolean).join(' · ')}
        </p>
        <p className="parcours-cumul"><strong>{p.creditsAcquis}</strong> crédits acquis sur {p.creditsRequis}</p>
        <div className="parcours-jauge" role="progressbar" aria-valuemin={0} aria-valuemax={p.creditsRequis} aria-valuenow={p.creditsAcquis} aria-label={`${p.creditsAcquis} crédits acquis sur ${p.creditsRequis}`}>
          <span style={{ width: `${p.pourcentage}%` }} />
          {annees > 1 && Array.from({ length: annees - 1 }, (_, i) => <i key={i} style={{ left: `${((i + 1) / annees) * 100}%` }} />)}
        </div>
        {annees > 1 && (
          <div className="parcours-reperes" style={{ gridTemplateColumns: `repeat(${annees}, 1fr)` }}>
            {Array.from({ length: annees }, (_, i) => <span key={i}>{prefixe}{i + 1}</span>)}
          </div>
        )}
        <dl className="parcours-chiffres">
          <div><dt>Crédits restants</dt><dd>{p.creditsRestants}</dd></div>
          <div><dt>UE à repasser</dt><dd>{p.dettes.length}</dd></div>
          <div><dt>Crédits à récupérer</dt><dd>{p.dettes.reduce((s, d) => s + d.credits, 0)}</dd></div>
          <div><dt>Semestres évalués</dt><dd>{p.semestres.length}</dd></div>
        </dl>
        {p.autresCycles.map((c) => <p key={c.cycle} className="note-secondaire">Cycle {c.libelle} précédent : {c.creditsAcquis} crédits acquis.</p>)}
      </section>

      {p.dettes.length > 0 && (
        <section className="carte">
          <div className="entete-carte"><h2>UE à repasser <span className="entete-carte-compteur">{p.dettes.length}</span></h2></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Code</th><th>Unité d’enseignement</th><th>Semestre</th><th>Année</th><th className="cellule-nombre">Crédits</th><th className="cellule-nombre">Moyenne</th><th>Résultat</th></tr></thead>
              <tbody>
                {p.dettes.map((d) => (
                  <tr key={`${d.semestreId}-${d.ueId}`}>
                    <td className="mono">{d.code}</td><td>{d.intitule}</td><td>{d.semestre}</td><td>{d.anneeScolaire}</td>
                    <td className="cellule-nombre">{d.credits}</td><td className="cellule-nombre">{note(d.moyenne)}</td>
                    <td><span className={`badge ${TONS[d.etat] || 'or'}`}>{d.libelle}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="carte">
        <div className="entete-carte"><h2>Résultats par semestre</h2></div>
        {p.semestres.length === 0 && <div className="vide">Aucune note enregistrée pour le moment.</div>}
        {p.semestres.map((s) => (
          <div key={s.id} className="parcours-semestre">
            <div className="parcours-semestre-titre">
              <h3>{s.libelle} <small>{s.anneeScolaire}</small></h3>
              <span className="note-secondaire">Moyenne {note(s.moyenne)}, {s.creditsValides} crédits sur {s.creditsTotal}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Code</th><th>Unité d’enseignement</th><th className="cellule-nombre">Crédits</th><th className="cellule-nombre">Moyenne</th><th>Résultat</th></tr></thead>
                <tbody>
                  {s.ues.map((u) => (
                    <tr key={u.ueId}>
                      <td className="mono">{u.code}</td><td>{u.intitule}</td>
                      <td className="cellule-nombre">{u.credits}</td><td className="cellule-nombre">{note(u.moyenne)}</td>
                      <td><span className={`badge ${TONS[u.etat] || 'gris'}`}>{u.libelle}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {p.aVenir.length > 0 && (
        <section className="carte">
          <div className="entete-carte"><h2>Programme restant <span className="entete-carte-compteur">{p.aVenir.length}</span></h2></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Code</th><th>Unité d’enseignement</th><th>Semestre</th><th className="cellule-nombre">Crédits</th></tr></thead>
              <tbody>{p.aVenir.map((u) => <tr key={u.ueId}><td className="mono">{u.code}</td><td>{u.intitule}</td><td>{u.semestre}</td><td className="cellule-nombre">{u.credits}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {p.historique.length > 0 && (
        <section className="carte">
          <div className="entete-carte"><h2>Décisions de fin d’année</h2></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Année</th><th>Classe quittée</th><th>Décision</th><th>Classe d’arrivée</th><th className="cellule-nombre">Moyenne</th></tr></thead>
              <tbody>{p.historique.map((h) => <tr key={h.id}><td>{h.anneeScolaire}</td><td>{h.classeDepart}</td><td>{DECISIONS[h.decision]}</td><td>{h.classeArrivee || ''}</td><td className="cellule-nombre">{note(h.moyenneAnnuelle)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="carte">
        <div className="entete-carte"><h2>Le système LMD en clair</h2></div>
        <dl className="parcours-explications">
          <div><dt>Licence, Master, Doctorat</dt><dd>La licence dure 6 semestres, le master 4 semestres. Le doctorat vient ensuite. Chaque semestre vaut en principe 30 crédits : 180 crédits pour la licence, 120 pour le master.</dd></div>
          <div><dt>Unité d’enseignement (UE)</dt><dd>Une UE regroupe plusieurs matières et rapporte un nombre de crédits. Ses crédits s’obtiennent en entier : c’est tout ou rien.</dd></div>
          <div><dt>Valider une UE</dt><dd>Il faut au moins {note(r.seuil)}/20 de moyenne à l’UE, et aucune matière sous {note(r.eliminatoire)}/20, la note éliminatoire de l’établissement.</dd></div>
          <div><dt>Le rattrapage</dt><dd>Une UE non validée peut être repassée. La note retenue est la moyenne de la session normale et du rattrapage. Si elle atteint le seuil, l’UE est validée et donne ses crédits.</dd></div>
          <div><dt>Une UE acquise le reste</dt><dd>Une UE validée est gardée pour toujours dans le cycle, même en cas de redoublement : on ne la repasse pas.</dd></div>
          <div><dt>La compensation</dt><dd>{r.compensationActive ? `Dans cet établissement, une UE d’au moins ${note(r.noteMinCompensation)}/20, sans matière éliminatoire, est compensée si la moyenne du semestre atteint ${note(r.seuil)}/20.` : 'Cet établissement n’applique pas de compensation entre les UE : chaque UE se valide seule.'}</dd></div>
          <div><dt>Passer avec des UE à repasser</dt><dd>{r.passageDetteActif ? `Dans cet établissement, on peut passer en année supérieure avec des UE à repasser à partir de ${note(r.creditsMinPassagePct)} % des crédits de l’année. Ces UE restent dues.` : 'Cet établissement n’a pas ouvert le passage avec dette : il faut valider toutes ses UE, sauf décision du jury ou de l’Académie.'}</dd></div>
        </dl>
      </section>
    </div>
  );
}
