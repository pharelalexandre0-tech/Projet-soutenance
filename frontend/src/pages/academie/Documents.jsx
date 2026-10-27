import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import BoutonDocument from '../../components/BoutonDocument';
import RegistreCertifications from '../../components/RegistreCertifications';
import { IconDownload, IconClipboard, IconDocument, IconCalendar, IconUsers } from '../../components/icons';

// Documents à télécharger par l'Académie, à l'identité de l'établissement :
// listes de présence à imprimer, récapitulatif des présences, procès-verbal
// des résultats (notes, mentions, décisions) et emplois du temps. PDF prêts
// à imprimer ou à partager, Excel pour retravailler les chiffres.

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const requete = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();

function Champ({ label, htmlFor, children }) {
  return <div className="champ"><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}

function ChoixClasse({ id, classes, valeur, onChange, toutes = false }) {
  return (
    <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choisir une classe</option>
      {toutes && <option value="toutes">Toutes les classes</option>}
      {classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>)}
    </select>
  );
}

function ChoixSemestre({ id, semestres, valeur, onChange }) {
  return (
    <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choisir un semestre</option>
      {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle} ({s.anneeScolaire})</option>)}
    </select>
  );
}

function CarteDocument({ icone: Icone, titre, description, children, actions }) {
  return (
    <section className="carte carte-document">
      <div className="entete-carte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="puce-icone petite"><Icone width={16} height={16} /></span>
          <h2>{titre}</h2>
        </div>
      </div>
      <p className="carte-document-texte">{description}</p>
      <div className="carte-document-champs">{children}</div>
      <div className="carte-document-actions">{actions}</div>
    </section>
  );
}

