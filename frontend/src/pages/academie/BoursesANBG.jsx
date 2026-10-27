import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import BoutonDocument from '../../components/BoutonDocument';
import { IconSearch, IconDownload } from '../../components/icons';

// Boursiers ANBG de l'établissement, en lecture seule : les étudiants
// constituent et envoient eux-mêmes leur dossier à l'agence.
export default function BoursesANBG() {
  const [boursiers, setBoursiers] = useState(null);
  const [q, setQ] = useState('');
  const [classe, setClasse] = useState('');

  const charger = () => client.get('/bourse/boursiers').then((r) => setBoursiers(r.data.boursiers)).catch(() => setBoursiers((b) => b || []));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['bourse'] });

  const classes = [...new Set((boursiers || []).map((b) => b.classe).filter(Boolean))].sort();
  const filtre = q.trim().toLowerCase();
  const liste = (boursiers || []).filter((b) => (!classe || b.classe === classe)
    && (!filtre || `${b.nom} ${b.prenom} ${b.matricule} ${b.numeroBoursier}`.toLowerCase().includes(filtre)));

  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Boursiers ANBG <span className="entete-carte-compteur">{liste.length}</span></h2>
        <BoutonDocument className="secondaire" chemin="/api/bourse/export"><IconDownload width={16} height={16} /> Exporter (Excel)</BoutonDocument>
      </div>
      <div className="barre-outils">
        <label className="champ-recherche"><IconSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, matricule ou n° de boursier…" aria-label="Rechercher un boursier" /></label>
        <select className="filtre-select" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Nom</th><th>Prénom</th><th>Matricule</th><th>Classe</th><th>N° boursier ANBG</th><th>Dossier ANBG</th></tr></thead>
          <tbody>
            {liste.map((b) => (
              <tr key={b.eleveId}>
                <td className="cellule-nom">{b.nom}</td>
                <td>{b.prenom}</td>
                <td className="mono">{b.matricule}</td>
                <td>{b.classe}</td>
                <td className="mono">{b.numeroBoursier}</td>
                <td>
                  {b.envoye
                    ? <span className="badge vert">Envoyé{b.envoyeLe ? ` le ${new Date(b.envoyeLe).toLocaleDateString('fr-FR')}` : ''}</span>
                    : <span className="badge gris">En préparation</span>}
                </td>
              </tr>
            ))}
            {boursiers && liste.length === 0 && (
              <tr><td colSpan={6} className="vide">{boursiers.length ? 'Aucun boursier ne correspond à la recherche.' : 'Aucun boursier pour l’instant. Un étudiant apparaît ici dès qu’il renseigne son numéro de boursier ANBG dans son espace.'}</td></tr>
            )}
            {!boursiers && <tr><td colSpan={6} className="chargement">Chargement…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
