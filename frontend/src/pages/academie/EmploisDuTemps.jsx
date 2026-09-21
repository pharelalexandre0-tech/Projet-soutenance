import { useEffect, useState } from 'react';
import client from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CRENEAU_VIDE = { jour: 'Lundi', heureDebut: '', heureFin: '', matiere: '', salle: '' };
// Bornes par défaut de la grille — élargies automatiquement si un créneau
// déborde (ex. un cours du soir après 19h), jamais rétrécies en dessous.
const GRILLE_DEBUT_DEFAUT = 7 * 60;
const GRILLE_FIN_DEFAUT = 19 * 60;
const HAUTEUR_GRILLE = 640;

function versMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function EmploisDuTemps() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [emplois, setEmplois] = useState([]);
  const [formOuvert, setFormOuvert] = useState(false);
  const [nouveauCreneau, setNouveauCreneau] = useState(CRENEAU_VIDE);
  const [erreur, setErreur] = useState('');
  const [creneauASupprimer, setCreneauASupprimer] = useState(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);

  useEffect(() => {
    client.get('/classes').then((res) => setClasses(res.data.classes));
    client.get('/semestres').then((res) => setSemestres(res.data.semestres));
  }, []);

  function charger(id) {
    client.get(`/emplois-du-temps?classeId=${id}`).then((res) => setEmplois(res.data.emplois));
  }
  useEffect(() => {
    if (classeId) charger(classeId); else setEmplois([]);
  }, [classeId]);

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    try {
      await client.post('/emplois-du-temps', { ...nouveauCreneau, classeId: Number(classeId), semestreId: Number(semestreId) });
      setNouveauCreneau(CRENEAU_VIDE);
      setFormOuvert(false);
      charger(classeId);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'impossible de créer ce créneau');
    }
  }

  async function confirmerSuppression() {
    await client.delete(`/emplois-du-temps/${creneauASupprimer.id}`);
    setCreneauASupprimer(null);
    charger(classeId);
  }

  // Grille brandée (logo établissement inclus s'il est renseigné) générée
  // côté serveur — un fichier téléchargé s'attache tel quel à un message
  // WhatsApp ou un e-mail, contrairement à une capture de cette page.
  async function telechargerPDF() {
    setTelechargementEnCours(true);
    try {
      const res = await client.get('/emplois-du-temps/pdf', { params: { classeId, semestreId } });
      window.open(res.data.url, '_blank');
    } finally {
      setTelechargementEnCours(false);
    }
  }

  const parJour = new Map();
  emplois.forEach((e) => {
    if (!parJour.has(e.jour)) parJour.set(e.jour, []);
    parJour.get(e.jour).push(e);
  });

  const bornes = emplois.flatMap((e) => [versMinutes(e.heureDebut), versMinutes(e.heureFin)]);
  const grilleDebut = Math.floor(Math.min(GRILLE_DEBUT_DEFAUT, ...(bornes.length ? bornes : [GRILLE_DEBUT_DEFAUT])) / 60) * 60;
  const grilleFin = Math.ceil(Math.max(GRILLE_FIN_DEFAUT, ...(bornes.length ? bornes : [GRILLE_FIN_DEFAUT])) / 60) * 60;
  const reperesHeure = [];
  for (let h = grilleDebut; h <= grilleFin; h += 60) reperesHeure.push(h);

  return (
    <div className="carte">
      <div className="entete-section">
        <h2>Emplois du temps</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {emplois.length > 0 && (
            <button type="button" className="secondaire" onClick={telechargerPDF} disabled={telechargementEnCours}>
              {telechargementEnCours ? 'Génération…' : 'Télécharger (PDF)'}
            </button>
          )}
          <button type="button" className={formOuvert ? 'secondaire' : 'primaire'} onClick={() => setFormOuvert((v) => !v)} disabled={!classeId || !semestreId}>
            {formOuvert ? 'Annuler' : '+ Ajouter un créneau'}
          </button>
        </div>
      </div>

      <div className="ligne-champs" style={{ marginBottom: 18 }}>
        <div className="champ">
          <label>Classe</label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">—</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
          </select>
        </div>
        <div className="champ">
          <label>Semestre</label>
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}>
            <option value="">—</option>
            {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
          </select>
        </div>
      </div>

      {!classeId && <div className="vide">Choisis une classe pour voir ou modifier son emploi du temps</div>}

      {formOuvert && (
        <form className="formulaire" style={{ marginBottom: 22, padding: 14, background: 'var(--gris-fond)', borderRadius: 10 }} onSubmit={ajouter}>
          <div className="ligne-champs">
            <div className="champ">
              <label>Jour</label>
              <select value={nouveauCreneau.jour} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, jour: e.target.value })}>
                {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="champ"><label>Début</label><input type="time" value={nouveauCreneau.heureDebut} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, heureDebut: e.target.value })} required /></div>
            <div className="champ"><label>Fin</label><input type="time" value={nouveauCreneau.heureFin} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, heureFin: e.target.value })} required /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Matière</label><input value={nouveauCreneau.matiere} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, matiere: e.target.value })} placeholder="ex. Mathématiques" required /></div>
            <div className="champ"><label>Salle</label><input value={nouveauCreneau.salle} onChange={(e) => setNouveauCreneau({ ...nouveauCreneau, salle: e.target.value })} placeholder="ex. B12" /></div>
          </div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button className="primaire" type="submit">Ajouter</button>
        </form>
      )}

      {classeId && emplois.length === 0 && <div className="vide">Aucun créneau renseigné pour cette classe</div>}

      {classeId && emplois.length > 0 && (
        <div className="table-scroll">
          <div className="grille-emploi">
            <div className="grille-emploi-coin" />
            {JOURS.map((j) => <div key={j} className="grille-emploi-jour-titre">{j}</div>)}

            <div className="grille-emploi-heures" style={{ height: HAUTEUR_GRILLE }}>
              {reperesHeure.map((h) => (
                <span
                  key={h}
                  className="grille-emploi-repere"
                  style={{ top: `${((h - grilleDebut) / (grilleFin - grilleDebut)) * 100}%` }}
                >
                  {String(Math.floor(h / 60)).padStart(2, '0')}h
                </span>
              ))}
            </div>

            {JOURS.map((jour) => (
              <div key={jour} className="grille-emploi-colonne" style={{ height: HAUTEUR_GRILLE }}>
                {reperesHeure.map((h) => (
                  <span key={h} className="grille-emploi-ligne" style={{ top: `${((h - grilleDebut) / (grilleFin - grilleDebut)) * 100}%` }} />
                ))}
                {(parJour.get(jour) || []).map((e) => {
                  const debut = versMinutes(e.heureDebut);
                  const fin = Math.max(versMinutes(e.heureFin), debut + 15);
                  const top = ((debut - grilleDebut) / (grilleFin - grilleDebut)) * 100;
                  const hauteur = ((fin - debut) / (grilleFin - grilleDebut)) * 100;
                  return (
                    <div key={e.id} className="grille-emploi-creneau" style={{ top: `${top}%`, height: `${hauteur}%` }}>
                      <button
                        type="button" className="grille-emploi-retirer"
                        title="Retirer ce créneau"
                        onClick={() => setCreneauASupprimer(e)}
                      >
                        ×
                      </button>
                      <strong>{e.matiere || '—'}</strong>
                      <span>{e.heureDebut} – {e.heureFin}</span>
                      {e.salle && <span>{e.salle}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {creneauASupprimer && (
        <ConfirmModal
          titre="Retirer ce créneau ?"
          onAnnuler={() => setCreneauASupprimer(null)}
          onConfirmer={confirmerSuppression}
        >
          Retirer {creneauASupprimer.matiere || 'ce cours'} ({creneauASupprimer.jour} {creneauASupprimer.heureDebut}–{creneauASupprimer.heureFin}) de l'emploi du temps ?
        </ConfirmModal>
      )}
    </div>
  );
}
