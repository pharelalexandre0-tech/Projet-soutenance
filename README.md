# Plateforme de Gestion Scolaire — Espace Établissement / Espace Étudiant

Implémentation (backend + frontend) des 9 diagrammes UML du dossier de conception
(*Diagrammes_UML_Plateforme_Scolaire.pdf*) : cas d'utilisation, classes, et les flux
détaillés en séquence/activité (authentification, saisie des notes via compte
éphémère, bulletin, absences, paiement, impayés, prédiction IA).

Stack : **Node.js + Express** (API) / **PostgreSQL + Sequelize** (données) /
**React + Vite** (interface).

## 1. Prérequis

- Node.js 18+ et npm
- PostgreSQL 14+ installé et démarré localement

## 2. Mise en route

### Base de données

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE plateforme_scolaire;"
```

(Adapte `DATABASE_URL` dans `backend/.env` si tu utilises un autre utilisateur/mot de passe.)

### Backend

```bash
cd backend
cp .env.example .env      # déjà fourni avec des valeurs de dev fonctionnelles
npm install
npm run seed               # crée les tables (sync) + des données de démonstration
npm run dev                 # démarre l'API sur http://localhost:4000
```

Comptes créés par le seed (mot de passe pour tous : `password123`) :

| Rôle     | E-mail                  |
|----------|--------------------------|
| Académie | academie@ecole.ga       |
| Finance  | finance@ecole.ga        |
| Étudiant | alexandrepharel0+etudiant1@gmail.com |
| Étudiant | alexandrepharel0+etudiant2@gmail.com |

Le rôle Étudiant demande en plus un code à 6 chiffres envoyé par e-mail
(double authentification) — les adresses ci-dessus utilisent l'alias `+`
Gmail pour livrer ces codes dans une seule vraie boîte, testable en démo.

Le Professeur (Charly Obame) n'a volontairement pas de mot de passe : conforme au
diagramme de cas d'utilisation, il n'accède à la plateforme que via un lien
d'accès temporaire généré par l'Académie (onglet *Comptes éphémères*).

### Frontend

```bash
cd frontend
npm install
npm run dev                 # démarre l'interface sur http://localhost:5173
```

Ouvre `http://localhost:5173`, connecte-toi avec un des comptes ci-dessus.

### Tâches planifiées (à automatiser en production, ex. cron)

```bash
cd backend
npm run check:impayes       # diagramme 9 : marque les frais en retard + notifie
npm run check:prediction    # diagramme 7 : lance l'analyse de risque IA
```

## 3. Où trouver quoi (correspondance avec les diagrammes)

| Diagramme UML | Code |
|---|---|
| 1. Cas d'utilisation global | `backend/src/routes/*`, séparation des rôles dans `middlewares/auth.js` (`autoriserRoles`) |
| 2. Classes (modèle de domaine) | `backend/src/models/*` + associations dans `models/index.js` |
| 3. Authentification | `controllers/authController.js`, `middlewares/auth.js` |
| 4. Saisie des notes via compte éphémère | `models/CompteEphemere.js`, `middlewares/ephemeralAuth.js`, `controllers/comptesEphemeresController.js`, page `frontend/src/pages/AccesTemporaire.jsx` |
| 5. Bulletin scolaire | `services/moyenneService.js`, `services/pdfService.js`, `controllers/bulletinController.js` |
| 6. Gestion des absences | `controllers/absencesController.js` |
| 7. Prédiction IA | `services/riskService.js` (heuristique explicable, volontairement pas un vrai modèle ML entraîné), `controllers/predictionController.js`, `scripts/runPrediction.js` |
| 8. Paiement des frais | `controllers/financeController.js` (`enregistrerPaiement`), `services/pdfService.js` (reçu) |
| 9. Suivi des impayés | `services/impayesService.js`, `scripts/checkImpayes.js` |

## 4. Choix d'implémentation à connaître pour la soutenance

- **Professeur sans compte permanent** : modélisé comme une fiche (`Professeur`)
  sans mot de passe. L'accès passe uniquement par `CompteEphemere` (jeton aléatoire,
  portée classe+UE+évaluation, expiration, révocation automatique après usage).
- **Séparation Académie / Finance** : appliquée au niveau des routes via le
  middleware `autoriserRoles`, pas seulement dans l'interface — un token JWT
  Finance ne peut pas appeler les routes notes/absences, et inversement.
- **Le mot de passe n'est jamais renvoyé** dans les réponses JSON, y compris via
  les relations imbriquées (`scope` Sequelize par défaut sur `Utilisateur`).
