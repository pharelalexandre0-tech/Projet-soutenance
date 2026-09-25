import { useEffect, useState } from 'react';
import client from '../../api/client';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps';
import { messageErreur } from '../../utils/erreurs';
import { JOURS } from '../../utils/jours';
import { IconDownload, IconPlus, IconSend, IconCircleCheck, IconAlertTriangle, IconInfo } from '../../components/icons';

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
  const [etat, setEtat] = useState(null);
  const [publication, setPublication] = useState(false);

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
    client.get('/emplois-du-temps/publication', { params: { classeId: id } })
      .then((res) => setEtat(res.data))
      .catch(() => setEtat(null));
  }
  useEffect(() => {
    setEtat(null);
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
  const effectif = classe?.Eleves?.length ?? 0;
  const dejaPubliee = !!etat?.publication;
  const aPublier = dejaPubliee ? !etat?.aJour : emplois.length > 0;

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>{classe ? `Semaine type de ${classe.nom} (${classe.niveau})` : 'Semaine type'}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondaire" onClick={telechargerPDF} disabled={!pret || emplois.length === 0 || telechargementEnCours}>
            <IconDownload /> {telechargementEnCours ? 'Génération…' : 'Télécharger en PDF'}
          </button>
          <button type="button" className="secondaire" onClick={() => setCreneauEnSaisie(CRENEAU_VIDE)} disabled={!pret}>
            <IconPlus /> Ajouter un cours
          </button>
          <button type="button" className="primaire" onClick={() => setPublication(true)} disabled={!classeId || !aPublier}>
            <IconSend /> {dejaPubliee ? 'Publier les changements' : 'Publier'}
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

      {classeId && etat && (
        <div className={`bandeau-publication ${!dejaPubliee ? 'brouillon' : etat.aJour ? 'publie' : 'modifie'}`}>
          {!dejaPubliee && <IconInfo />}
          {dejaPubliee && etat.aJour && <IconCircleCheck />}
          {dejaPubliee && !etat.aJour && <IconAlertTriangle />}
          <div>
            <strong>
              {!dejaPubliee && 'Brouillon : pas encore publié'}
              {dejaPubliee && etat.aJour && `Publié le ${new Date(etat.publication.publieLe).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`}
              {dejaPubliee && !etat.aJour && 'Modifications non publiées'}
            </strong>
            <span>
              {!dejaPubliee && "Les étudiants et les parents de la classe ne voient pas encore cet emploi du temps. Publie-le une fois la grille terminée."}
              {dejaPubliee && etat.aJour && `Version ${etat.publication.version}, visible par les étudiants et les parents${etat.publication.nbDestinataires ? ` (${etat.publication.nbDestinataires} prévenus)` : ''}.`}
              {dejaPubliee && !etat.aJour && `Les étudiants voient encore la version du ${new Date(etat.publication.publieLe).toLocaleDateString('fr-FR')}. Publie les changements pour les prévenir.`}
            </span>
          </div>
        </div>
      )}

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
      {publication && (
        <Modal titre={dejaPubliee ? 'Publier les changements ?' : "Publier l'emploi du temps ?"} onFermer={() => setPublication(false)} largeur={500}>
          <PublicationEmploi
            classe={classe}
            classeId={classeId}
            semestreId={semestreId}
            nbCours={emplois.length}
            effectif={effectif}
            miseAJour={dejaPubliee}
            onAnnuler={() => setPublication(false)}
            onPublie={(res) => {
              setPublication(false);
              setEtat(res);
              setToast({
                message: res.nbDestinataires
                  ? `Emploi du temps publié : ${res.nbDestinataires} étudiant(s) et parent(s) prévenu(s) par notification et e-mail.`
                  : 'Emploi du temps publié. Aucun étudiant à prévenir pour le moment.',
                type: 'succes',
              });
            }}
          />
        </Modal>
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

function PublicationEmploi({ classe, classeId, semestreId, nbCours, effectif, miseAJour, onAnnuler, onPublie }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function publier() {
    setEnCours(true);
    setErreur('');
    try {
      const res = await client.post('/emplois-du-temps/publier', { classeId: Number(classeId), semestreId: semestreId ? Number(semestreId) : null });
      onPublie(res.data);
    } catch (err) {
      setErreur(messageErreur(err, 'impossible de publier'));
      setEnCours(false);
    }
  }

  return (
    <>
      <p className="confirmation-texte">
        {miseAJour ? 'La nouvelle version' : "L'emploi du temps"} de <strong>{classe ? `${classe.nom} (${classe.niveau})` : 'cette classe'}</strong>{' '}
        ({nbCours} cours par semaine) deviendra visible pour les étudiants et leurs parents.
      </p>
      <div className="encart-info" style={{ marginBottom: 20 }}>
        <IconInfo />
        <span>
          {effectif > 0
            ? `Les ${effectif} étudiant(s) de la classe et leurs parents recevront une notification et un e-mail.`
            : "La classe ne compte encore aucun étudiant : personne ne sera prévenu, mais la grille sera visible dès les premières inscriptions."}
        </span>
      </div>
      {erreur && <div className="message-erreur" style={{ marginBottom: 14 }}>{erreur}</div>}
      <div className="confirmation-actions">
        <button type="button" className="secondaire" onClick={onAnnuler} disabled={enCours}>Annuler</button>
        <button type="button" className="primaire" onClick={publier} disabled={enCours}><IconSend /> {enCours ? 'Publication…' : 'Publier et prévenir'}</button>
      </div>
    </>
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
