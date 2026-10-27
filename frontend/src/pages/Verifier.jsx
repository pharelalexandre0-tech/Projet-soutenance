import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client, { ORIGINE_API } from '../api/client';
import logoIcon from '../assets/logo-icon.png';
import {
  IconArrowLeft, IconShield, IconShieldX, IconShieldAlert, IconFileCheck, IconQrCode, IconFingerprint, IconUpload, IconSearch,
} from '../components/icons';

const dateHeure = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Libreville' });
const dateSeule = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' });

// Format XXXX-XXXX-XXXX pendant la frappe.
function formaterSaisie(valeur) {
  const brut = valeur.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12);
  return brut.match(/.{1,4}/g)?.join('-') || '';
}

async function empreinteFichier(fichier) {
  const tampon = await fichier.arrayBuffer();
  const hache = await crypto.subtle.digest('SHA-256', tampon);
  return Array.from(new Uint8Array(hache), (o) => o.toString(16).padStart(2, '0')).join('');
}

const VERDICTS = {
  authentique: {
    classe: 'ok', Icone: IconShield, titre: 'Document authentique',
    texte: (r) => `Émis par ${r.etablissement?.nom || 'l’établissement'} le ${dateSeule(r.emisLe)}, toujours en vigueur.`,
  },
  remplace: {
    classe: 'attention', Icone: IconShieldAlert, titre: 'Version remplacée',
    texte: (r) => `Ce document a bien été émis, mais une version plus récente l’a remplacé le ${dateSeule(r.remplaceLe)}. Demandez la dernière version au titulaire ou à l’établissement.`,
  },
  annule: {
    classe: 'refus', Icone: IconShieldX, titre: 'Document annulé',
    texte: (r) => `L’établissement a annulé ce document le ${dateSeule(r.annuleLe)}.${r.motifAnnulation ? ` Motif : ${r.motifAnnulation}` : ''}`,
  },
  signature: {
    classe: 'refus', Icone: IconShieldX, titre: 'Signature invalide',
    texte: () => 'Les informations enregistrées ne correspondent plus à la signature d’origine. Ne vous fiez pas à ce document et contactez l’établissement.',
  },
};

function verdictDe(r) {
  if (!r.signatureValide) return VERDICTS.signature;
  if (r.statut === 'annule') return VERDICTS.annule;
  if (r.statut === 'remplace') return VERDICTS.remplace;
  return VERDICTS.authentique;
}

function ControleFichier({ empreintes }) {
  const [etat, setEtat] = useState(null);
  const champ = useRef(null);

  async function controler(fichier) {
    if (!fichier) return;
    setEtat({ enCours: true, nom: fichier.name });
    try {
      const empreinte = await empreinteFichier(fichier);
      setEtat({ nom: fichier.name, empreinte, conforme: empreintes.includes(empreinte) });
    } catch {
      setEtat({ nom: fichier.name, erreur: true });
    }
  }

  return (
    <section className="verif-bloc">
      <h2><IconFileCheck /> Contrôler le fichier reçu</h2>
      <p className="verif-aide">
        Si l’on vous a transmis le PDF, déposez-le ici : son empreinte est calculée dans votre navigateur
        (le fichier ne quitte pas votre appareil) et comparée à celle de l’original.
      </p>
      <button
        type="button"
        className="verif-depot"
        onClick={() => champ.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); controler(e.dataTransfer.files?.[0]); }}
      >
        <IconUpload />
        <span><strong>Choisir le fichier PDF</strong> ou le déposer ici</span>
      </button>
      <input ref={champ} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => controler(e.target.files?.[0])} />
      {etat?.enCours && <p className="verif-fichier">Calcul de l’empreinte de {etat.nom}…</p>}
      {etat?.erreur && <p className="verif-fichier refus">Lecture impossible de {etat.nom}.</p>}
      {etat && !etat.enCours && !etat.erreur && (
        <div className={`verif-fichier ${etat.conforme ? 'ok' : 'refus'}`}>
          <strong>{etat.conforme ? 'Fichier original, identique octet pour octet.' : 'Ce fichier ne correspond à aucune version émise.'}</strong>
          {!etat.conforme && <span>Il a pu être modifié après son émission. Fiez-vous uniquement aux informations affichées sur cette page.</span>}
          <code>{etat.empreinte}</code>
        </div>
      )}
    </section>
  );
}

function FormulaireCode({ initial = '' }) {
  const [code, setCode] = useState(formaterSaisie(initial));
  const naviguer = useNavigate();
  const complet = code.replace(/-/g, '').length === 12;
  return (
    <form className="verif-formulaire" onSubmit={(e) => { e.preventDefault(); if (complet) naviguer(`/verifier/${code}`); }}>
      <label htmlFor="verif-code">Code de vérification</label>
      <div className="verif-formulaire-ligne">
        <input
          id="verif-code"
          value={code}
          onChange={(e) => setCode(formaterSaisie(e.target.value))}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
        <button type="submit" className="primaire" disabled={!complet}><IconSearch /> Vérifier</button>
      </div>
      <small>Le code figure à côté du QR code, sous « Vérification d’authenticité », et en bas de chaque page.</small>
    </form>
  );
}

