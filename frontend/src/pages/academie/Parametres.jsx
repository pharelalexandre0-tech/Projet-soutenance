import { useEffect, useState } from 'react';
import client from '../../api/client';
import Toast from '../../components/Toast';
import { IconDocument } from '../../components/icons';

const CHAMPS_VIDES = { nom: '', sigle: '', devise: '', ville: '', pays: '', boitePostale: '', telephone: '', email: '' };

// EduSphere s'adapte à n'importe quel établissement : cette page est le
// point unique où l'identité de l'école (nom, ville, coordonnées…) est
// renseignée — jamais codée en dur dans l'application. Elle alimente
// directement l'en-tête du bulletin, du relevé et des reçus.
export default function Parametres() {
  const [form, setForm] = useState(CHAMPS_VIDES);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client.get('/etablissement').then((res) => {
      const e = res.data.etablissement;
      setForm({
        nom: e.nom || '', sigle: e.sigle || '', devise: e.devise || '',
        ville: e.ville || '', pays: e.pays || 'République Gabonaise',
        boitePostale: e.boitePostale || '', telephone: e.telephone || '', email: e.email || '',
      });
      setChargement(false);
    });
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    setEnCours(true);
    try {
      await client.put('/etablissement', form);
      setToast({ message: 'Établissement mis à jour — le bulletin, le relevé et les reçus utilisent désormais cette identité.', type: 'succes' });
    } catch (err) {
      setToast({ message: err.response?.data?.erreur || 'échec de la mise à jour', type: 'erreur' });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconDocument width={16} height={16} /></span>
          <h2>Identité de l'établissement</h2>
        </div>
      </div>
      <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -6 }}>
        EduSphere est conçu pour être déployé sur n'importe quel établissement. Ces informations — jamais codées en dur —
        apparaissent sur le bulletin, le relevé de notes et les reçus de paiement.
      </p>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && (
        <form className="formulaire" onSubmit={enregistrer}>
          <div className="ligne-champs">
            <div className="champ"><label>Nom de l'établissement</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
            <div className="champ" style={{ maxWidth: 140 }}><label>Sigle</label><input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} placeholder="ex. IUP" /></div>
          </div>
          <div className="champ">
            <label>Devise / slogan</label>
            <input value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} placeholder="ex. Savoir · Excellence · Avenir" />
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Ville</label><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
            <div className="champ"><label>Pays</label><input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} /></div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label>Boîte postale</label><input value={form.boitePostale} onChange={(e) => setForm({ ...form, boitePostale: e.target.value })} /></div>
            <div className="champ"><label>Téléphone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
          </div>
          <div className="champ">
            <label>E-mail de contact</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="primaire" type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
