import { useEffect, useState } from 'react';
import client from '../../api/client';
import useActualisation from '../../hooks/useActualisation';
import ChiffreAnime from '../../components/ChiffreAnime';
import Toast from '../../components/Toast';
import { messageErreur } from '../../utils/erreurs';
import {
  IconBuilding, IconGraduationCap, IconUsers, IconLock, IconMapPin, IconMail, IconRocket, IconToggle, IconMegaphone, IconWrench,
  IconCircleCheck,
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

  const maxVille = Math.max(1, ...(stats?.repartitionParVille.map((v) => v.total) ?? [1]));
  const maxMois = Math.max(1, ...(stats?.croissance.map((m) => m.total) ?? [1]));
  const totalSurPeriode = stats?.croissance.reduce((somme, m) => somme + m.total, 0) ?? 0;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-haut"><span className="libelle">Écoles affiliées</span><span className="puce-icone petite"><IconBuilding width={16} height={16} /></span></div>
          <div className="valeur">{stats ? <ChiffreAnime valeur={stats.totalEcoles} /> : '…'}</div>
        </div>
        <div className="stat-tile tile-vert">
          <div className="stat-tile-haut"><span className="libelle">Écoles actives</span><span className="puce-icone petite"><IconCircleCheck /></span></div>
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
        <div className="carte carte-etiree">
          <h2>Écoles affiliées par mois</h2>
          {!stats && <div className="chargement">Chargement…</div>}
          {stats && (
            <>
              <div className="barres-liste">
                {stats.croissance.map((m) => (
                  <div className="barre-ligne" key={m.libelle}>
                    <span style={{ textTransform: 'capitalize' }}>{m.libelle}</span>
                    <div className="barre-piste">
                      <div className="barre-remplissage" style={{ width: `${(m.total / maxMois) * 100}%` }} />
                    </div>
                    <span>{m.total}</span>
                  </div>
                ))}
              </div>
              <p className="pied-carte">
                {totalSurPeriode} école{totalSurPeriode > 1 ? 's' : ''} affiliée{totalSurPeriode > 1 ? 's' : ''} sur les six derniers mois,
                {' '}{stats.totalEcoles} au total.
              </p>
            </>
          )}
        </div>

        <div className="colonne-empilee">
          <div className="carte">
            <div className="entete-carte">
              <h2>Répartition par ville</h2>
              <span className="puce-icone petite"><IconMapPin /></span>
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
                    <span>{v.total}</span>
                  </div>
                ))}
              </div>
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
                  {['sendgrid', 'resend', 'smtp'].map((service) => (
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
                    ? 'Les codes de connexion, reçus et accès temporaires partent réellement par e-mail (priorité SendGrid, puis Resend, puis SMTP).'
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