export default function Documents() {
  const [classes, setClasses] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [presence, setPresence] = useState({ classeId: '', date: aujourdhui(), cours: '', enseignant: '' });
  const [recap, setRecap] = useState({ classeId: '', du: '', au: '' });
  const [resultats, setResultats] = useState({ classeId: '', semestreId: '', ordre: 'merite' });
  const [edt, setEdt] = useState({ classeId: 'toutes', semestreId: '' });
  // Un téléchargement certifie un document : le registre se recharge.
  const [emissions, setEmissions] = useState(0);
  const emis = () => setEmissions((n) => n + 1);

  function charger() {
    return Promise.all([
      client.get('/classes').then((res) => setClasses(res.data.classes)),
      client.get('/semestres').then((res) => {
        setSemestres(res.data.semestres);
        const premier = res.data.semestres[0]?.id;
        if (premier) {
          setResultats((r) => (r.semestreId ? r : { ...r, semestreId: String(premier) }));
          setEdt((r) => (r.semestreId ? r : { ...r, semestreId: String(premier) }));
        }
      }),
      client.get('/professeurs').then((res) => setProfesseurs(res.data.professeurs || [])).catch(() => {}),
    ]).catch(() => {});
  }
  useEffect(() => { charger(); }, []);
  useActualisation(charger, { domaines: ['classes', 'semestres', 'professeurs'] });

  return (
    <>
    <div className="grille-documents">
      <CarteDocument
        icone={IconClipboard}
        titre="Liste de présence"
        description="Feuille d'émargement à imprimer : élèves de la classe avec cases Présent, Absent, Retard et signature. Une page par classe."
        actions={(
          <BoutonDocument onTermine={emis} className="primaire" chemin={`/api/documents/liste-presence?${requete(presence)}`} disabled={!presence.classeId}>
            <IconDownload width={16} height={16} /> Télécharger en PDF
          </BoutonDocument>
        )}
      >
        <Champ label="Classe" htmlFor="p-classe"><ChoixClasse id="p-classe" classes={classes} valeur={presence.classeId} onChange={(v) => setPresence({ ...presence, classeId: v })} toutes /></Champ>
        <Champ label="Date" htmlFor="p-date"><input id="p-date" type="date" value={presence.date} onChange={(e) => setPresence({ ...presence, date: e.target.value })} /></Champ>
        <Champ label="Cours ou matière (facultatif)" htmlFor="p-cours"><input id="p-cours" value={presence.cours} onChange={(e) => setPresence({ ...presence, cours: e.target.value })} placeholder="Ex. Programmation Python" /></Champ>
        <Champ label="Enseignant (facultatif)" htmlFor="p-ens">
          <input id="p-ens" list="liste-professeurs" value={presence.enseignant} onChange={(e) => setPresence({ ...presence, enseignant: e.target.value })} placeholder="Nom de l'enseignant" />
          <datalist id="liste-professeurs">{professeurs.map((p) => <option key={p.id} value={`${p.prenom} ${p.nom}`} />)}</datalist>
        </Champ>
      </CarteDocument>

      <CarteDocument
        icone={IconUsers}
        titre="Récapitulatif des présences"
        description="Absences non justifiées, justifiées et retards enregistrés pour chaque élève, sur toute l'année ou sur une période."
        actions={(
          <>
            <BoutonDocument onTermine={emis} className="primaire" chemin={`/api/documents/recapitulatif-presences?${requete(recap)}`} disabled={!recap.classeId}>
              <IconDownload width={16} height={16} /> PDF
            </BoutonDocument>
            <BoutonDocument className="secondaire" chemin={`/api/documents/recapitulatif-presences?${requete({ ...recap, format: 'xlsx' })}`} disabled={!recap.classeId}>
              <IconDownload width={16} height={16} /> Excel
            </BoutonDocument>
          </>
        )}
      >
        <Champ label="Classe" htmlFor="r-classe"><ChoixClasse id="r-classe" classes={classes} valeur={recap.classeId} onChange={(v) => setRecap({ ...recap, classeId: v })} /></Champ>
        <Champ label="Du (facultatif)" htmlFor="r-du"><input id="r-du" type="date" value={recap.du} onChange={(e) => setRecap({ ...recap, du: e.target.value })} /></Champ>
        <Champ label="Au (facultatif)" htmlFor="r-au"><input id="r-au" type="date" value={recap.au} onChange={(e) => setRecap({ ...recap, au: e.target.value })} /></Champ>
      </CarteDocument>

      <CarteDocument
        icone={IconDocument}
        titre="Notes, résultats et mentions"
        description="Procès-verbal de la classe : moyenne de chaque UE, moyenne générale, crédits, mention, résultat et décision (admis ou rattrapage). L'Excel ajoute le détail des notes par matière."
        actions={(
          <>
            <BoutonDocument onTermine={emis} className="primaire" chemin={`/api/documents/resultats?${requete(resultats)}`} disabled={!resultats.classeId || !resultats.semestreId}>
              <IconDownload width={16} height={16} /> PDF
            </BoutonDocument>
            <BoutonDocument className="secondaire" chemin={`/api/documents/resultats?${requete({ ...resultats, format: 'xlsx' })}`} disabled={!resultats.classeId || !resultats.semestreId}>
              <IconDownload width={16} height={16} /> Excel
            </BoutonDocument>
          </>
        )}
      >
        <Champ label="Classe" htmlFor="n-classe"><ChoixClasse id="n-classe" classes={classes} valeur={resultats.classeId} onChange={(v) => setResultats({ ...resultats, classeId: v })} /></Champ>
        <Champ label="Semestre" htmlFor="n-sem"><ChoixSemestre id="n-sem" semestres={semestres} valeur={resultats.semestreId} onChange={(v) => setResultats({ ...resultats, semestreId: v })} /></Champ>
        <Champ label="Ordre" htmlFor="n-ordre">
          <select id="n-ordre" value={resultats.ordre} onChange={(e) => setResultats({ ...resultats, ordre: e.target.value })}>
            <option value="merite">Par mérite (rang)</option>
            <option value="alphabetique">Par ordre alphabétique</option>
          </select>
        </Champ>
      </CarteDocument>

      <CarteDocument
        icone={IconCalendar}
        titre="Emplois du temps"
        description="Semaine type de chaque classe, une couleur par matière, avec les salles et le volume horaire. Une page par classe."
        actions={(
          <BoutonDocument onTermine={emis} className="primaire" chemin={`/api/documents/emplois-du-temps?${requete(edt)}`} disabled={!edt.classeId || !edt.semestreId}>
            <IconDownload width={16} height={16} /> Télécharger en PDF
          </BoutonDocument>
        )}
      >
        <Champ label="Classe" htmlFor="e-classe"><ChoixClasse id="e-classe" classes={classes} valeur={edt.classeId} onChange={(v) => setEdt({ ...edt, classeId: v })} toutes /></Champ>
        <Champ label="Semestre" htmlFor="e-sem"><ChoixSemestre id="e-sem" semestres={semestres} valeur={edt.semestreId} onChange={(v) => setEdt({ ...edt, semestreId: v })} /></Champ>
      </CarteDocument>
    </div>
    <RegistreCertifications actualiser={emissions} />
    </>
  );
}
