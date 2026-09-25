import { useEffect, useState } from 'react';
import client from '../../api/client';
import ChiffreAnime from '../../components/ChiffreAnime';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  IconBuilding, IconGraduationCap, IconUsers, IconLock, IconMapPin, IconMail, IconRocket, IconToggle, IconMegaphone, IconWrench,
} from '../../components/icons';

const LIBELLE_SERVICE = { sendgrid: 'SendGrid', resend: 'Resend', smtp: 'SMTP' };

// Vue d'ensemble de la plateforme, jamais du contenu d'une école précise :
// des totaux additionnés sur tous les établissements affiliés, la tendance
// d'adoption dans le temps, et l'état de la configuration technique
// (envoi d'e-mail) — le pouls du système, pas le regard sur une école.
export default function TableauDeBord({ onNaviguer }) {
  const [stats, setStats] = useState(null);
  const [configEmail, setConfigEmail] = useState(null);
  const [pilotage, setPilotage] = useState({ systeme: null, fonctionnalites: null, diffusion: null });
  const [testEnCours, setTestEnCours] = useState(false);
  const [toast, setToast] = useState(null);

  function charger() {
    client.get('/superadmin/statistiques').then((res) => setStats(res.data));
    client.get('/superadmin/config-email').then((res) => setConfigEmail(res.data));
    client.get('/superadmin/systeme').then((res) => setPilotage((p) => ({ ...p, systeme: res.data }))).catch(() => {});
    client.get('/superadmin/fonctionnalites').then((res) => setPilotage((p) => ({ ...p, fonctionnalites: res.data.fonctionnalites }))).catch(() => {});
    client.get('/superadmin/diffusion').then((res) => setPilotage((p) => ({ ...p, diffusion: res.data }))).catch(() => {});
  }
  useEffect(charger, []);

  async function testerEnvoi() {
    setTestEnCours(true);
    try {
      const res = await client.post('/superadmin/email-test');
      setToast({
        message: res.data.simule
          ? `Aucun service d'envoi configuré : le test a seulement été simulé (voir les journaux du serveur).`
          : `E-mail de test envoyé à ${res.data.destinataire}.`,
        type: res.data.simule ? 'erreur' : 'succes',
      });
    } catch (err) {
      setToast({ message: messageErreur(err, "échec de l'envoi du test"), type: 'erreur' });
    } finally {
      setTestEnCours(false);
    }
  }

  const maxVille = Math.max(1, ...(stats?.repartitionParVille.map((v) => v.total) ?? [1]));
  const maxMois = Math.max(1, ...(stats?.croissance.map((m) => m.total) ?? [1]));

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Écoles affiliées</span><span className="puce-icone petite"><IconBuilding width={16} height={16} /></span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalEcoles} /> : '…'}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Écoles actives</span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalActives} /> : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Élèves (toutes écoles)</span><span className="puce-icone petite"><IconGraduationCap width={16} height={16} /></span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalEleves} /> : '…'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Professeurs (toutes écoles)</span><span className="puce-icone petite"><IconUsers width={16} height={16} /></span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalProfesseurs} /> : '…'}</div>
        </div>
        <div className={`stat-tile ${stats?.totalComptesVerrouilles > 0 ? 'tile-or' : 'tile-vert'}`}>
          <div className="stat-tile-haut"><span className="libelle">Comptes verrouillés</span><span className="puce-icone petite"><IconLock width={16} height={16} /></span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalComptesVerrouilles} /> : '…'}</div>
        </div>
      </div>

      <EtatPlateforme pilotage={pilotage} onNaviguer={onNaviguer} />

      <div className="grille-2">
        <div className="carte">
          <h2>Écoles affiliées par mois</h2>
          {!stats && <div className="chargement">Chargement…</div>}
          {stats && (
            <div className="barres-liste">
              {stats.croissance.map((m) => (
                <div className="barre-ligne" key={m.libelle}>
                  <span style={{ textTransform: 'capitalize' }}>{m.libelle}</span>
                  <div className="barre-piste">
                    <div className="barre-remplissage" style={{ width: `${(m.total / maxMois) * 100}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--police-mono)' }}>{m.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="carte">
          <div className="entete-carte">
            <h2>Répartition par ville</h2>
            <span className="puce-icone petite"><IconMapPin width={16} height={16} /></span>
          </div>
          {!stats && <div className="chargement">Chargement…</div>}
          {stats && stats.repartitionParVille.length === 0 && <div className="vide">Aucun établissement pour le moment</div>}
          {stats && stats.repartitionParVille.length > 0 && (
            <div className="barres-liste">
              {stats.repartitionParVille.map((v) => (
                <div className="barre-ligne" key={v.ville}>
                  <span>{v.ville}</span>
                  <div className="barre-piste">
                    <div className="barre-remplissage" style={{ width: `${(v.total / maxVille) * 100}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--police-mono)' }}>{v.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h2>Configuration de l'envoi d'e-mail</h2>
          <span className="puce-icone petite"><IconMail width={16} height={16} /></span>
        </div>
        <p style={{ color: 'var(--texte-clair)', fontSize: '0.85rem', marginTop: -8, marginBottom: 16 }}>
          Diagnostic technique : quel service envoie réellement les e-mails de la plateforme (codes de connexion,
          reçus, accès temporaires…). Sans aucun service configuré, EduSphere se contente de journaliser les
          e-mails côté serveur au lieu de les envoyer.
        </p>
        {!configEmail && <div className="chargement">Chargement…</div>}
        {configEmail && (
          <>
            <div className="ligne-champs" style={{ marginBottom: 16 }}>
              {['sendgrid', 'resend', 'smtp'].map((service) => (
                <div key={service} className="champ">
                  <label>{LIBELLE_SERVICE[service]}</label>
                  <span className={`badge ${configEmail[service] ? 'vert' : 'gris'}`}>
                    {configEmail[service] ? 'configuré' : 'absent'}
                  </span>
                </div>
              ))}
            </div>
            <p className="note-secondaire" style={{ marginBottom: 14 }}>
              {configEmail.actif
                ? <>Service actif : <strong>{LIBELLE_SERVICE[configEmail.actif]}</strong> (ordre de priorité SendGrid → Resend → SMTP).</>
                : 'Aucun service configuré actuellement : les e-mails sont uniquement simulés (journal serveur).'}
            </p>
            <button className="secondaire" onClick={testerEnvoi} disabled={testEnCours}>
              {testEnCours ? 'Envoi du test…' : "Tester l'envoi (vers mon adresse)"}
            </button>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onFermer={() => setToast(null)} />}
    </div>
  );
}

// Où en est la plateforme en un coup d'œil (version, modules, annonce,
// maintenance), chaque case menant à la page qui permet d'agir dessus.
function EtatPlateforme({ pilotage, onNaviguer }) {
  const { systeme, fonctionnalites, diffusion } = pilotage;
  const ouvertes = fonctionnalites?.filter((f) => f.portee === 'toutes').length ?? 0;
  const pilotes = fonctionnalites?.filter((f) => f.portee === 'selection').length ?? 0;
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
      valeur: fonctionnalites ? `${ouvertes} sur ${fonctionnalites.length}` : '…',
      detail: fonctionnalites ? (pilotes ? `ouvertes partout, ${pilotes} en pilote` : 'ouvertes à toutes les écoles') : '',
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
