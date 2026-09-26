import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { IconBanknote, IconCard } from '../../components/icons';

const STYLE_STATUT = { du: 'gris', partiel: 'or', solde: 'vert', impaye: 'rouge' };
const LIBELLE_STATUT = { du: 'Dû', partiel: 'Partiel', solde: 'Soldé', impaye: 'Impayé' };

function dateLongue(iso) {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export default function FraisEtudiant({ eleveId }) {
  const [frais, setFrais] = useState([]);
  const [paiements, setPaiements] = useState([]);

  function charger() {
    if (!eleveId) return;
    client.get(`/finance/frais/eleve/${eleveId}`).then((res) => setFrais(res.data.frais)).catch(() => {});
    client.get(`/finance/paiements/eleve/${eleveId}`).then((res) => setPaiements(res.data.frais)).catch(() => {});
  }
  useEffect(charger, [eleveId]);
  useActualisation(charger);

  const recus = paiements.flatMap((f) => (f.Paiements || []).map((p) => ({ ...p, libelleFrais: f.libelle })));

  const totalDu = frais.reduce((s, f) => s + f.montant, 0);
  const totalRegle = frais.reduce((s, f) => s + f.montantRegle, 0);
  const solde = totalDu - totalRegle;

  return (
    <>
      {frais.length > 0 && (
        <div className="stats-grid">
          <div className="stat-tile">
            <div className="stat-tile-haut"><span className="libelle">Total dû</span><span className="puce-icone petite"><IconBanknote width={16} height={16} /></span></div>
            <div className="valeur">{totalDu.toLocaleString('fr-FR')}</div>
            <div className="libelle">FCFA</div>
          </div>
          <div className="stat-tile tile-vert">
            <div className="stat-tile-haut"><span className="libelle">Déjà réglé</span><span className="puce-icone petite"><IconCard width={16} height={16} /></span></div>
            <div className="valeur">{totalRegle.toLocaleString('fr-FR')}</div>
            <div className="libelle">FCFA</div>
          </div>
          <div className={`stat-tile ${solde > 0 ? 'tile-rouge' : 'tile-vert'}`}>
            <div className="stat-tile-haut"><span className="libelle">Solde restant</span></div>
            <div className="valeur">{solde.toLocaleString('fr-FR')}</div>
            <div className="libelle">FCFA</div>
          </div>
        </div>
      )}
      <div className="carte">
        <h2>Frais et échéances</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Frais</th><th className="chiffre">Montant</th><th>Échéance</th><th>Réglé</th><th>Statut</th></tr></thead>
            <tbody>
              {frais.map((f) => {
                const pct = f.montant > 0 ? Math.min(100, Math.round((f.montantRegle / f.montant) * 100)) : 0;
                return (
                  <tr key={f.id}>
                    <td className="cellule-nom">{f.libelle}</td>
                    <td className="chiffre">{f.montant.toLocaleString('fr-FR')} FCFA</td>
                    <td>{dateLongue(f.dateEcheance)}</td>
                    <td>
                      <div className="jauge-frais">
                        <div className="jauge-frais-piste"><div className="jauge-frais-remplissage" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--succes)' : pct === 0 ? 'var(--erreur)' : 'var(--alerte)' }} /></div>
                        <span className="jauge-frais-texte">{f.montantRegle.toLocaleString('fr-FR')} / {f.montant.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STYLE_STATUT[f.statut]}`}>{LIBELLE_STATUT[f.statut] ?? f.statut}</span></td>
                  </tr>
                );
              })}
              {frais.length === 0 && <tr><td colSpan={5} className="vide">Aucun frais enregistré pour le moment</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="carte">
        <h2>Reçus de paiement</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Frais</th><th className="chiffre">Montant</th><th>Mode</th><th>Reçu</th></tr></thead>
            <tbody>
              {recus.map((p) => (
                <tr key={p.id}>
                  <td>{p.libelleFrais}</td>
                  <td className="chiffre">{p.montant.toLocaleString('fr-FR')} FCFA</td>
                  <td><span className="badge gris">{p.modePaiement}</span></td>
                  <td>
                    {p.Recu?.fichierPDF
                      ? <a href={p.Recu.fichierPDF} target="_blank" rel="noreferrer" className="secondaire" style={{ display: 'inline-block', textDecoration: 'none', padding: '5px 12px' }}>Télécharger</a>
                      : <span className="note-secondaire">Indisponible</span>}
                  </td>
                </tr>
              ))}
              {recus.length === 0 && <tr><td colSpan={4} className="vide">Aucun reçu pour le moment</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
