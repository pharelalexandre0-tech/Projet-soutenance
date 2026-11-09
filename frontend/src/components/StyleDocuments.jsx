import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import client, { ORIGINE_API } from '../api/client';
import Toast from './Toast';
import BoutonDocument from './BoutonDocument';
import { IconDocument } from './icons';
import { messageErreur } from '../utils/erreurs';

const MODELES = [
  { cle: 'classique', nom: 'Classique', description: 'En-tête centré, cadre fin, typographie à empattements.' },
  { cle: 'moderne', nom: 'Moderne', description: 'Bande de couleur latérale, titre aligné à gauche.' },
  { cle: 'prestige', nom: 'Prestige', description: 'Double cadre orné, filigrane de l’école.' },
];
const COULEURS = [
  ['#0B1E3D', 'Marine'], ['#1D5FA8', 'Bleu'], ['#157A8C', 'Sarcelle'], ['#1F6B45', 'Vert forêt'],
  ['#7A1F2B', 'Bordeaux'], ['#8A5A12', 'Bronze'], ['#3D2A6B', 'Violet'], ['#2E3440', 'Anthracite'],
];
const TYPES = [['scolarite', 'Scolarité'], ['inscription', 'Inscription'], ['reussite', 'Réussite']];

// Paramètres > Style des documents : chaque école choisit le modèle et la
// couleur de ses attestations ; l'en-tête des autres documents officiels
// (relevé, procès-verbal...) prend la même couleur.
export default function StyleDocuments() {
  const [style, setStyle] = useState(null);
  const [type, setType] = useState('scolarite');
  const [apercu, setApercu] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState(null);
  const urlPrecedente = useRef('');
  const natif = Capacitor.isNativePlatform();

  useEffect(() => {
    client.get('/etablissement').then((r) => {
      const e = r.data.etablissement;
      setStyle({ modeleDocuments: e.modeleDocuments || 'classique', couleurDocuments: e.couleurDocuments || '#0B1E3D' });
    }).catch(() => setStyle({ modeleDocuments: 'classique', couleurDocuments: '#0B1E3D' }));
  }, []);

  const cheminApercu = style ? `/api/etablissement/apercu-attestation?modele=${style.modeleDocuments}&couleur=${encodeURIComponent(style.couleurDocuments)}&type=${type}` : '';

  // Aperçu régénéré peu après chaque changement (navigateur seulement).
  useEffect(() => {
    if (!style || natif) return undefined;
    const minuteur = setTimeout(async () => {
      try {
        const r = await client.get(`${ORIGINE_API}${cheminApercu}`, { baseURL: '', responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        if (urlPrecedente.current) URL.revokeObjectURL(urlPrecedente.current);
        urlPrecedente.current = url;
        setApercu(url);
      } catch { setApercu(''); }
    }, 350);
    return () => clearTimeout(minuteur);
  }, [cheminApercu, natif, style]);
  useEffect(() => () => { if (urlPrecedente.current) URL.revokeObjectURL(urlPrecedente.current); }, []);

  async function enregistrer() {
    setEnCours(true);
    try {
      await client.put('/etablissement/style-documents', style);
      setToast({ message: 'Style enregistré : les prochaines attestations et les en-têtes des documents officiels l’utilisent.', type: 'succes' });
    } catch (err) {
      setToast({ message: messageErreur(err, 'enregistrement impossible'), type: 'erreur' });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><IconDocument width={16} height={16} /></span>
          <h2>Style des documents officiels</h2>
        </div>
      </div>
      <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -6 }}>
        Modèle et couleur des attestations de votre établissement. Les en-têtes du relevé de notes et des procès-verbaux prennent la même couleur.
      </p>
      {!style && <div className="chargement">Chargement…</div>}
      {style && (
        <div className="style-docs">
          <div className="formulaire" style={{ gap: 16 }}>
            <div className="champ">
              <label id="lib-modele">Modèle</label>
              <div className="style-docs-modeles" role="radiogroup" aria-labelledby="lib-modele">
                {MODELES.map((m) => (
                  <button key={m.cle} type="button" role="radio" aria-checked={style.modeleDocuments === m.cle} className="style-docs-modele" onClick={() => setStyle((s) => ({ ...s, modeleDocuments: m.cle }))}>
                    <span className={`mini-page ${m.cle}`} style={{ '--accent-doc': style.couleurDocuments }} aria-hidden="true">
                      <i className="cadre" /><i className="bande" /><i className="rond" /><i className="titre" />
                      <i className="l" style={{ top: 44 }} /><i className="l" style={{ top: 50 }} /><i className="l" style={{ top: 56, right: 24 }} /><i className="l" style={{ top: 70, left: 38 }} />
                    </span>
                    <div><strong>{m.nom}</strong><span style={{ display: 'block' }}>{m.description}</span></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="champ">
              <label id="lib-couleur">Couleur</label>
              <div className="style-docs-couleurs" role="radiogroup" aria-labelledby="lib-couleur">
                {COULEURS.map(([valeur, nom]) => (
                  <button key={valeur} type="button" role="radio" aria-checked={style.couleurDocuments.toUpperCase() === valeur} aria-label={nom} title={nom} className="pastille-couleur" style={{ background: valeur }} onClick={() => setStyle((s) => ({ ...s, couleurDocuments: valeur }))} />
                ))}
                <label className="note-secondaire" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  Autre
                  <input type="color" value={style.couleurDocuments} onChange={(e) => setStyle((s) => ({ ...s, couleurDocuments: e.target.value.toUpperCase() }))} style={{ width: 40, height: 30, padding: 0, border: 'none', background: 'none' }} />
                </label>
              </div>
            </div>
            <div className="champ">
              <label htmlFor="type-apercu">Document affiché dans l’aperçu</label>
              <select id="type-apercu" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map(([cle, nom]) => <option key={cle} value={cle}>Attestation de {nom.toLowerCase()}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="primaire" disabled={enCours} onClick={enregistrer}>{enCours ? 'Enregistrement…' : 'Enregistrer ce style'}</button>
              <BoutonDocument className="secondaire" chemin={cheminApercu} nomFichier="apercu_attestation.pdf">Télécharger l’aperçu</BoutonDocument>
            </div>
          </div>
          {!natif && (
            <div className="style-docs-apercu">
              {apercu ? <iframe title="Aperçu de l’attestation" src={`${apercu}#toolbar=0&navpanes=0&view=FitH`} /> : <div className="chargement">Préparation de l’aperçu…</div>}
            </div>
          )}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}