- **Prédiction IA** : heuristique simple et explicable (moyenne des notes +
  absences non justifiées) plutôt qu'un modèle de machine learning entraîné —
  choix assumé et à justifier ainsi à l'oral : un prototype de soutenance n'a pas
  besoin d'un vrai modèle pour démontrer l'architecture et le flux (collecte →
  score → seuil → alerte → décision humaine).
- **E-mails** : envoyés pour de vrai via SMTP (`services/emailService.js`,
  `nodemailer`) dès que les variables `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
  sont renseignées (voir `.env.example` pour un compte Gmail gratuit) ;
  sans elles, simulation par `console.log` pour ne pas dépendre
  d'identifiants externes en dev local.

## 5. Déploiement (Docker + Render, gratuit)

Le projet est dockerisé : `backend/Dockerfile` (API Node) et `frontend/Dockerfile`
(build Vite servi par Nginx, qui fait aussi office de reverse proxy vers l'API —
le code frontend appelle toujours `/api` en relatif, sans rien à changer).

### 5.1 Tester en local avec Docker (optionnel)

Si Docker Desktop est installé :

```bash
docker compose up --build
```

Puis ouvrir `http://localhost:8080`. `docker-compose.yml` lance PostgreSQL, l'API
et le frontend ensemble. La base est vide au premier lancement : lancer le seed
une fois les conteneurs démarrés :

```bash
docker compose exec backend npm run seed
```

### 5.2 Mettre en ligne gratuitement sur Render

Render construit lui-même les images à partir des `Dockerfile` — Docker n'a pas
besoin d'être installé sur ta machine pour déployer, seulement pour tester en local.

1. **Pousser le projet sur GitHub** (dépôt public ou privé) :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <URL_DU_DEPOT_GITHUB>
   git push -u origin main
   ```
2. Créer un compte sur [render.com](https://render.com) (gratuit, connexion possible
   via GitHub).
3. Dans le dashboard Render : **New +** → **Blueprint**, choisir le dépôt GitHub —
   Render détecte automatiquement `render.yaml` à la racine et propose de créer
   les 3 ressources : `edusphere-db` (Postgres gratuit), `edusphere-backend` et
   `edusphere-frontend` (services Docker gratuits). Cliquer **Apply**.
4. Le premier déploiement prend quelques minutes (build des images). Une fois les
   deux services "Live" :
   - noter l'URL publique de `edusphere-frontend` (ex.
     `https://edusphere-frontend.onrender.com`) ;
   - si Render a dû renommer `edusphere-backend` (nom déjà pris ailleurs sur
     Render), ouvrir le service `edusphere-frontend` → **Environment** → corriger
     la variable `BACKEND_HOST` avec le vrai nom d'hôte, puis **Manual Deploy**.
   - ouvrir le service `edusphere-backend` → **Environment** → renseigner
     `EPHEMERE_LIEN_BASE_URL` avec `https://<url-du-frontend>/acces-temporaire`,
     puis sauvegarder (redéploie automatiquement).
5. **Créer les données de démonstration** : la base Postgres gratuite reste
   vide tant qu'on ne lance pas le seed. Depuis ta machine, avec l'"External
   Database URL" affichée dans le dashboard Render (onglet du service
   `edusphere-db` → **Connect**) :
   ```bash
   cd backend
   DATABASE_URL="<external-database-url-render>" npm run seed
   ```

**Limites du plan gratuit Render à connaître** (suffisant pour une soutenance) :
- les services web gratuits se mettent en veille après 15 min sans trafic, et
  redémarrent en ~1 min à la requête suivante — penser à ouvrir le site quelques
  minutes avant la démo pour éviter le temps de réveil en direct ;
- le système de fichiers est éphémère : les PDF générés (bulletins, reçus) sont
  perdus à chaque redémarrage/redéploiement — sans impact fonctionnel, ils sont
  régénérés à la demande ;
- la base Postgres gratuite expire 30 jours après sa création (+ 14 jours de
  grâce) — largement suffisant d'ici le dépôt du rapport, mais à surveiller si
  la plateforme doit rester en ligne plus longtemps.

## 6. Aller plus loin

- Remplacer `sequelize.sync({ alter: true })` par de vraies migrations
  (`sequelize-cli`) avant tout déploiement.
- Ajouter des tests automatisés (Jest + supertest) sur les contrôleurs.
- Brancher un vrai service d'e-mail et un vrai plan de sauvegarde de la base.
