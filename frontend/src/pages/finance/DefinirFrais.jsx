import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { IconBanknote } from '../../components/icons';

const STYLE_STATUT = { du: 'gris', partiel: 'or', solde: 'vert', impaye: 'rouge', sans_frais: 'gris' };
const LIBELLE_STATUT = { du: 'dû', partiel: 'partiel', solde: 'à jour', impaye: 'impayé', sans_frais: 'sans frais' };

// Dès qu'un étudiant est inscrit, la Finance doit voir son frais sans avoir
// à le créer élève par élève : la classe entière se règle en un geste
// ("Définir pour une classe"), et chaque élève reste visible avec net à
// payer / versé / reste, avec la possibilité d'encaisser directement depuis
// la liste — pas seulement pour les impayés (voir l'onglet dédié pour ça).
export default function DefinirFrais() {
  const [niveaux, setNiveaux] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modaleClasseOuverte, setModaleClasseOuverte] = useState(false);
  const [eleveEnPaiement, setEleveEnPaiement] = useState(null);
  const [eleveSansFrais, setEleveSansFrais] = useState(null);
  const [toast, setToast] = useState(null);

  function charger() {
    setChargement(true);
    client.get('/finance/impayes/par-classe').then((res) => {
      setNiveaux(res.data.niveaux);
      setChargement(false);
    });
  }
  useEffect(charger, []);

  const totalEleves = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.length, 0), 0);
  const totalNetAPayer = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.reduce((s3, e) => s3 + e.totalDu, 0), 0), 0);
  const totalVerse = niveaux.reduce((s, n) => s + n.classes.reduce((s2, c) => s2 + c.eleves.reduce((s3, e) => s3 + e.totalRegle, 0), 0), 0);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Net à payer</span><span className="puce-icone petite"><IconBanknote width={16} height={16} /></span></div>
          <div className="valeur">{totalNetAPayer.toLocaleString('fr-FR')}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Déjà versé</span></div>
          <div className="valeur">{totalVerse.toLocaleString('fr-FR')}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Reste dû</span></div>
          <div className="valeur">{(totalNetAPayer - totalVerse).toLocaleString('fr-FR')}</div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="puce-icone petite"><IconBanknote width={16} height={16} /></span>
            <h2>Frais de scolarité — {totalEleves} étudiant{totalEleves > 1 ? 's' : ''}</h2>
          </div>
          <button className="primaire" onClick={() => setModaleClasseOuverte(true)}>+ Définir pour une classe</button>
        </div>

        {chargement && <div className="chargement">Chargement…</div>}
        {!chargement && niveaux.length === 0 && <div className="vide">Aucune classe enregistrée</div>}

        {niveaux.map(({ niveau, classes }) => (
          <div className="roster-niveau" key={niveau}>
            <h3 className="roster-niveau-titre">{niveau}</h3>
            {classes.map((classe) => (
              <div className="roster-classe" key={classe.id}>
                <div className="roster-classe-entete">
                  <span>{classe.nom}</span>
                  <span className="roster-classe-compteur">{classe.eleves.length} élève{classe.eleves.length > 1 ? 's' : ''}</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Étudiant</th><th>Net à payer</th><th>Versé</th><th>Reste</th><th>Statut</th><th></th></tr></thead>
                    <tbody>
                      {classe.eleves.map((eleve) => (
                        <tr key={eleve.id}>
                          <td>{eleve.prenom} {eleve.nom}</td>
                          <td className="note-secondaire">{eleve.totalDu.toLocaleString('fr-FR')} FCFA</td>
                          <td className="note-secondaire">{eleve.totalRegle.toLocaleString('fr-FR')} FCFA</td>
                          <td>{eleve.resteDu > 0 ? `${eleve.resteDu.toLocaleString('fr-FR')} FCFA` : '—'}</td>
                          <td><span className={`badge ${STYLE_STATUT[eleve.statutGlobal]}`}>{LIBELLE_STATUT[eleve.statutGlobal]}</span></td>
                          <td>
                            {eleve.fraisActifId && (
                              <button className="secondaire" onClick={() => setEleveEnPaiement({ ...eleve, classeNom: classe.nom })}>Encaisser</button>
                            )}
                            {eleve.statutGlobal === 'sans_frais' && (
                              <button className="secondaire" onClick={() => setEleveSansFrais({ ...eleve, classeNom: classe.nom })}>Définir un frais</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {classe.eleves.length === 0 && <tr><td colSpan={6} className="vide">Aucun élève dans cette classe</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {modaleClasseOuverte && (
        <FormulaireFraisClasse
          onFermer={() => setModaleClasseOuverte(false)}
          onReussi={(msg) => { setModaleClasseOuverte(false); charger(); setToast({ message: msg, type: 'succes' }); }}
        />
      )}
      {eleveSansFrais && (
        <FormulaireFraisEleve
          eleve={eleveSansFrais}
          onFermer={() => setEleveSansFrais(null)}
          onReussi={() => { setEleveSansFrais(null); charger(); setToast({ message: 'Frais défini.', type: 'succes' }); }}
        />
      )}
      {eleveEnPaiement && (
        <FormulairePaiementRapide
          eleve={eleveEnPaiement}
          onFermer={() => setEleveEnPaiement(null)}
          onReussi={() => { setEleveEnPaiement(null); charger(); setToast({ message: 'Paiement enregistré.', type: 'succes' }); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}

function FormulaireFraisClasse({ onFermer, onReussi }) {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [form, setForm] = useState({ classeId: '', semestreId: '', libelle: '', montant: '', dateEcheance: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/finance/frais/classe', {
        ...form, classeId: Number(form.classeId), semestreId: Number(form.semestreId), montant: Number(form.montant),
      });
      const { nombreCrees, nombreDejaExistants } = res.data;
      onReussi(
        nombreDejaExistants > 0
          ? `Frais défini pour ${nombreCrees} étudiant(s) — ${nombreDejaExistants} en avaient déjà un pour ce libellé.`
          : `Frais défini pour ${nombreCrees} étudiant(s).`
      );
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de définir ce frais');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Définir un frais pour toute une classe" onFermer={onFermer} largeur={520}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ">
            <label>Classe</label>
            <select value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })} required>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Semestre</label>
            <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
              <option value="">—</option>
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label>Libellé</label>
          <input placeholder="ex. Frais de scolarité — Semestre 1" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Montant par étudiant (FCFA)</label><input type="number" min="0" placeholder="150 000" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ"><label>Échéance</label><input type="date" value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} required /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Application…' : 'Appliquer à la classe'}</button>
      </form>
    </Modal>
  );
}

function FormulaireFraisEleve({ eleve, onFermer, onReussi }) {
  const [semestres, setSemestres] = useState([]);
  const [form, setForm] = useState({ semestreId: '', libelle: '', montant: '', dateEcheance: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => { client.get('/semestres').then((res) => setSemestres(res.data.semestres)); }, []);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/finance/frais', { ...form, eleveId: eleve.id, semestreId: Number(form.semestreId), montant: Number(form.montant) });
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de définir ce frais');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Définir un frais — ${eleve.prenom} ${eleve.nom}`} onFermer={onFermer} largeur={480}>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="champ">
          <label>Semestre</label>
          <select value={form.semestreId} onChange={(e) => setForm({ ...form, semestreId: e.target.value })} required>
            <option value="">—</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
        <div className="champ">
          <label>Libellé</label>
          <input placeholder="ex. Frais de scolarité — Semestre 1" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
        </div>
        <div className="ligne-champs">
          <div className="champ"><label>Montant (FCFA)</label><input type="number" min="0" placeholder="150 000" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ"><label>Échéance</label><input type="date" value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} required /></div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Définir le frais'}</button>
      </form>
    </Modal>
  );
}

function FormulairePaiementRapide({ eleve, onFermer, onReussi }) {
  const [form, setForm] = useState({ montant: '', modePaiement: 'especes' });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/finance/paiements', { fraisId: eleve.fraisActifId, montant: Number(form.montant), modePaiement: form.modePaiement });
      onReussi();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'erreur (montant incorrect)');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre={`Encaisser — ${eleve.prenom} ${eleve.nom}`} onFermer={onFermer} largeur={440}>
      <p className="note-secondaire" style={{ marginTop: -8 }}>{eleve.classeNom} — reste dû {eleve.resteDu.toLocaleString('fr-FR')} FCFA</p>
      <form className="formulaire" onSubmit={soumettre}>
        <div className="ligne-champs">
          <div className="champ"><label>Montant (FCFA)</label><input type="number" min="0" max={eleve.resteDu} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          <div className="champ">
            <label>Mode de paiement</label>
            <select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })}>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile money</option>
              <option value="virement">Virement</option>
            </select>
          </div>
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Encaisser'}</button>
      </form>
    </Modal>
  );
}
