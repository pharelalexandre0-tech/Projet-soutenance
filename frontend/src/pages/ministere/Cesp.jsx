import { useState } from 'react';
import client from '../../api/client';
import { messageErreur } from '../../utils/erreurs';
import { dateCourte } from './commun';

const TONS_AVIS = { favorable: 'vert', reserves: 'or', defavorable: 'rouge' };

// Avis de la Commission pour l'Enseignement Supérieur Privé (CESP) : la
// commission examine le dossier en session et rend un avis ; le ministère
// s'appuie dessus avant le décret d'habilitation ou d'autorisation.
export function AvisCesp({ e, avis, referentiel, onEnregistre }) {
  const [form, setForm] = useState({ session: new Date().toISOString().slice(0, 10), objet: e.agrementStatut === 'habilite' ? 'autorisation' : 'habilitation', avis: 'favorable', observations: '', rapporteur: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const champ = (cle) => ({ value: form[cle], onChange: (ev) => setForm({ ...form, [cle]: ev.target.value }) });
  const libelle = (liste, valeur) => liste.find((x) => x.valeur === valeur)?.libelle || valeur;

  async function enregistrer(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await client.post(`/ministere/etablissements/${e.id}/cesp`, form);
      setForm({ ...form, observations: '' });
      onEnregistre('Avis de la CESP enregistré');
    } catch (err) {
      setErreur(messageErreur(err, 'avis non enregistré'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grille-deux">
      <section className="carte">
        <div className="entete-carte"><h2>Avis de la CESP</h2></div>
        {e.typeEtablissement === 'universite_publique' && <p className="note-secondaire">Établissement public : la CESP ne se prononce que sur les établissements privés. Les avis restent consultables ici.</p>}
        <form className="formulaire" onSubmit={enregistrer}>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="cesp-session">Session du</label><input id="cesp-session" type="date" {...champ('session')} required /></div>
            <div className="champ"><label htmlFor="cesp-objet">Objet</label>
              <select id="cesp-objet" {...champ('objet')}>{referentiel.objetsCesp.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}</select>
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ"><label htmlFor="cesp-avis">Avis rendu</label>
              <select id="cesp-avis" {...champ('avis')}>{referentiel.avisCesp.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}</select>
            </div>
            <div className="champ"><label htmlFor="cesp-rapporteur">Rapporteur (facultatif)</label><input id="cesp-rapporteur" {...champ('rapporteur')} /></div>
          </div>
          <div className="champ"><label htmlFor="cesp-obs">Observations de la commission</label><textarea id="cesp-obs" rows={4} placeholder="Ex. dossier complet, locaux visités, réserves sur la bibliothèque" {...champ('observations')} /></div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button type="submit" className="primaire" disabled={enCours || form.observations.trim().length < 10}>{enCours ? 'Enregistrement…' : 'Enregistrer l’avis'}</button>
        </form>
      </section>
      <section className="carte">
        <div className="entete-carte"><h2>Avis rendus <span className="entete-carte-compteur">{avis.length}</span></h2></div>
        {avis.length === 0 && <div className="vide">Aucun avis de la CESP enregistré.</div>}
        <ol className="historique-decisions">
          {avis.map((a) => (
            <li key={a.id}>
              <span className="historique-date">{dateCourte(a.session)}</span>
              <div>
                <strong>{libelle(referentiel.objetsCesp, a.objet)} <span className={`badge ${TONS_AVIS[a.avis]}`}>{libelle(referentiel.avisCesp, a.avis)}</span></strong>
                <p>{a.observations}</p>
                <small>{[a.rapporteur && `Rapporteur : ${a.rapporteur}`, `saisi par ${a.saisiParNom}`].filter(Boolean).join(' · ')}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// Grille de conformité : points vérifiés par les agents, capacité
// d'accueil, et indicateurs calculés sur les données de l'école.
export function Conformite({ e, conformite, onEnregistre }) {
  const initial = Object.fromEntries(conformite.points.map((p) => [p.cle, p.valeur === null ? '' : String(p.valeur)]));
  const [form, setForm] = useState({ ...initial, capaciteAccueil: conformite.capaciteAccueil ?? '', observations: conformite.observations || '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur('');
    const corps = { capaciteAccueil: form.capaciteAccueil, observations: form.observations };
    conformite.points.forEach((p) => { if (form[p.cle] !== '') corps[p.cle] = form[p.cle] === 'true'; });
    try {
      await client.put(`/ministere/etablissements/${e.id}/conformite`, corps);
      onEnregistre('Grille de conformité enregistrée');
    } catch (err) {
      setErreur(messageErreur(err, 'grille non enregistrée'));
    } finally {
      setEnCours(false);
    }
  }

  const etat = (v) => (v === null ? <span className="badge gris">Non vérifié</span> : v ? <span className="badge vert">Conforme</span> : <span className="badge rouge">Non conforme</span>);
  return (
    <div className="grille-deux">
      <section className="carte">
        <div className="entete-carte">
          <h2>Grille de conformité</h2>
          <span className="badge bleu">{conformite.satisfaits} / {conformite.evalues} points conformes</span>
        </div>
        <form className="formulaire" onSubmit={enregistrer}>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Point vérifié</th><th>Constat</th></tr></thead>
              <tbody>
                {conformite.points.map((p) => (
                  <tr key={p.cle}>
                    <td className="cellule-nom">{p.libelle}</td>
                    <td>
                      <select aria-label={p.libelle} value={form[p.cle]} onChange={(ev) => setForm({ ...form, [p.cle]: ev.target.value })}>
                        <option value="">Non vérifié</option><option value="true">Conforme</option><option value="false">Non conforme</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="champ" style={{ maxWidth: 260 }}><label htmlFor="conf-capacite">Capacité d’accueil (places)</label><input id="conf-capacite" type="number" min="1" value={form.capaciteAccueil} onChange={(ev) => setForm({ ...form, capaciteAccueil: ev.target.value })} /></div>
          <div className="champ"><label htmlFor="conf-obs">Observations</label><textarea id="conf-obs" rows={3} value={form.observations} onChange={(ev) => setForm({ ...form, observations: ev.target.value })} /></div>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer la grille'}</button>
          {conformite.verifieLe && <p className="note-secondaire" style={{ margin: 0 }}>Dernière vérification le {dateCourte(conformite.verifieLe)} par {conformite.verifieParNom}.</p>}
        </form>
      </section>
      <section className="carte">
        <div className="entete-carte"><h2>Indicateurs calculés</h2></div>
        <p className="note-secondaire" style={{ marginTop: -6 }}>Établis à partir des données de l’établissement, sans saisie du ministère.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Indicateur</th><th>Valeur</th><th>Constat</th></tr></thead>
            <tbody>
              {conformite.automatiques.map((a) => (
                <tr key={a.cle}><td className="cellule-nom">{a.libelle}</td><td>{a.detail}</td><td>{etat(a.valeur)}</td></tr>
              ))}
              <tr>
                <td className="cellule-nom">Enseignants permanents</td>
                <td>{conformite.enseignantsPermanents} sur {e.enseignants}</td>
                <td>{conformite.tauxPermanents == null ? <span className="badge gris">Aucun enseignant</span> : <span className="badge bleu">{String(conformite.tauxPermanents).replace('.', ',')} %</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