// Page publique : ouverte par le QR code d'un document officiel, ou en
// saisissant son code. Aucune connexion requise.
export default function Verifier() {
  const { code } = useParams();
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    document.title = 'Vérifier un document · EduSphere';
    setResultat(null);
    setErreur(null);
    if (!code) return;
    setChargement(true);
    client.get(`/verification/${encodeURIComponent(code)}`)
      .then((r) => setResultat(r.data))
      .catch((e) => setErreur(e.response?.status === 404
        ? 'Aucun document ne correspond à ce code. Vérifiez la saisie : un document qui ne figure pas au registre ne doit pas être considéré comme authentique.'
        : e.response?.data?.erreur || 'Vérification impossible pour le moment. Réessayez dans un instant.'))
      .finally(() => setChargement(false));
  }, [code]);

  const verdict = resultat ? verdictDe(resultat) : null;

  return (
    <div className="page-verifier">
      <header className="verif-bandeau">
        <div className="verif-bandeau-interieur">
          <Link to="/connexion" className="confidentialite-retour"><IconArrowLeft /> EduSphere</Link>
          <div className="confidentialite-marque">
            <span className="confidentialite-logo"><img src={logoIcon} alt="" /></span>
            <span>Registre des documents certifiés</span>
          </div>
          <h1>Vérifier un document</h1>
          <p>Bulletins, procès-verbaux, reçus, fiches de paie, listes et emplois du temps émis sur EduSphere portent un QR code et un code de vérification signés par la plateforme.</p>
        </div>
      </header>

      <main className="verif-corps">
        {!code && (
          <section className="verif-bloc verif-accueil">
            <span className="verif-accueil-icone"><IconQrCode /></span>
            <div>
              <h2>Scannez le QR code du document</h2>
              <p className="verif-aide">L’appareil photo de votre téléphone ouvre directement cette page. Sans téléphone, saisissez le code imprimé.</p>
              <FormulaireCode />
            </div>
          </section>
        )}

        {chargement && <div className="chargement">Consultation du registre…</div>}

        {erreur && (
          <>
            <section className="verif-verdict refus" role="status">
              <span className="verif-verdict-sceau"><IconShieldX /></span>
              <div>
                <span className="verif-verdict-code">{code}</span>
                <h2>Document introuvable</h2>
                <p>{erreur}</p>
              </div>
            </section>
            <section className="verif-bloc"><FormulaireCode initial={code} /></section>
          </>
        )}

        {resultat && verdict && (
          <>
            <section className={`verif-verdict ${verdict.classe}`} role="status">
              <span className="verif-verdict-sceau"><verdict.Icone /></span>
              <div>
                <span className="verif-verdict-code">{resultat.code}</span>
                <h2>{verdict.titre}</h2>
                <p>{verdict.texte(resultat)}</p>
              </div>
            </section>

            <article className="verif-document">
              <header className="verif-document-entete">
                {resultat.etablissement?.logo
                  ? <img className="verif-document-logo" src={resultat.etablissement.logo} alt="" />
                  : <span className="verif-document-logo sigle">{(resultat.etablissement?.sigle || 'ES').slice(0, 4)}</span>}
                <div>
                  <strong>{resultat.etablissement?.nom || 'Établissement retiré de la plateforme'}</strong>
                  {resultat.etablissement && <span>{[resultat.etablissement.ville, resultat.etablissement.pays].filter(Boolean).join(', ')}</span>}
                </div>
                <span className="verif-document-type">{resultat.libelleType}</span>
              </header>
              <h3>{resultat.titre}</h3>
              {resultat.titulaire && <p className="verif-document-titulaire">Titulaire : <strong>{resultat.titulaire}</strong></p>}
              <dl className="verif-elements">
                {resultat.elements.map(([libelle, valeur]) => (
                  <div key={libelle}><dt>{libelle}</dt><dd>{valeur}</dd></div>
                ))}
                <div><dt>Émis le</dt><dd>{dateHeure(resultat.emisLe)}</dd></div>
              </dl>
              <p className="verif-avertissement">Comparez ces informations avec le document présenté : la moindre différence signifie qu’il a été modifié.</p>
            </article>

            {resultat.empreintes?.length > 0 && <ControleFichier empreintes={resultat.empreintes} />}

            <section className="verif-bloc verif-technique">
              <h2><IconFingerprint /> Signature numérique</h2>
              <p className="verif-aide">
                Le contenu certifié est signé par EduSphere (algorithme Ed25519). {resultat.signatureValide ? 'La signature est valide.' : 'La signature ne correspond pas.'}{' '}
                <a href={`${ORIGINE_API}/api/verification/cle-publique`} target="_blank" rel="noreferrer">Clé publique de la plateforme</a>
              </p>
            </section>

            <section className="verif-bloc"><FormulaireCode /></section>
          </>
        )}
      </main>
      <footer className="confidentialite-pied">EduSphere · registre public des documents officiels</footer>
    </div>
  );
}
