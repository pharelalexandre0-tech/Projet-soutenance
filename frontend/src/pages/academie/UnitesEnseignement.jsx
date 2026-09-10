import { useEffect, useState } from 'react';
import client from '../../api/client';

const UE_VIDE = { code: '', intitule: '', credits: '', coefficient: '1', semestreId: '' };
const MATIERE_VIDE = { code: '', intitule: '', coefficient: '1' };

export default function UnitesEnseignement() {
  const [ues, setUes] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [ueOuverte, setUeOuverte] = useState(null);
  const [nouvelleUE, setNouvelleUE] = useState(UE_VIDE);
  const [nouvelleMatiere, setNouvelleMatiere] = useState(MATIERE_VIDE);
  const [message, setMessage] = useState('');

  function charger() {
    client.get('/unites-enseignement').then((res) => setUes(res.data.ues));
  }
  useEffect(() => {
    charger();
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  async function creerUE(e) {
    e.preventDefault();
    setMessage('');
    try {
      await client.post('/unites-enseignement', {
        ...nouvelleUE,
        credits: Number(nouvelleUE.credits),
        coefficient: Number(nouvelleUE.coefficient),
      });
      setMessage('UE créée.');
      setNouvelleUE(UE_VIDE);
      charger();
    } catch (err) {
      setMessage(err.response?.data?.erreur || 'erreur');
    }
  }

  async function creerMatiere(e, uniteEnseignementId) {
    e.preventDefault();
    await client.post('/matieres', {
      ...nouvelleMatiere,
      coefficient: Number(nouvelleMatiere.coefficient),
      uniteEnseignementId,
    });
    setNouvelleMatiere(MATIERE_VIDE);
    charger();
  }

  return (
    <div className="grille-2">
      <div className="carte">
        <h2>Unités d'enseignement</h2>
        <p style={{ fontSize: '0.83rem', color: 'var(--texte-clair)', marginTop: -8, marginBottom: 16 }}>
          Une UE regroupe plusieurs matières allant dans le même sens (ex. l'UE « Programmation » regroupe
          Python, PHP, Java). Clique une UE pour voir/ajouter ses matières.
        </p>
        {ues.map((ue) => (
          <div key={ue.id} style={{ marginBottom: 14, border: '1px solid var(--bordure)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setUeOuverte(ueOuverte === ue.id ? null : ue.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: 'var(--gris-fond)', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>
                <strong style={{ fontFamily: 'var(--police-mono)', fontSize: '0.8rem' }}>{ue.code}</strong>
                {' — '}{ue.intitule} <span style={{ color: 'var(--texte-clair)' }}>({ue.Semestre?.libelle}, coef. {ue.coefficient}, {ue.credits} crédits)</span>
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--texte-clair)' }}>{ue.Matieres?.length ?? 0} matière(s)</span>
            </button>

            {ueOuverte === ue.id && (
              <div style={{ padding: 14 }}>
                <table>
                  <thead><tr><th>Code</th><th>Matière</th><th>Coef.</th></tr></thead>
                  <tbody>
                    {(ue.Matieres || []).map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontFamily: 'var(--police-mono)' }}>{m.code}</td>
                        <td>{m.intitule}</td>
                        <td>{m.coefficient}</td>
                      </tr>
                    ))}
                    {(!ue.Matieres || ue.Matieres.length === 0) && <tr><td colSpan={3} className="vide">Aucune matière</td></tr>}
                  </tbody>
                </table>
                <form className="ligne-champs" style={{ marginTop: 12 }} onSubmit={(e) => creerMatiere(e, ue.id)}>
                  <div className="champ">
                    <label>Code</label>
                    <input placeholder="ex. PROG-PY" value={nouvelleMatiere.code} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, code: e.target.value })} required />
                  </div>
                  <div className="champ">
                    <label>Matière</label>
                    <input placeholder="ex. Python" value={nouvelleMatiere.intitule} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, intitule: e.target.value })} required />
                  </div>
                  <div className="champ" style={{ maxWidth: 90 }}>
                    <label>Coef.</label>
                    <input type="number" min="0.5" step="0.5" value={nouvelleMatiere.coefficient} onChange={(e) => setNouvelleMatiere({ ...nouvelleMatiere, coefficient: e.target.value })} required />
                  </div>
                  <button className="secondaire" type="submit" style={{ alignSelf: 'flex-end' }}>Ajouter la matière</button>
                </form>
              </div>
            )}
          </div>
        ))}
        {ues.length === 0 && <div className="vide">Aucune UE pour le moment</div>}
      </div>

      <div className="carte">
        <h2>Créer une UE</h2>
        <form className="formulaire" onSubmit={creerUE}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Code</label>
              <input placeholder="ex. UE-PROG-101" value={nouvelleUE.code} onChange={(e) => setNouvelleUE({ ...nouvelleUE, code: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Intitulé (thème)</label>
              <input placeholder="ex. Programmation" value={nouvelleUE.intitule} onChange={(e) => setNouvelleUE({ ...nouvelleUE, intitule: e.target.value })} required />
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>Semestre</label>
              <select value={nouvelleUE.semestreId} onChange={(e) => setNouvelleUE({ ...nouvelleUE, semestreId: e.target.value })} required>
                <option value="">—</option>
                {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Crédits</label>
              <input type="number" min="1" value={nouvelleUE.credits} onChange={(e) => setNouvelleUE({ ...nouvelleUE, credits: e.target.value })} required />
            </div>
            <div className="champ">
              <label>Coefficient</label>
              <input type="number" min="0.5" step="0.5" value={nouvelleUE.coefficient} onChange={(e) => setNouvelleUE({ ...nouvelleUE, coefficient: e.target.value })} required />
            </div>
          </div>
          <button className="primaire" type="submit">Créer l'UE</button>
          {message && <div className={message === 'UE créée.' ? 'message-succes' : 'message-erreur'}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
