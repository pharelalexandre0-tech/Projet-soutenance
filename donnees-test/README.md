# Données de test EduSphere

Trois jeux de données pour tester la plateforme et présenter la soutenance. Toutes les adresses e-mail sont en `@...example.com`, un domaine réservé aux tests : aucun vrai destinataire ne reçoit quoi que ce soit.

## 1. Établissement de démonstration complet (dans PostgreSQL)

```bash
cd backend
npm run seed:demo
```

Ajoute à la base, **sans toucher aux données existantes**, l'« Institut de Démonstration EduSphere » (sigle `IDE`) :

| Élément | Contenu |
|---|---|
| Structure | 3 classes (Licence 1 Informatique A et B, Licence 2 Réseaux et télécoms), 1 semestre, 4 UE, 9 matières |
| Personnes | 60 étudiants avec matricule `IDE-XY-NNNN`, 30 parents, 5 professeurs, 8 membres du personnel |
| Évaluation | 540 notes (CC et examen) selon 4 profils : excellent, moyen, fragile, en difficulté (dont des matières éliminatoires) |
| Vie scolaire | environ 150 absences et retards (certains justifiés), 15 incidents de comportement, emploi du temps publié pour chaque classe, 1 feuille d'appel envoyée par un professeur, 1 annonce par classe |
| Finance | frais d'inscription et de scolarité pour chaque étudiant, environ 110 paiements avec reçus : frais soldés, partiels, dus et impayés |
| Paie | 2 mois de salaires versés (juillet et août 2026) avec fiches de paie |
| IA | un score de risque de décrochage calculé pour chaque étudiant (plusieurs en alerte) |

Le script utilise une graine fixe : il produit toujours les mêmes données. Relancé alors que l'établissement existe déjà, il s'arrête sans rien modifier (pour le recréer : le supprimer depuis l'espace superadmin puis relancer).

### Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Académie | `academie@ide.example.com` | `EduSphere2026` |
| Finance | `finance@ide.example.com` | `EduSphere2026` |
| Étudiants | adresse visible dans Élèves & classes | leur matricule |
| Parents | adresse visible dans la fiche de l'élève | `EduSphere2026` |

Le mot de passe se change avec la variable d'environnement `DEMO_MOT_DE_PASSE` avant de lancer le script. Les étudiants et les parents doivent confirmer leur connexion par un code envoyé par e-mail : pour tester leur espace, remplacez l'adresse d'un élève par la vôtre (ou inscrivez un élève avec votre adresse).

Pour peupler la base de production, lancez le script depuis votre poste avec `DATABASE_URL` réglée sur l'adresse externe de la base Render.

## 2. Fichiers d'import d'élèves (`eleves/`)

À importer depuis **Élèves & classes > Importer** en choisissant la classe de destination.

| Fichier | Contenu | Résultat attendu |
|---|---|---|
| `eleves_classe_1.xlsx` | 25 élèves | 25 élèves inscrits, chacun avec son matricule |
| `eleves_classe_2.xlsx` | 25 autres élèves | 25 élèves inscrits |
| `eleves_tous.csv` | les mêmes 50 élèves en CSV (UTF-8) | pour tester l'import CSV (à utiliser à la place des deux fichiers Excel, sinon les adresses sont déjà prises) |
| `eleves_avec_erreurs.xlsx` | 5 lignes piégées | 1 élève inscrit, 4 lignes rejetées avec leur motif : prénom manquant, e-mail manquant, e-mail invalide, e-mail déjà utilisé |

Colonnes attendues : `Prénom`, `Nom`, `Email`, `DateNaissance` (AAAA-MM-JJ, facultative).

## 3. Jeu de test du modèle de risque (`ia/`)

```bash
cd backend
npm run export:jeu-risque
```

- `jeu_test_risque.csv` : 500 profils d'élèves générés avec le même procédé que l'entraînement (graine fixe), un par ligne : moyenne, absences non justifiées, incidents, caractéristiques normalisées (`x_notes`, `x_absences`, `x_comportement`), étiquette réelle, probabilité et score prédits, niveau et prédiction du modèle. Séparateur `;`, décimales à virgule (s'ouvre directement dans Excel).
- `evaluation_modele.json` : performances du modèle actuel sur ce jeu qu'il n'a jamais vu (exactitude, précision, rappel, F1, matrice de confusion).

Le modèle lui-même n'est pas modifié par ce script.
