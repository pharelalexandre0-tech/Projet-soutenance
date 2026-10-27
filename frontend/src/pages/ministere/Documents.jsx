import { useEffect, useState } from 'react';
import client from '../../api/client';
import BoutonDocument from '../../components/BoutonDocument';
import { messageErreur } from '../../utils/erreurs';
import { nombre, dateFr } from './commun';
import { IconSearch, IconShield, IconShieldX, IconShieldAlert, IconDownload, IconDocument, IconTable } from '../../components/icons';

const TYPES = {
  bulletin: 'Bulletins de notes', recu: 'Reçus de paiement', fiche_paie: 'Fiches de paie', emploi_du_temps: 'Emplois du temps',
  liste_presence: 'Listes de présence', recapitulatif_presences: 'Récapitulatifs des présences', proces_verbal: 'Procès-verbaux',
  rapport_national: 'Rapports nationaux', attestation: 'Attestations', releve: 'Relevés de notes', pv_deliberation: 'PV de délibération',
};

function formater(valeur) {
  const brut = valeur.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12);
  return brut.match(/.{1,4}/g)?.join('-') || '';
}

// Vérification des documents (diplômes, relevés, attestations...) et
// statistiques nationales du registre des documents certifiés.
export function VerificationDocuments() {
  const [code, setCode] = useState('');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [stats, setStats] = useState(null);
  useEffect(() => { client.get('/ministere/documents').then((r) => setStats(r.data.lignes)).catch(() => setStats([])); }, []);

  async function verifier(e) {
    e.preventDefault();
    setErreur('');
    setResultat(null);
    try {
      setResultat((await client.get(`/verification/${encodeURIComponent(code)}`)).data);
    } catch (err) {
      setErreur(err.response?.status === 404 ? 'Aucun document ne correspond à ce code : il ne doit pas être considéré comme authentique.' : messageErreur(err, 'vérification impossible'));
    }
  }

  const parType = new Map();
  (stats || []).forEach((l) => {
    const t = parType.get(l.typeDocument) || { valide: 0, remplace: 0, annule: 0, verifications: 0 };
    t[l.statut] = (t[l.statut] || 0) + l.nombre;
    t.verifications += l.verifications || 0;
    parType.set(l.typeDocument, t);
  });
  const Icone = !resultat ? null : resultat.authentique ? IconShield : resultat.statut === 'remplace' ? IconShieldAlert : IconShieldX;

  return (
    <div className="grille-2">
      <section className="carte">
        <h2>Vérifier un document</h2>
        <p className="carte-document-texte">Code imprimé à côté du QR code d’un bulletin, relevé, attestation, procès-verbal ou reçu émis sur EduSphere.</p>
        <form className="verif-formulaire" onSubmit={verifier}>
          <div className="verif-formulaire-ligne">
            <input value={code} onChange={(e) => setCode(formater(e.target.value))} placeholder="XXXX-XXXX-XXXX" aria-label="Code de vérification" spellCheck={false} />
            <button type="submit" className="primaire" disabled={code.replace(/-/g, '').length !== 12}><IconSearch /> Vérifier</button>
          </div>
        </form>
        {erreur && <div className="message-erreur" style={{ marginTop: 16 }}>{erreur}</div>}
        {resultat && (
          <div className={`verif-verdict ${resultat.authentique ? 'ok' : resultat.statut === 'remplace' ? 'attention' : 'refus'}`} style={{ marginTop: 18 }}>
            <span className="verif-verdict-sceau"><Icone /></span>
            <div>
              <span className="verif-verdict-code">{resultat.code}</span>
              <h2>{resultat.authentique ? 'Document authentique' : resultat.statut === 'remplace' ? 'Version remplacée' : resultat.statut === 'annule' ? 'Document annulé' : 'Signature invalide'}</h2>
              <p><strong>{resultat.titre}</strong>{resultat.titulaire ? `, ${resultat.titulaire}` : ''} · {resultat.etablissement?.nom} · émis le {dateFr(resultat.emisLe)}</p>
              <dl className="verif-elements compact">{resultat.elements.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          </div>
        )}
      </section>
      <section className="carte">
        <h2>Registre national des documents certifiés</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Type</th><th>En vigueur</th><th>Remplacés</th><th>Annulés</th><th>Vérifications</th></tr></thead>
            <tbody>
              {[...parType.entries()].map(([type, t]) => (
                <tr key={type}><td className="cellule-nom">{TYPES[type] || type}</td><td className="cellule-nombre">{nombre(t.valide)}</td><td className="cellule-nombre">{nombre(t.remplace)}</td><td className="cellule-nombre">{nombre(t.annule)}</td><td className="cellule-nombre">{nombre(t.verifications)}</td></tr>
              ))}
              {stats && parType.size === 0 && <tr><td colSpan={5} className="vide">Aucun document certifié pour l’instant.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Rapports nationaux téléchargeables.
export function Rapports() {
  return (
    <div className="grille-documents">
      <section className="carte carte-document">
        <div className="entete-carte"><h2><IconDocument /> Rapport national (PDF)</h2></div>
        <p className="carte-document-texte">Synthèse nationale, établissements sous tutelle (agrément, effectifs, réussite, assiduité, risques), répartition par province et par niveau. Document certifié : QR code et code de vérification.</p>
        <div className="carte-document-actions">
          <BoutonDocument className="primaire" chemin="/api/ministere/rapport"><IconDownload width={16} height={16} /> Télécharger le PDF</BoutonDocument>
        </div>
      </section>
      <section className="carte carte-document">
        <div className="entete-carte"><h2><IconTable /> Données détaillées (Excel)</h2></div>
        <p className="carte-document-texte">Trois feuilles : établissements, provinces et niveaux, pour vos propres analyses. Données agrégées, sans aucun nom.</p>
        <div className="carte-document-actions">
          <BoutonDocument className="secondaire" chemin="/api/ministere/rapport?format=xlsx"><IconDownload width={16} height={16} /> Télécharger l’Excel</BoutonDocument>
        </div>
      </section>
    </div>
  );
}
