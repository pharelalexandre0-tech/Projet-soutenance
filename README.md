# EduSphere : plateforme de gestion scolaire multi-établissements

EduSphere réunit la vie d'un établissement d'enseignement supérieur : inscriptions et
matricules, notes et bulletins (règles LMD), absences, comportement, emplois du temps,
frais de scolarité et reçus, paie du personnel, communication avec les familles et
détection précoce du décrochage par apprentissage automatique. Chaque école a ses propres
données, totalement isolées des autres ; un superadmin pilote la plateforme sans jamais
voir le contenu des écoles.

Stack : **Node.js + Express** (API), **PostgreSQL + Sequelize** (toutes les données, y
compris les PDF, le journal des e-mails et les modèles d'IA), **React + Vite** (interface).

## 1. Les espaces

| Espace | Qui | Ce qu'on y fait |
|---|---|---|
| Superadmin | Équipe EduSphere | Écoles affiliées, fonctionnalités ouvertes école par école, fonctionnalités sans code, notes de version, annonces et maintenance, journal. |
| Académie | Scolarité de l'école | Classes et élèves (matricule automatique), UE et matières, notes, bulletins, emplois du temps publiés, feuilles d'appel, comportement, alertes de décrochage, accès temporaires des professeurs, communication. |
| Finance | Service financier | Frais par classe, paiements et reçus PDF, impayés et relances, paie du personnel (les professeurs y figurent d'office) et fiches de paie. |
| Étudiant / Parents | L'élève et sa famille | Bulletin, relevé de notes, absences et justificatifs, comportement, emploi du temps, frais et reçus, messages, notifications. |
| Professeur | Sans compte | Un lien personnel à durée limitée, reçu par e-mail, pour saisir des notes ou faire l'appel ; il se ferme dès l'envoi. |

**Parents.** Le parent n'a pas de compte à lui : son adresse e-mail est rattachée à
l'élève (fiche élève, inscription ou import Excel). Il se connecte au compte de son enfant
avec **sa propre adresse** et **le même mot de passe, le matricule** ; le code de double
authentification lui est envoyé à lui. L'interface devient alors l'« Espace Parents ». Les
e-mails de l'établissement (absences, bulletins, reçus, relances, signalements, emploi du
temps, messages) partent à l'élève et à son parent.

**Matricule.** Attribué à l'inscription (ex. `IDE-2A-0061` : sigle de l'école, code de
deux caractères, numéro d'ordre), il sert de mot de passe et ne se modifie pas.

**Mise à jour en direct.** Toute modification enregistrée (inscription, note, absence,
paiement, publication, signalement...) est signalée aux écrans ouverts de la même école,
qui rechargent leurs données aussitôt, sans recherche ni changement d'onglet. Le serveur
diffuse ces signaux par un flux SSE (`/api/evenements`) ; ils transitent par PostgreSQL
(`NOTIFY` / `LISTEN`), si bien que les scripts planifiés en produisent aussi. Un signal ne
contient jamais de donnée scolaire, seulement l'école et le domaine touchés.

**Alertes de décrochage.** Onze signaux précoces par élève (notes de contrôle continu,
assiduité, comportement, paiements). Une forêt aléatoire et une régression logistique sont
entraînées et comparées par validation croisée (AUC) ; la meilleure est retenue, évaluée
sur un jeu de test et enregistrée, versionnée, dans PostgreSQL (`modeles_ia`). Chaque
score est expliqué par les signaux qui le font monter.

## 2. Installation locale

Prérequis : Node.js 18 ou plus, PostgreSQL 14 ou plus.

```bash
createdb plateforme_scolaire
```

### Backend

```bash
cd backend
cp .env.example .env        # adapter DATABASE_URL si besoin
npm install
npm run dev                 # crée ou met à jour les tables, puis écoute sur le port 4000
```

Premier démarrage d'une base vide : créer le compte superadmin (non destructif, sans effet
s'il en existe déjà un), puis, si besoin, l'école de démonstration.

```bash
SUPERADMIN_EMAIL=vous@exemple.com SUPERADMIN_MOT_DE_PASSE='un-mot-de-passe-solide' npm run init:superadmin
npm run seed:demo           # école « IDE » : 60 élèves, notes, absences, frais, paie...
```

Les comptes de démonstration sont affichés à la fin de `seed:demo` (Académie et Finance :
`academie@ide.example.com`, `finance@ide.example.com` ; élèves : leur matricule ;
parents : leur adresse et le matricule de l'enfant).

Sans configuration d'envoi (voir `.env.example` : SendGrid, Resend ou SMTP), les e-mails
sont simulés et restent visibles dans le journal des e-mails du superadmin.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (relaie /api vers le port 4000)
```

### Scripts utiles (backend)

| Commande | Rôle |
|---|---|
| `npm run init:superadmin` | Crée le premier superadmin d'une installation neuve. |
| `npm run seed:demo` | Ajoute l'école de démonstration (sans toucher aux autres). |
| `npm run check:impayes` | Marque les frais échus et prévient les familles (tâche quotidienne). |
| `npm run check:prediction` | Recalcule le risque de décrochage de chaque école (tâche périodique). |
| `npm run train:risque` | Réentraîne le modèle de prédiction (aussi possible depuis l'Académie). |
| `npm run backup` | Sauvegarde complète de la base (toutes les tables, PDF et mots de passe hachés compris). |
| `npm run restore` | Recharge une sauvegarde dans une autre base (changement d'hébergeur, voir section 5). |

## 3. Où trouver quoi

| Sujet | Code |
|---|---|
| Rôles et accès | `backend/src/middlewares/auth.js` (`authentifier`, `autoriserRoles`, session parent) |
| Connexion, double authentification, parents | `controllers/authController.js`, `services/familleService.js` |
| Élèves, classes, matricule | `controllers/referenceController.js`, `services/matriculeService.js` |
| Accès temporaires des professeurs | `controllers/comptesEphemeresController.js`, `middlewares/ephemeralAuth.js`, `frontend/src/pages/AccesTemporaire.jsx` |
| Moyennes et bulletin (LMD) | `services/moyenneService.js`, `controllers/bulletinController.js`, `services/pdfService.js` |
| Absences, comportement | `controllers/absencesController.js`, `controllers/incidentsController.js` |
| Frais, reçus, impayés, paie | `controllers/financeController.js`, `controllers/personnelController.js`, `services/impayesService.js` |
| Prédiction du décrochage | `services/ia/` (signaux, algorithmes, entraînement), `services/riskService.js` |
| Mise à jour en direct | `services/evenementsService.js`, `routes/evenements.js`, `frontend/src/api/tempsReel.js`, `frontend/src/hooks/useActualisation.js` |
| E-mails | `services/emailService.js`, `services/modelesEmail.js` |
| Pilotage de la plateforme | `controllers/superadminController.js`, `controllers/pilotageController.js`, `controllers/fonctionnalitesController.js` |

Au démarrage, `server.js` applique les migrations (dont le passage des anciens comptes
parents à l'adresse rattachée à l'élève), synchronise les tables, puis prépare les données
dérivées (matricules manquants, publications, comptes rendus, paie, modèle d'IA).

## 4. Déploiement (Docker, Render)

`backend/Dockerfile` construit l'API ; `frontend/Dockerfile` construit l'interface, servie
par nginx qui relaie aussi `/api` et `/fichiers` vers l'API (flux `/api/evenements` sans
tampon). `render.yaml` décrit la base PostgreSQL et les deux services.

En local avec Docker : `docker compose up --build`, puis http://localhost:8080 et
`docker compose exec backend npm run init:superadmin` (avec les variables `SUPERADMIN_*`).

Sur Render : créer le Blueprint depuis le dépôt, renseigner les variables marquées
`sync: false` (clé d'envoi d'e-mails, `EPHEMERE_LIEN_BASE_URL`), puis lancer
`init:superadmin` une fois avec l'URL externe de la base. Les PDF sont stockés dans
PostgreSQL : un redémarrage ne les perd pas. Le plan gratuit met les services en veille
après 15 minutes sans trafic (le workflow `.github/workflows/keep-alive.yml` les réveille).

## 5. Changer d'hébergeur sans rien perdre

Le code est entièrement dans ce dépôt ; **les données, elles, sont dans la base
PostgreSQL de l'hébergeur** (écoles, élèves, notes, paiements, PDF, modèle d'IA). Une base
PostgreSQL gratuite peut expirer : sauvegarde-la régulièrement.

1. **Sauvegarder** la base actuelle (depuis `backend/`, avec son adresse externe, sur Render :
   page de la base > Connect > External Database URL) :
   ```bash
   DATABASE_URL="<adresse externe de la base actuelle>" npm run backup
   ```
   Le fichier est écrit dans `backend/storage/sauvegardes/` (jamais envoyé sur GitHub).
   Copie-le en lieu sûr : il contient toutes les données, mots de passe hachés compris.
2. **Déployer** sur le nouvel hébergeur les deux conteneurs (`backend/Dockerfile`,
   `frontend/Dockerfile`) et une base PostgreSQL, avec ces variables :
   - backend : `DATABASE_URL`, `JWT_SECRET` (nouvelle valeur au hasard), `FRONTEND_URL` et
     `BACKEND_URL` (adresses publiques des deux services), la clé d'envoi d'e-mails
     (`SENDGRID_API_KEY` et `SENDGRID_FROM`, ou `RESEND_*`, ou `SMTP_*`) ;
   - frontend : `BACKEND_SCHEME` (`https`) et `BACKEND_HOST` (nom d'hôte du backend).
3. **Démarrer une fois** le backend (il crée les tables), puis **restaurer** :
   ```bash
   DATABASE_URL="<adresse de la nouvelle base>" npm run restore -- chemin/vers/sauvegarde.json --remplacer
   ```
   et redémarrer le backend. Tout est restauré à l'identique ; chacun devra seulement se
   reconnecter (nouvelle clé `JWT_SECRET`).
4. Pour le réveil automatique, renseigner sur GitHub les variables du dépôt `URL_BACKEND`
   et `URL_FRONTEND` (Settings > Secrets and variables > Actions > Variables).

Autre possibilité, avec les outils PostgreSQL : `pg_dump -Fc "<ancienne base>" -f edusphere.dump`
puis `pg_restore --no-owner -d "<nouvelle base>" edusphere.dump`.
