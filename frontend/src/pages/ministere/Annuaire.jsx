import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import { messageErreur } from '../../utils/erreurs';
import { nombre, pct, Telechargements, EtatChargement } from './commun';

const virgule = (v) => (v == null ? 'N/A' : String(v).replace('.', ','));

// Annuaire statistique de l'enseignement supérieur : effectifs par
// établissement, province, niveau et type, encadrement et offre de
// formation. Téléchargeable en PDF certifié et en Excel.
export default function Annuaire() {
  const [a, setA] = useState(null);
  const [erreur, setErreur] = useState('');
  const charger = () => client.get('/ministere/annuaire').then((r) => setA(r.data)).catch((e) => setErreur(messageErreur(e, 'annuaire indisponible')));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true, delai: 2000 });
  if (!a) return <EtatChargement erreur={erreur} />;
  const t = a.totaux;

  return (
    <>
      <section className="carte document-officiel">
        <div className="entete-carte">
          <div>
            <h2>Annuaire statistique de l’enseignement supérieur</h2>
            <p className="note-secondaire">Édition {new Date().getFullYear()} · données agrégées, sans aucune information nominative</p>
          </div>
          <Telechargements chemin="/api/ministere/annuaire" libelle="Télécharger l’annuaire" />
        </div>
        <dl className="identite-ecole-chiffres annuaire-chiffres">
          <div><dt>Établissements</dt><dd>{t.etablissements}</dd></div>
          <div><dt>Étudiants</dt><dd>{nombre(t.etudiants)}</dd></div>
          <div><dt>Femmes</dt><dd>{pct(t.partFemmes)}</dd></div>
          <div><dt>Enseignants</dt><dd>{nombre(t.enseignants)}</dd></div>
          <div><dt>Étudiants / enseignant</dt><dd>{virgule(t.ratio)}</dd></div>
          <div><dt>Formations habilitées</dt><dd>{t.formations}</dd></div>
        </dl>
      </section>

      <section className="carte">
        <div className="entete-carte"><h2>1. Effectifs par établissement</h2></div>
        <div className="table-scroll">
          <table className="table-ministere">
            <thead><tr><th>Établissement</th><th>Province</th><th>Type</th><th className="chiffre">Étudiants</th><th className="chiffre">Femmes</th><th className="chiffre">Hommes</th><th className="chiffre">% femmes</th><th className="chiffre">Enseignants</th><th className="chiffre">Étud. / ens.</th></tr></thead>
            <tbody>
              {a.etablissements.map((e) => (
                <tr key={e.id}>
                  <td className="cellule-nom">{e.nom}</td><td>{e.province}</td><td>{e.type}</td>
                  <td className="chiffre"><b>{nombre(e.total)}</b></td><td className="chiffre">{nombre(e.femmes)}</td><td className="chiffre">{nombre(e.hommes)}</td>
                  <td className="chiffre">{pct(e.partFemmes)}</td><td className="chiffre">{nombre(e.enseignants)}</td><td className="chiffre">{virgule(e.ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grille-deux">
        <section className="carte">
          <div className="entete-carte"><h2>2. Par province</h2></div>
          <div className="table-scroll">
            <table className="table-ministere">
              <thead><tr><th>Province</th><th className="chiffre">Établ.</th><th className="chiffre">Étudiants</th><th className="chiffre">Femmes</th><th className="chiffre">Enseignants</th></tr></thead>
              <tbody>{a.parProvince.map((p) => <tr key={p.libelle}><td className="cellule-nom">{p.libelle}</td><td className="chiffre">{p.etablissements}</td><td className="chiffre"><b>{nombre(p.total)}</b></td><td className="chiffre">{nombre(p.femmes)}</td><td className="chiffre">{nombre(p.enseignants)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="carte">
          <div className="entete-carte"><h2>3. Par niveau d’études</h2></div>
          <div className="table-scroll">
            <table className="table-ministere">
              <thead><tr><th>Niveau</th><th className="chiffre">Étudiants</th><th className="chiffre">Femmes</th><th className="chiffre">Hommes</th></tr></thead>
              <tbody>{a.parNiveau.map((n) => <tr key={n.niveau}><td className="cellule-nom">{n.niveau}</td><td className="chiffre"><b>{nombre(n.total)}</b></td><td className="chiffre">{nombre(n.femmes)}</td><td className="chiffre">{nombre(n.hommes)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="carte">
        <div className="entete-carte"><h2>4. Offre de formation habilitée</h2></div>
        <dl className="identite-ecole-chiffres annuaire-chiffres">
          <div><dt>Licences</dt><dd>{t.offre.licence}</dd></div>
          <div><dt>Masters</dt><dd>{t.offre.master}</dd></div>
          <div><dt>Doctorats</dt><dd>{t.offre.doctorat}</dd></div>
        </dl>
      </section>
    </>
  );
}
