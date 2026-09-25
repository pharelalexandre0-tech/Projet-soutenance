import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps';
import { messageErreur } from '../../utils/erreurs';
import { JOURS } from '../../utils/jours';
import { IconDownload, IconPlus } from '../../components/icons';

const CRENEAU_VIDE = { jour: 'Lundi', heureDebut: '08:00', heureFin: '10:00', matiere: '', salle: '' };

export default function EmploisDuTemps() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [emplois, setEmplois] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [creneauEnSaisie, setCreneauEnSaisie] = useState(null);
  const [creneauASupprimer, setCreneauASupprimer] = useState(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/classes').then((res) => {
      setClasses(res.data.classes);
      // Une seule classe : inutile de la faire choisir.
      if (res.data.classes.length === 1) setClasseId(String(res.data.classes[0].id));
    });
    client.get('/semestres').then((res) => {
      setSemestres(res.data.semestres);
      if (res.data.semestres.length === 1) setSemestreId(String(res.data.semestres[0].id));
    });
  }, []);

  function charger(id) {
    setChargement(true);
    client.get(`/emplois-du-temps?classeId=${id}`)
      .then((res) => setEmplois(res.data.emplois))
      .finally(() => setChargement(false));
  }
  useEffect(() => {
    if (classeId) charger(classeId); else setEmplois([]);
  }, [classeId]);

  async function supprimer() {
    await client.delete(`/emplois-du-temps/${creneauASupprimer.id}`);
    setToast({ message: `${creneauASupprimer.matiere || 'Cours'} retiré de l'emploi du temps.`, type: 'succes' });
    setCreneauASupprimer(null);
    charger(classeId);
  }

  // Grille à l'identité de l'établissement, générée côté serveur : un
  // fichier s'attache tel quel à un message, contrairement à une capture.
  async function telechargerPDF() {
    setTelechargementEnCours(true);
    try {
      const res = await client.get('/emplois-du-temps/pdf', { params: { classeId, semestreId } });
      window.open(res.data.url, '_blank');
    } catch (err) {
      setToast({ message: messageErreur(err, 'impossible de générer le PDF'), type: 'erreur' });
    } finally {
      setTelechargementEnCours(false);
    }
  }

  const pret = classeId && semestreId;
  const classe = classes.find((c) => String(c.id) === classeId);

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>{classe ? `Semaine type de ${classe.nom} (${classe.niveau})` : 'Semaine type'}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondaire" onClick={telechargerPDF} disabled={!pret || emplois.length === 0 || telechargementEnCours}>
            <IconDownload /> {telechargementEnCours ? 'Génération…' : 'Télécharger en PDF'}
          </button>
          <button type="button" className="primaire" onClick={() => setCreneauEnSaisie(CRENEAU_VIDE)} disabled={!pret}>
            <IconPlus /> Ajouter un cours
          </button>
        </div>
      </div>

      <div className="barre-outils">
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Classe" style={{ minWidth: 240 }}>
          <option value="">Choisir une classe</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
        </select>
        <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} aria-label="Semestre" style={{ minWidth: 240 }}>
          <option value="">Choisir un semestre</option>
          {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
        </select>
        {pret && <span className="note-secondaire astuce-grille" style={{ fontSize: 14 }}>Clique sur une case vide de la grille pour y ajouter un cours.</span>}
      </div>

      {!classeId && <div className="vide">Choisis une classe pour afficher son emploi du temps.</div>}
      {classeId && !semestreId && <div className="vide">Choisis le semestre concerné pour pouvoir ajouter des cours.</div>}
      {classeId && chargement && <div className="chargement">Chargement…</div>}
      {classeId && !chargement && (
        <GrilleEmploiDuTemps
          creneaux={emplois}
          onAjouter={pret ? (valeurs) => setCreneauEnSaisie({ ...CRENEAU_VIDE, ...valeurs }) : undefined}
          onRetirer={(c) => setCreneauASupprimer(c)}
        />
      )}

      {creneauEnSaisie && (
        <FormulaireCours
          valeurInitiale={creneauEnSaisie}
          classeId={classeId}
          semestreId={semestreId}
          onFermer={() => setCreneauEnSaisie(null)}
          onAjoute={(c) => {
            setCreneauEnSaisie(null);
            setToast({ message: `${c.matiere} ajouté le ${c.jour.toLowerCase()} de ${c.heureDebut} à ${c.heureFin}.`, type: 'succes' });
            charger(classeId);
          }}
        />
      )}
      {creneauASupprimer && (
        <ConfirmModal
          titre="Retirer ce cours ?"
          boutonConfirmer="Retirer"
          boutonEnCours="Retrait…"
          onAnnuler={() => setCreneauASupprimer(null)}
          onConfirmer={supprimer}
        >
          {creneauASupprimer.matiere || 'Ce cours'} du {creneauASupprimer.jour.toLowerCase()}, de {creneauASupprimer.heureDebut} à{' '}
          {creneauASupprimer.heureFin}, sera retiré de l'emploi du temps.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

function FormulaireCours({ valeurInitiale, classeId, semestreId, onFermer, onAjoute }) {
  const [cours, setCours] = useState(valeurInitiale);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setCours({ ...cours, [champ]: e.target.value });

  async function enregistrer(e) {
    e.preventDefault();
    if (cours.heureFin <= cours.heureDebut) {
      setErreur("l'heure de fin doit être après l'heure de début");
      return;
    }
    setEnCours(true);
    setErreur('');
    try {
      await client.post('/emplois-du-temps', { ...cours, classeId: Number(classeId), semestreId: Number(semestreId) });
      onAjoute(cours);
    } catch (err) {
      setErreur(messageErreur(err, "impossible d'ajouter ce cours"));
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Ajouter un cours" onFermer={onFermer} largeur={560}>
      <form className="formulaire" onSubmit={enregistrer}>
        <div className="champ">
          <label htmlFor="c-matiere">Matière</label>
          <input id="c-matiere" value={cours.matiere} onChange={maj('matiere')} placeholder="Ex. Mathématiques" required autoFocus />
        </div>
        <div className="ligne-champs">
          <div className="champ">
            <label htmlFor="c-jour">Jour</label>
            <select id="c-jour" value={cours.jour} onChange={maj('jour')}>
              {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="champ"><label htmlFor="c-debut">Début</label><input id="c-debut" type="time" value={cours.heureDebut} onChange={maj('heureDebut')} required /></div>
          <div className="champ"><label htmlFor="c-fin">Fin</label><input id="c-fin" type="time" value={cours.heureFin} onChange={maj('heureFin')} required /></div>
        </div>
        <div className="champ">
          <label htmlFor="c-salle">Salle (facultatif)</label>
          <input id="c-salle" value={cours.salle} onChange={maj('salle')} placeholder="Ex. B12" />
        </div>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter le cours'}</button>
        </div>
      </form>
    </Modal>
  );
}
