import { useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { messageErreur } from '../../utils/erreurs';
import { IconPlus, IconTrash, IconExternal, IconInfo } from '../../components/icons';

// Texte de la politique de confidentialité publiée sur /confidentialite :
// enregistré dans PostgreSQL, modifiable section par section.
export default function PolitiqueConfidentialite() {
  const [sections, setSections] = useState(null);
  const [misAJourLe, setMisAJourLe] = useState(null);
  const [personnalisee, setPersonnalisee] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [reinitialisation, setReinitialisation] = useState(false);
  const [toast, setToast] = useState(null);

  function appliquer(d) {
    setSections(d.sections.map((s) => ({ ...s })));
    setMisAJourLe(d.misAJourLe);
    setPersonnalisee(d.personnalisee);
  }
  useEffect(() => { client.get('/plateforme/confidentialite').then((res) => appliquer(res.data)); }, []);

  const maj = (i, champ, valeur) => setSections((l) => l.map((s, j) => (j === i ? { ...s, [champ]: valeur } : s)));

  async function enregistrer() {
    setEnCours(true);
    try {
      const res = await client.put('/superadmin/confidentialite', { sections });
      appliquer(res.data);
      setToast({ message: 'Politique de confidentialité publiée.', type: 'succes' });
    } catch (err) {
      setToast({ message: messageErreur(err, "impossible d'enregistrer"), type: 'erreur' });
    } finally {
      setEnCours(false);
    }
  }

  async function revenirAuTexteParDefaut() {
    const res = await client.delete('/superadmin/confidentialite');
    appliquer(res.data);
    setReinitialisation(false);
    setToast({ message: 'Texte par défaut rétabli.', type: 'succes' });
  }

  if (!sections) return <div className="chargement">Chargement…</div>;

  return (
    <>
      <div className="carte">
        <div className="entete-carte">
          <h2>Politique de confidentialité</h2>
          <div className="actions-carte">
            <a className="bouton-lien-secondaire" href="/confidentialite" target="_blank" rel="noreferrer"><IconExternal /> Voir la page publique</a>
            {personnalisee && <button type="button" className="secondaire" onClick={() => setReinitialisation(true)}>Texte par défaut</button>}
            <button type="button" className="primaire" onClick={enregistrer} disabled={enCours}>{enCours ? 'Publication…' : 'Publier'}</button>
          </div>
        </div>
        <div className="encart-info" style={{ marginBottom: 20 }}>
          <IconInfo />
          <span>
            Page publique, liée depuis l'écran de connexion et le pied de chaque e-mail.
            {misAJourLe ? ` Dernière publication : ${new Date(misAJourLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ' Texte par défaut, jamais modifié.'}
            {' '}Séparez les paragraphes par une ligne vide.
          </span>
        </div>
        <div className="sections-politique">
          {sections.map((s, i) => (
            <div className="section-politique" key={i}>
              <div className="section-politique-entete">
                <span className="section-politique-numero">{String(i + 1).padStart(2, '0')}</span>
                <input value={s.titre} onChange={(e) => maj(i, 'titre', e.target.value)} placeholder="Titre de la section" aria-label={`Titre de la section ${i + 1}`} />
                <button type="button" className="bouton-icone-texte danger" onClick={() => setSections((l) => l.filter((_, j) => j !== i))} aria-label="Retirer cette section" title="Retirer cette section"><IconTrash /></button>
              </div>
              <textarea rows={5} value={s.contenu} onChange={(e) => maj(i, 'contenu', e.target.value)} aria-label={`Texte de la section ${i + 1}`} />
            </div>
          ))}
        </div>
        <button type="button" className="secondaire" style={{ marginTop: 16 }} onClick={() => setSections((l) => [...l, { titre: '', contenu: '' }])}>
          <IconPlus /> Ajouter une section
        </button>
      </div>
      {reinitialisation && (
        <ConfirmModal titre="Revenir au texte par défaut ?" boutonConfirmer="Rétablir" onAnnuler={() => setReinitialisation(false)} onConfirmer={revenirAuTexteParDefaut}>
          Le texte personnalisé sera remplacé par la version d'origine d'EduSphere.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </>
  );
}
