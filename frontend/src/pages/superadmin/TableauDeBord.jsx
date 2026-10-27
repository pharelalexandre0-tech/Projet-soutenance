import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import ChiffreAnime from '../../components/ChiffreAnime';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { messageErreur } from '../../utils/erreurs';
import { depuis } from '../../utils/plateforme';
import {
  IconBuilding, IconGraduationCap, IconUsers, IconLock, IconMail, IconRocket, IconToggle, IconMegaphone, IconWrench,
  IconPlus, IconChevronRight, IconAlertTriangle, IconCircleCheck,
} from '../../components/icons';

// Gmail et Resend : services abandonnés, gardés pour les anciens envois du
// journal.
const LIBELLE_SERVICE = { brevo: 'Brevo', sendgrid: 'SendGrid', smtp: 'SMTP', gmail: 'Gmail', resend: 'Resend' };
const TRENTE_JOURS = 30 * 24 * 3600 * 1000;

function salutation() {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
}

// Console de la plateforme : son état en une phrase, les actions courantes,
// ce qui demande de l'attention, l'activité des écoles et la santé de
// l'envoi d'e-mail. Des totaux de plateforme, jamais le contenu d'une école.
export default function TableauDeBord({ onNaviguer }) {
  const { profil } = useAuth();
  const [stats, setStats] = useState(null);
  const [ecoles, setEcoles] = useState(null);
  const [configEmail, setConfigEmail] = useState(null);
  const [pilotage, setPilotage] = useState({ systeme: null, fonctionnalites: null, diffusion: null });
  const [testEnCours, setTestEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/superadmin/statistiques').then((res) => setStats(res.data));
    client.get('/superadmin/etablissements').then((res) => setEcoles(res.data.etablissements)).catch(() => setEcoles([]));
    client.get('/superadmin/config-email').then((res) => setConfigEmail(res.data));
    client.get('/superadmin/systeme').then((res) => setPilotage((p) => ({ ...p, systeme: res.data }))).catch(() => {});
    client.get('/superadmin/fonctionnalites').then((res) => setPilotage((p) => ({ ...p, fonctionnalites: res.data.fonctionnalites }))).catch(() => {});
    client.get('/superadmin/diffusion').then((res) => setPilotage((p) => ({ ...p, diffusion: res.data }))).catch(() => {});
  }
  useEffect(charger, []);
  useActualisation(charger, { delai: 1500 });

  async function testerEnvoi() {
    setTestEnCours(true);
    try {
      const res = await client.post('/superadmin/email-test');
      const echecs = (res.data.erreurs || []).map((e) => LIBELLE_SERVICE[e.service] || e.service);
      let message;
      if (!res.data.simule) {
        message = `E-mail de test envoyé à ${res.data.destinataire} via ${LIBELLE_SERVICE[res.data.service] || res.data.service}`
          + (echecs.length ? ` (après l'échec de ${echecs.join(', ')}).` : '.');
      } else if (echecs.length) {
        message = `L'e-mail n'est pas parti : ${echecs.join(', ')} a refusé l'envoi. Le détail est dans « Derniers envois ».`;
      } else {
        message = "Aucun service d'envoi configuré : le test a seulement été simulé.";
      }
      setToast({ message, type: res.data.simule ? 'erreur' : 'succes' });
      client.get('/superadmin/config-email').then((r) => setConfigEmail(r.data)).catch(() => {});
    } catch (err) {
      setToast({ message: messageErreur(err, "échec de l'envoi du test"), type: 'erreur' });
    } finally {
      setTestEnCours(false);
    }
  }

  const { systeme, diffusion } = pilotage;
  const maintenance = diffusion?.maintenance?.actif;
  const annonce = diffusion?.annonce?.actif;
  const maxVille = Math.max(1, ...(stats?.repartitionParVille.map((v) => v.total) ?? [1]));
  const maxMois = Math.max(1, ...(stats?.croissance.map((m) => m.total) ?? [1]));
  const totalSurPeriode = stats?.croissance.reduce((somme, m) => somme + m.total, 0) ?? 0;

  // Ce qui demande une action du superadmin.
  const vigilance = [];
  if (maintenance) vigilance.push({ ton: 'alerte', texte: 'La plateforme est en maintenance : les écoles n’y ont pas accès.', page: 'annonces', action: 'Gérer' });
  (ecoles || []).filter((e) => e.statut !== 'actif').forEach((e) => vigilance.push({ ton: 'alerte', texte: `${e.nom} est verrouillée.`, page: 'etablissements', action: 'Ouvrir' }));
  (ecoles || []).filter((e) => e.nbComptesVerrouilles > 0).forEach((e) => vigilance.push({ ton: 'attention', texte: `${e.nom} : ${e.nbComptesVerrouilles} compte(s) verrouillé(s).`, page: 'etablissements', action: 'Voir' }));
  (ecoles || []).filter((e) => e.statut === 'actif' && (!e.derniereConnexion || Date.now() - new Date(e.derniereConnexion).getTime() > TRENTE_JOURS))
    .forEach((e) => vigilance.push({ ton: 'info', texte: `${e.nom} : aucune connexion depuis plus de 30 jours.`, page: 'etablissements', action: 'Voir' }));
  const echecsEmail = (configEmail?.derniersEnvois || []).filter((e) => !e.envoye && e.erreurs.length).length;
  if (configEmail && !configEmail.actif) vigilance.push({ ton: 'alerte', texte: 'Aucun service d’e-mail configuré : les codes de connexion ne partent pas.', action: null });
  else if (echecsEmail) vigilance.push({ ton: 'attention', texte: `${echecsEmail} e-mail(s) récent(s) non envoyé(s).`, action: null });

  const recentes = [...(ecoles || [])].sort((a, b) => new Date(b.derniereConnexion || 0) - new Date(a.derniereConnexion || 0)).slice(0, 5);
  const totalComptes = (ecoles || []).reduce((s, e) => s + e.nbComptes, 0);

  return (
    <div className="console-plateforme">
      <section className="console-entete">
        <div>
          <p className="console-date">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2>{salutation()} {profil?.prenom}.</h2>
          <p className="console-etat">
            <span className={`point-etat ${maintenance ? 'alerte' : 'ok'}`} aria-hidden="true" />
            {diffusion ? (maintenance ? 'Plateforme en maintenance' : 'Plateforme ouverte, tous les accès fonctionnent') : 'Lecture de l’état…'}
            {systeme && <span className="console-version"> · version {systeme.version}{systeme.commit ? ` (${systeme.commit})` : ''}</span>}
          </p>
        </div>
        <div className="console-actions">
          <button type="button" className="primaire" onClick={() => onNaviguer?.('etablissements')}><IconPlus /> Affilier une école</button>
          <button type="button" className="secondaire" onClick={() => onNaviguer?.('annonces')}><IconMegaphone /> {annonce ? 'Annonce en ligne' : 'Publier une annonce'}</button>
          <button type="button" className="secondaire" onClick={() => onNaviguer?.('annonces')}><IconWrench /> Maintenance</button>
        </div>
      </section>

      <dl className="console-chiffres">
        <div><dt><IconBuilding aria-hidden="true" /> Écoles affiliées</dt><dd>{stats ? <ChiffreAnime valeur={stats.totalEcoles} /> : '…'}</dd><small>{stats ? `${stats.totalActives} active${stats.totalActives > 1 ? 's' : ''}` : ''}</small></div>
        <div><dt><IconGraduationCap aria-hidden="true" /> Étudiants</dt><dd>{stats ? <ChiffreAnime valeur={stats.totalEleves} /> : '…'}</dd><small>toutes écoles confondues</small></div>
        <div><dt><IconUsers aria-hidden="true" /> Professeurs</dt><dd>{stats ? <ChiffreAnime valeur={stats.totalProfesseurs} /> : '…'}</dd><small>{ecoles ? `${totalComptes} comptes au total` : ''}</small></div>
        <div className={stats?.totalComptesVerrouilles ? 'attention' : ''}><dt><IconLock aria-hidden="true" /> Comptes verrouillés</dt><dd>{stats ? <ChiffreAnime valeur={stats.totalComptesVerrouilles} /> : '…'}</dd><small>{stats?.totalComptesVerrouilles ? 'à vérifier' : 'aucun blocage'}</small></div>
      </dl>

      <div className="console-grille">
        <section className="carte">
          <div className="entete-carte"><h2>À surveiller</h2>{ecoles && <span className={`badge ${vigilance.length ? 'or' : 'vert'}`}>{vigilance.length ? `${vigilance.length} point${vigilance.length > 1 ? 's' : ''}` : 'Rien à signaler'}</span>}</div>
          {!ecoles && <div className="chargement">Chargement…</div>}
          {ecoles && vigilance.length === 0 && (
            <p className="console-calme"><IconCircleCheck aria-hidden="true" /> Toutes les écoles sont actives, aucun compte n’est bloqué et l’envoi d’e-mail fonctionne.</p>
          )}
          <ul className="liste-vigilance">
            {vigilance.slice(0, 8).map((v) => (
              <li key={v.texte} className={`ton-${v.ton}`}>
                <IconAlertTriangle aria-hidden="true" />
                <span>{v.texte}</span>
                {v.action && v.page && <button type="button" className="bouton-texte" onClick={() => onNaviguer?.(v.page)}>{v.action} <IconChevronRight /></button>}
              </li>
            ))}
          </ul>
        </section>

        <section className="carte">
          <div className="entete-carte">
            <h2>Activité des écoles</h2>
            <button type="button" className="bouton-texte" onClick={() => onNaviguer?.('etablissements')}>Toutes les écoles <IconChevronRight /></button>
          </div>
          {!ecoles && <div className="chargement">Chargement…</div>}
          {ecoles && ecoles.length === 0 && <div className="vide">Aucune école affiliée pour le moment.</div>}
          <ul className="liste-activite-ecoles">
            {recentes.map((e) => (
              <li key={e.id}>
                <span className="vignette-logo">{e.logo ? <img src={e.logo} alt="" /> : <IconBuilding />}</span>
                <span className="activite-ecole-texte"><strong>{e.nom}</strong><small>{e.nbComptes} comptes · {e.nbFonctionnalites} modules</small></span>
                <span className="activite-ecole-quand">{e.derniereConnexion ? depuis(e.derniereConnexion) : 'jamais connectée'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <EtatPlateforme pilotage={pilotage} onNaviguer={onNaviguer} />

      <div className="console-grille">
        <div className="carte carte-histogramme">
          <h2>Écoles affiliées par mois</h2>
          {!stats && <div className="chargement">Chargement…</div>}
          {stats && (
            <>
              <div className="histogramme" role="list">
                {stats.croissance.map((m) => (
                  <div className="histogramme-colonne" key={m.libelle} role="listitem" aria-label={`${m.libelle} : ${m.total}`}>
                    <strong className={m.total ? '' : 'nul'}>{m.total}</strong>
                    <div className="histogramme-piste">
                      <div className="histogramme-barre" style={{ height: `${m.total ? Math.max(6, (m.total / maxMois) * 100) : 0}%` }} />
                    </div>
                    <span>{m.libelle}</span>
                  </div>
                ))}
              </div>
              <p className="pied-carte">
                {totalSurPeriode} école{totalSurPeriode > 1 ? 's' : ''} affiliée{totalSurPeriode > 1 ? 's' : ''} sur les six derniers mois,
                {' '}{stats.totalEcoles} au total.
              </p>
            </>
          )}
          {stats && stats.repartitionParVille.length > 0 && (
            <>
              <h3 className="sous-titre-carte">Répartition par ville</h3>
              <div className="barres-liste">
                {stats.repartitionParVille.map((v) => (
                  <div className="barre-ligne" key={v.ville}>
                    <span>{v.ville}</span>
                    <div className="barre-piste"><div className="barre-remplissage" style={{ width: `${(v.total / maxVille) * 100}%` }} /></div>
                    <span>{v.total}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="carte">
          <div className="entete-carte">
            <h2>Envoi d'e-mail</h2>
            <span className="puce-icone petite"><IconMail /></span>
          </div>
          {!configEmail && <div className="chargement">Chargement…</div>}
          {configEmail && (
            <>
              <ul className="liste-services">
                {['brevo', 'sendgrid', 'smtp'].map((service) => (
                  <li key={service}>
                    <span>
                      {LIBELLE_SERVICE[service]}
                      {configEmail.actif === service && <small> · service utilisé</small>}
                    </span>
                    <span className={`badge ${configEmail[service] ? 'vert' : 'gris'}`}>
                      {configEmail[service] ? 'Configuré' : 'Absent'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="note-secondaire" style={{ margin: '14px 0', fontSize: 14 }}>
                {configEmail.actif
                  ? "Les codes de connexion, reçus et accès temporaires partent réellement par e-mail (priorité Brevo, puis SendGrid et SMTP). Brevo authentifie lui-même les envois, ce qui les tient à l'écart des courriers indésirables."
                  : 'Aucun service configuré : les e-mails sont seulement écrits dans le journal du serveur.'}
              </p>
              <button className="secondaire" onClick={testerEnvoi} disabled={testEnCours}>
                <IconMail /> {testEnCours ? 'Envoi du test…' : "Tester l'envoi vers mon adresse"}
              </button>
              <h3 className="tiroir-section-titre" style={{ margin: '22px 0 0' }}>Derniers envois</h3>
              {(configEmail.derniersEnvois || []).length === 0 && (
                <p className="note-secondaire" style={{ margin: '8px 0 0', fontSize: 14 }}>Aucun envoi depuis le dernier redémarrage du serveur.</p>
              )}
              {(configEmail.derniersEnvois || []).length > 0 && (
                <ul className="liste-envois">
                  {configEmail.derniersEnvois.slice(0, 6).map((envoi) => (
                    <li key={`${envoi.le}-${envoi.sujet}`}>
                      <div>
                        <strong>{envoi.sujet}</strong>
                        <small>{envoi.destinataire} · {new Date(envoi.le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                        {envoi.erreurs.map((e) => (
                          <small key={e.service} className="erreur-envoi">{LIBELLE_SERVICE[e.service] || e.service} : {e.message}</small>
                        ))}
                      </div>
                      <span className={`badge ${envoi.envoye ? 'vert' : envoi.erreurs.length ? 'rouge' : 'gris'}`}>
                        {envoi.envoye ? `Envoyé (${LIBELLE_SERVICE[envoi.service]})` : envoi.erreurs.length ? 'Non envoyé' : 'Simulé'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

// Où en est la plateforme en un coup d'œil (version, modules, annonce,
// maintenance), chaque case menant à la page qui permet d'agir dessus.
function EtatPlateforme({ pilotage, onNaviguer }) {
  const { systeme, fonctionnalites, diffusion } = pilotage;
  const personnalisees = fonctionnalites?.filter((f) => !f.integree).length ?? 0;
  const attributions = fonctionnalites?.reduce((s, f) => s + f.ecoles.length, 0) ?? 0;
  const maintenance = diffusion?.maintenance?.actif;
  const annonce = diffusion?.annonce?.actif;

  const cases = [
    {
      id: 'mises-a-jour', icone: IconRocket, libelle: 'Version en production',
      valeur: systeme ? `v${systeme.version}` : '…',
      detail: systeme?.commit ? `Commit ${systeme.commit}` : 'Voir les notes de version',
    },
    {
      id: 'fonctionnalites', icone: IconToggle, libelle: 'Fonctionnalités',
      valeur: fonctionnalites ? `${fonctionnalites.length} au catalogue` : '…',
      detail: fonctionnalites
        ? (personnalisees ? `dont ${personnalisees} personnalisée${personnalisees > 1 ? 's' : ''}` : `${attributions} attribution${attributions > 1 ? 's' : ''} aux écoles`)
        : '',
    },
    {
      id: 'annonces', icone: IconMegaphone, libelle: 'Annonce',
      valeur: diffusion ? (annonce ? 'En ligne' : 'Aucune') : '…',
      detail: annonce ? diffusion.annonce.message : 'Informer toutes les écoles',
      ton: annonce ? 'info' : '',
    },
    {
      id: 'annonces', icone: IconWrench, libelle: 'Maintenance',
      valeur: diffusion ? (maintenance ? 'En cours' : 'Plateforme ouverte') : '…',
      detail: maintenance ? 'Accès des écoles suspendu' : 'Tous les accès fonctionnent',
      ton: maintenance ? 'alerte' : 'ok',
    },
  ];

  return (
    <div className="etat-plateforme">
      {cases.map((c) => {
        const Icone = c.icone;
        return (
          <button key={c.libelle} type="button" className={`etat-plateforme-case ${c.ton ? `ton-${c.ton}` : ''}`} onClick={() => onNaviguer?.(c.id)}>
            <span className="puce-icone petite"><Icone width={15} height={15} /></span>
            <span className="etat-plateforme-libelle">{c.libelle}</span>
            <strong>{c.valeur}</strong>
            <small>{c.detail}</small>
          </button>
        );
      })}
    </div>
  );
}
