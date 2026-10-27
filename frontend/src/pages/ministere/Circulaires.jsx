import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import Modal from '../../components/Modal';
import Tiroir from '../../components/Tiroir';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import { useNational, dateFr } from './commun';
import { IconPlus, IconMegaphone, IconChevronRight } from '../../components/icons';

const PRIORITES = { information: ['Information', 'gris'], instruction: ['Instruction', 'bleu'], urgent: ['Urgent', 'rouge'] };
const VIDE = { titre: '', objet: '', contenu: '', priorite: 'information', echeance: '', signataire: '', mode: 'toutes', provinces: [], types: [], etablissements: [] };

// Circulaires du ministère : publication ciblée et suivi des lectures et
// accusés de réception.
export default function Circulaires() {
  const { donnees } = useNational();
  const [circulaires, setCirculaires] = useState(null);
  const [nouvelle, setNouvelle] = useState(null);
  const [suivi, setSuivi] = useState(null);
  const [toast, setToast] = useState(null);

  const charger = () => client.get('/ministere/circulaires').then((r) => setCirculaires(r.data.circulaires)).catch(() => setCirculaires((c) => c || []));
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { plateforme: true });

  return (
    <section className="carte">
      <div className="entete-carte">
        <h2>Circulaires publiées <span className="entete-carte-compteur">{circulaires?.length ?? 0}</span></h2>
        <button type="button" className="primaire" onClick={() => setNouvelle(VIDE)}><IconPlus /> Nouvelle circulaire</button>
      </div>
      <div className="table-scroll">
        <table className="table-ministere">
          <thead><tr><th>Référence</th><th>Titre</th><th>Priorité</th><th>Publiée le</th><th>Échéance</th><th>Destinataires</th><th>Lues</th><th>Accusés</th><th aria-label="Suivi" /></tr></thead>
          <tbody>
            {(circulaires || []).map((c) => (
              <tr key={c.id} className="ligne-cliquable" onClick={() => setSuivi(c.id)}>
                <td className="mono">{c.reference}</td>
                <td className="cellule-nom">{c.titre}</td>
                <td><span className={`badge ${PRIORITES[c.priorite][1]}`}>{PRIORITES[c.priorite][0]}</span></td>
                <td>{dateFr(c.publieeLe)}</td>
                <td>{dateFr(c.echeance)}</td>
                <td className="cellule-nombre">{c.destinataires}</td>
                <td className="cellule-nombre">{c.lues}</td>
                <td className="cellule-nombre">{c.accusees} / {c.destinataires}</td>
                <td className="cellule-chevron"><IconChevronRight /></td>
              </tr>
            ))}
            {circulaires && circulaires.length === 0 && <tr><td colSpan={9} className="vide">Aucune circulaire publiée pour l’instant.</td></tr>}
            {!circulaires && <tr><td colSpan={9} className="chargement">Chargement…</td></tr>}
          </tbody>
        </table>
      </div>
      {nouvelle && donnees && (
        <NouvelleCirculaire
          referentiel={donnees}
          onFermer={() => setNouvelle(null)}
          onPubliee={(r) => { setNouvelle(null); setToast({ message: `Circulaire ${r.circulaire.reference} envoyée à ${r.destinataires} établissement(s)`, type: 'succes' }); charger(); }}
        />
      )}
      {suivi && <SuiviCirculaire id={suivi} onFermer={() => setSuivi(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </section>
  );
}

function bascule(liste, valeur) {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

function NouvelleCirculaire({ referentiel, onFermer, onPubliee }) {
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function publier(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const cible = form.mode === 'toutes' ? { toutes: true } : { provinces: form.provinces, types: form.types, etablissements: form.etablissements };
      const r = await client.post('/ministere/circulaires', { titre: form.titre, objet: form.objet, contenu: form.contenu, priorite: form.priorite, echeance: form.echeance || null, signataire: form.signataire || null, cible });
      onPubliee(r.data);
    } catch (err) {
      setErreur(messageErreur(err, 'publication impossible'));
      setEnCours(false);
    }
  }

  return (
    <Modal titre="Nouvelle circulaire" onFermer={onFermer} largeur={720}>
      <form className="formulaire" onSubmit={publier}>
        <div className="champ"><label htmlFor="c-titre">Titre</label><input id="c-titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required /></div>
        <div className="champ"><label htmlFor="c-objet">Objet (facultatif)</label><input id="c-objet" value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} /></div>
        <div className="champ"><label htmlFor="c-texte">Texte de la circulaire</label><textarea id="c-texte" rows={8} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} required /></div>
        <div className="ligne-champs">
          <div className="champ"><label htmlFor="c-prio">Priorité</label>
            <select id="c-prio" value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })}>
              {Object.entries(PRIORITES).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="champ"><label htmlFor="c-ech">Échéance de réponse (facultatif)</label><input id="c-ech" type="date" value={form.echeance} onChange={(e) => setForm({ ...form, echeance: e.target.value })} /></div>
          <div className="champ"><label htmlFor="c-sign">Signataire</label><input id="c-sign" value={form.signataire} onChange={(e) => setForm({ ...form, signataire: e.target.value })} placeholder="Par défaut : vous" /></div>
        </div>
        <fieldset className="choix-destinataires">
          <legend>Destinataires</legend>
          <label className="case-confirmation"><input type="radio" name="mode" checked={form.mode === 'toutes'} onChange={() => setForm({ ...form, mode: 'toutes' })} /> Tous les établissements</label>
          <label className="case-confirmation"><input type="radio" name="mode" checked={form.mode === 'selection'} onChange={() => setForm({ ...form, mode: 'selection' })} /> Une sélection</label>
          {form.mode === 'selection' && (
            <div className="grille-destinataires">
              <div><strong>Provinces</strong>{referentiel.provinces.map((p) => <label key={p} className="case-confirmation"><input type="checkbox" checked={form.provinces.includes(p)} onChange={() => setForm({ ...form, provinces: bascule(form.provinces, p) })} /> {p}</label>)}</div>
              <div><strong>Types</strong>{referentiel.types.map((t) => <label key={t.valeur} className="case-confirmation"><input type="checkbox" checked={form.types.includes(t.valeur)} onChange={() => setForm({ ...form, types: bascule(form.types, t.valeur) })} /> {t.libelle}</label>)}</div>
              <div><strong>Établissements</strong>{referentiel.etablissements.map((e) => <label key={e.id} className="case-confirmation"><input type="checkbox" checked={form.etablissements.includes(e.id)} onChange={() => setForm({ ...form, etablissements: bascule(form.etablissements, e.id) })} /> {e.nom}</label>)}</div>
            </div>
          )}
        </fieldset>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <div className="confirmation-actions">
          <button type="button" className="secondaire" onClick={onFermer} disabled={enCours}>Annuler</button>
          <button type="submit" className="primaire" disabled={enCours}>{enCours ? 'Publication…' : 'Publier et notifier'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SuiviCirculaire({ id, onFermer }) {
  const [donnees, setDonnees] = useState(null);
  useEffect(() => { client.get(`/ministere/circulaires/${id}`).then((r) => setDonnees(r.data)).catch(() => {}); }, [id]);
  const c = donnees?.circulaire;
  return (
    <Tiroir titre={c ? c.titre : 'Circulaire'} sousTitre={c ? `${c.reference} · publiée le ${dateFr(c.publieeLe)}` : ''} icone={<span className="tuile-fonctionnalite"><IconMegaphone /></span>} onFermer={onFermer}>
      {!donnees && <div className="chargement">Chargement…</div>}
      {c && (
        <>
          <section className="tiroir-section">
            {c.objet && <p><strong>Objet :</strong> {c.objet}</p>}
            <div className="texte-circulaire">{c.contenu.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
            <p className="note-secondaire">Signataire : {c.signataire}</p>
          </section>
          <section className="tiroir-section">
            <h3>Suivi des établissements</h3>
            <ul className="liste-sessions">
              {donnees.destinataires.map((d) => (
                <li key={d.id}>
                  <div><strong>{d.nom}</strong><span>{d.province || ''}{d.lueLe ? ` · lue le ${dateFr(d.lueLe)}` : ''}</span></div>
                  {d.accuseLe ? <span className="badge vert" title={d.accuseParNom}>Accusé le {dateFr(d.accuseLe)}</span> : d.lueLe ? <span className="badge or">Lue</span> : <span className="badge gris">Non lue</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Tiroir>
  );
}
