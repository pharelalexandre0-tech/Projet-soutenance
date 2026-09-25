# Dictionnaire de données : EduSphere

Plateforme de gestion scolaire multi-établissement. Base de données **PostgreSQL**, accédée par l'ORM **Sequelize** (Node.js / Express).
Le schéma compte **32 tables**, **304 colonnes**, **51 clés étrangères** et **22 types énumérés**. Il est créé et mis à jour automatiquement au démarrage du serveur (`sequelize.sync({ alter: true })`).

Conventions : chaque table a une clé primaire `id` auto-incrémentée (sauf `parametres_plateforme`, clé `cle`) et les colonnes `createdAt` / `updatedAt` gérées par Sequelize ; une clé étrangère porte le nom de l'entité visée suivi de `Id` (ex. `classeId`). Les mots de passe sont hachés (bcrypt) ; les montants sont en francs CFA.

## 1. Vue d'ensemble

| Module | Table | Rôle | Colonnes |
|---|---|---|---|
| Établissements et comptes | `etablissements` | Écoles hébergées par la plateforme (multi-établissement) : identité, coordonnées et logo utilisés sur tous les documents. | 13 |
| Établissements et comptes | `utilisateurs` | Comptes de connexion de tous les rôles (superadmin, académie, finance, étudiant, parent), avec la double authentification et la réinitialisation du mot de passe. | 17 |
| Structure pédagogique | `classes` | Classes d'un établissement (nom et niveau). | 6 |
| Structure pédagogique | `semestres` | Semestres d'une année universitaire (cycle LMD, numéro, année). | 8 |
| Structure pédagogique | `unites_enseignement` | Unités d'enseignement (UE) d'un semestre, avec crédits et coefficient. | 8 |
| Structure pédagogique | `matieres` | Matières (éléments constitutifs) rattachées à une UE, avec coefficient. | 7 |
| Structure pédagogique | `eleves` | Dossier de l'élève : identité, classe, matricule (qui sert aussi de mot de passe), compte étudiant et parent rattachés. | 11 |
| Structure pédagogique | `professeurs` | Enseignants de l'établissement. Pas de compte permanent : ils interviennent par accès temporaire. | 8 |
| Évaluation et suivi | `notes` | Moyennes d'un élève dans une matière (contrôle continu et examen), par session (normale ou rattrapage). | 10 |
| Évaluation et suivi | `bulletins` | Bulletin semestriel d'un élève : moyenne générale, crédits validés et document PDF. | 10 |
| Évaluation et suivi | `incidents_comportement` | Incidents de comportement signalés par l'Académie (troisième signal du calcul de risque). | 9 |
| Évaluation et suivi | `predictions_ia` | Historique des scores de risque de décrochage calculés par le modèle de régression logistique. | 9 |
| Vie scolaire et communication | `absences` | Absences et retards d'un élève, justifiés ou non, saisis par l'Académie ou par un professeur via son accès temporaire. | 11 |
| Vie scolaire et communication | `emplois_du_temps` | Créneaux de cours d'une classe en cours de préparation (brouillon de l'Académie). | 10 |
| Vie scolaire et communication | `publications_emplois_du_temps` | Version publiée de l'emploi du temps d'une classe, seule visible par les étudiants et les parents. | 10 |
| Vie scolaire et communication | `cahiers_de_textes` | Contenu des séances (cahier de textes) d'une classe. | 8 |
| Vie scolaire et communication | `messages_annonces` | Messages, annonces et convocations envoyés à une classe. | 9 |
| Vie scolaire et communication | `notifications` | Notifications individuelles des utilisateurs (absence, paiement, publication...). | 7 |
| Accès temporaires des professeurs | `comptes_ephemeres` | Accès temporaires ouverts à un professeur (lien à jeton) pour saisir des notes ou faire l'appel, avec portée et durée. | 15 |
| Accès temporaires des professeurs | `comptes_rendus_saisie` | Copie figée de ce qu'un professeur a envoyé avec son accès : feuille d'appel complète ou liste des notes. | 18 |
| Finance et paie | `frais_scolarite` | Frais dus par un élève (scolarité, inscription...) et montant déjà réglé. | 10 |
| Finance et paie | `paiements` | Paiements encaissés par la Finance pour un frais. | 9 |
| Finance et paie | `recus` | Reçus de paiement numérotés (document PDF). | 7 |
| Finance et paie | `personnel` | Personnel rémunéré : professeurs repris automatiquement et autre personnel ajouté par la Finance. | 11 |
| Finance et paie | `salaires` | Versements de salaire et fiches de paie. | 10 |
| Documents et journaux | `documents_pdf` | Tous les documents PDF générés (bulletins, reçus, fiches de paie, emplois du temps), stockés dans la base. | 7 |
| Documents et journaux | `journal_emails` | Journal des e-mails envoyés par la plateforme (adresse masquée), pour le diagnostic du superadmin. | 8 |
| Pilotage de la plateforme (superadmin) | `fonctionnalites_personnalisees` | Fonctionnalités créées sans code par le superadmin (page de contenu ou lien). | 13 |
| Pilotage de la plateforme (superadmin) | `activations_fonctionnalites` | Fonctionnalités (modules intégrés ou personnalisés) ouvertes pour chaque établissement. | 4 |
| Pilotage de la plateforme (superadmin) | `parametres_plateforme` | Paramètres globaux de la plateforme (annonce, maintenance...) sous forme clé / valeur. | 4 |
| Pilotage de la plateforme (superadmin) | `mises_a_jour` | Notes de version publiées par le superadmin et affichées aux utilisateurs (« Nouveautés »). | 11 |
| Pilotage de la plateforme (superadmin) | `journal_administration` | Journal des actions du superadmin. | 6 |

## 2. Modèle logique (MLD)

Notation : clé primaire soulignée par `_`, clé étrangère précédée de `#`.

```
ETABLISSEMENTS (_id_, nom, sigle, devise, ville, pays, boitePostale, telephone, email, statut, logo)
UTILISATEURS (_id_, nom, prenom, email, motDePasse, role, service, fonction, statut, codeDoubleFacteur, codeDoubleFacteurExpire, #etablissementId, tokenReinitialisation, tokenReinitialisationExpire, nouveautesVuesLe)
CLASSES (_id_, nom, niveau, #etablissementId)
SEMESTRES (_id_, libelle, anneeScolaire, #etablissementId, cycle, numero)
UNITES_ENSEIGNEMENT (_id_, code, intitule, credits, coefficient, #semestreId)
MATIERES (_id_, code, intitule, coefficient, #uniteEnseignementId)
ELEVES (_id_, nom, prenom, dateNaissance, #etablissementId, #classeId, #compteEtudiantId, #parentId, matricule)
PROFESSEURS (_id_, nom, prenom, email, matiere, #etablissementId)
NOTES (_id_, moyenneCC, moyenneExamen, session, #eleveId, #matiereId, #compteEphemereId, #saisiParAcademieId)
BULLETINS (_id_, moyenneGenerale, creditsValides, dateGeneration, statut, fichierPDF, #eleveId, #semestreId)
INCIDENTS_COMPORTEMENT (_id_, date, description, gravite, #eleveId, #saisiParAcademieId, parentInformeLe)
PREDICTIONS_IA (_id_, scoreRisque, niveauRisque, dateCalcul, facteursCles, alerteGeneree, #eleveId)
ABSENCES (_id_, date, justifie, motif, cours, #eleveId, #saisiParAcademieId, #compteEphemereId, type)
EMPLOIS_DU_TEMPS (_id_, jour, heureDebut, heureFin, salle, #classeId, #semestreId, matiere)
PUBLICATIONS_EMPLOIS_DU_TEMPS (_id_, creneaux, publieLe, nbDestinataires, version, #classeId, #semestreId, #publieParId)
CAHIERS_DE_TEXTES (_id_, date, contenuSeance, #classeId, #academieId, #compteEphemereId)
MESSAGES_ANNONCES (_id_, titre, contenu, dateEnvoi, type, #auteurId, #classeId)
NOTIFICATIONS (_id_, contenu, dateEnvoi, lu, #utilisateurId)
COMPTES_EPHEMERES (_id_, jeton, tache, categorie, evaluationLibelle, dateCreation, dateExpiration, statut, #creeParAcademieId, #professeurId, #classeId, #matiereId, saisieEnvoyeeLe)
COMPTES_RENDUS_SAISIE (_id_, tache, date, professeurNom, classeNom, matiereNom, categorie, evaluationLibelle, resume, lignes, envoyeLe, #compteEphemereId, #classeId, #professeurId, #matiereId, #etablissementId)
FRAIS_SCOLARITE (_id_, libelle, montant, montantRegle, dateEcheance, statut, #eleveId, #semestreId)
PAIEMENTS (_id_, montant, datePaiement, modePaiement, statut, #fraisId, #enregistreParFinanceId)
RECUS (_id_, numero, dateEmission, fichierPDF, #paiementId)
PERSONNEL (_id_, nom, prenom, email, poste, salaireBase, dateEmbauche, #etablissementId, #professeurId)
SALAIRES (_id_, montant, periode, statut, dateVersement, fichierPDF, #gereParFinanceId, #personnelId)
DOCUMENTS_PDF (_id_, nomFichier, typeDocument, contenu, taille)
JOURNAL_EMAILS (_id_, destinataire, sujet, service, statut, erreurs)
FONCTIONNALITES_PERSONNALISEES (_id_, cle, type, nom, description, icone, espaces, contenu, url, libelleBouton, auteurId)
ACTIVATIONS_FONCTIONNALITES (_id_, etablissementId, cle)
PARAMETRES_PLATEFORME (_cle_, valeur)
MISES_A_JOUR (_id_, version, titre, contenu, type, statut, publieeLe, espaces, auteurId)
JOURNAL_ADMINISTRATION (_id_, auteurId, auteurNom, categorie, libelle)
```

## 3. Détail des tables

### Établissements et comptes

#### 3.1. `etablissements`

Écoles hébergées par la plateforme (multi-établissement) : identité, coordonnées et logo utilisés sur tous les documents.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom officiel de l'établissement |
| `sigle` | VARCHAR(255) | Non |  |  | Sigle (préfixe des matricules) |
| `devise` | VARCHAR(255) | Non |  |  | Devise de l'établissement |
| `ville` | VARCHAR(255) | Oui |  |  | Ville |
| `pays` | VARCHAR(255) | Oui | République Gabonaise |  | Pays |
| `boitePostale` | VARCHAR(255) | Non |  |  | Boîte postale |
| `telephone` | VARCHAR(255) | Non |  |  | Téléphone |
| `email` | VARCHAR(255) | Non |  |  | E-mail de contact |
| `statut` | ENUM (actif, suspendu) | Oui | actif |  | Établissement actif ou suspendu |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `logo` | TEXT | Non |  |  | Logo en image base64 (data URI) |

#### 3.2. `utilisateurs`

Comptes de connexion de tous les rôles (superadmin, académie, finance, étudiant, parent), avec la double authentification et la réinitialisation du mot de passe.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom |
| `prenom` | VARCHAR(255) | Oui |  |  | Prénom |
| `email` | VARCHAR(255) | Oui |  | UNIQUE | Adresse e-mail (identifiant de connexion) |
| `motDePasse` | VARCHAR(255) | Oui |  |  | Mot de passe haché (bcrypt) |
| `role` | ENUM (superadmin, academie, finance, etudiant, parent) | Oui |  |  | Rôle du compte |
| `service` | VARCHAR(255) | Non |  |  | Service (personnel administratif) |
| `fonction` | VARCHAR(255) | Non |  |  | Fonction (personnel administratif) |
| `statut` | ENUM (actif, verrouille) | Oui | actif |  | Compte actif ou verrouillé |
| `codeDoubleFacteur` | VARCHAR(255) | Non |  |  | Code de vérification envoyé par e-mail (2FA) |
| `codeDoubleFacteurExpire` | TIMESTAMPTZ | Non |  |  | Date d'expiration du code 2FA |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement du compte (vide pour le superadmin) |
| `tokenReinitialisation` | VARCHAR(255) | Non |  |  | Jeton du lien de réinitialisation du mot de passe |
| `tokenReinitialisationExpire` | TIMESTAMPTZ | Non |  |  | Date d'expiration de ce jeton |
| `nouveautesVuesLe` | TIMESTAMPTZ | Non |  |  | Dernière consultation des notes de version |

### Structure pédagogique

#### 3.3. `classes`

Classes d'un établissement (nom et niveau).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom de la classe |
| `niveau` | VARCHAR(255) | Oui |  |  | Niveau (Licence 1, Master 2...) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |

#### 3.4. `semestres`

Semestres d'une année universitaire (cycle LMD, numéro, année).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `libelle` | VARCHAR(255) | Oui |  |  | Libellé du semestre |
| `anneeScolaire` | VARCHAR(255) | Oui |  |  | Année universitaire (ex. 2025-2026) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |
| `cycle` | ENUM (licence, master, doctorat) | Oui | licence |  | Cycle LMD |
| `numero` | INTEGER | Oui | 1 |  | Numéro du semestre dans le cycle |

#### 3.5. `unites_enseignement`

Unités d'enseignement (UE) d'un semestre, avec crédits et coefficient.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `code` | VARCHAR(255) | Oui |  | UNIQUE | Code de l'UE |
| `intitule` | VARCHAR(255) | Oui |  |  | Intitulé de l'UE |
| `credits` | INTEGER | Oui |  |  | Crédits ECTS |
| `coefficient` | DOUBLE PRECISION | Oui | 1 |  | Coefficient |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `semestreId` | INTEGER | Non |  | FK → semestres.id | Semestre |

#### 3.6. `matieres`

Matières (éléments constitutifs) rattachées à une UE, avec coefficient.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `code` | VARCHAR(255) | Oui |  |  | Code de la matière |
| `intitule` | VARCHAR(255) | Oui |  |  | Intitulé |
| `coefficient` | DOUBLE PRECISION | Oui | 1 |  | Coefficient dans l'UE |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `uniteEnseignementId` | INTEGER | Non |  | FK → unites_enseignement.id | UE de rattachement |

#### 3.7. `eleves`

Dossier de l'élève : identité, classe, matricule (qui sert aussi de mot de passe), compte étudiant et parent rattachés.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom |
| `prenom` | VARCHAR(255) | Oui |  |  | Prénom |
| `dateNaissance` | DATE | Non |  |  | Date de naissance |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `compteEtudiantId` | INTEGER | Non |  | FK → utilisateurs.id | Compte de connexion de l’étudiant |
| `parentId` | INTEGER | Non |  | FK → utilisateurs.id | Compte du parent |
| `matricule` | VARCHAR(30) | Non |  | UNIQUE | Matricule SIGLE-XY-NNNN (mot de passe de l’étudiant) |

#### 3.8. `professeurs`

Enseignants de l'établissement. Pas de compte permanent : ils interviennent par accès temporaire.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom |
| `prenom` | VARCHAR(255) | Oui |  |  | Prénom |
| `email` | VARCHAR(255) | Oui |  | UNIQUE | E-mail (réception des liens d’accès) |
| `matiere` | VARCHAR(255) | Non |  |  | Matière enseignée |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |

### Évaluation et suivi

#### 3.9. `notes`

Moyennes d'un élève dans une matière (contrôle continu et examen), par session (normale ou rattrapage).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `moyenneCC` | DOUBLE PRECISION | Non |  |  | Moyenne de contrôle continu /20 |
| `moyenneExamen` | DOUBLE PRECISION | Non |  |  | Moyenne d'examen /20 |
| `session` | ENUM (normale, rattrapage) | Oui | normale |  | Session (normale ou rattrapage) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |
| `matiereId` | INTEGER | Non |  | FK → matieres.id | Matière |
| `compteEphemereId` | INTEGER | Non |  | FK → comptes_ephemeres.id | Accès temporaire ayant servi à la saisie |
| `saisiParAcademieId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Académie ayant saisi la note |

#### 3.10. `bulletins`

Bulletin semestriel d'un élève : moyenne générale, crédits validés et document PDF.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `moyenneGenerale` | DOUBLE PRECISION | Oui |  |  | Moyenne générale /20 |
| `creditsValides` | INTEGER | Oui | 0 |  | Crédits validés |
| `dateGeneration` | TIMESTAMPTZ | Oui |  |  | Date de génération |
| `statut` | ENUM (genere, envoye) | Oui | genere |  | Généré ou envoyé |
| `fichierPDF` | VARCHAR(255) | Non |  |  | Adresse du document PDF |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |
| `semestreId` | INTEGER | Non |  | FK → semestres.id | Semestre |

#### 3.11. `incidents_comportement`

Incidents de comportement signalés par l'Académie (troisième signal du calcul de risque).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `date` | DATE | Oui |  |  | Date des faits |
| `description` | VARCHAR(255) | Oui |  |  | Description (250 caractères au plus) |
| `gravite` | ENUM (mineur, majeur) | Oui | mineur |  | Gravité |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |
| `saisiParAcademieId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Académie auteur du signalement |
| `parentInformeLe` | TIMESTAMPTZ | Non |  |  | Date à laquelle le parent a été prévenu |

#### 3.12. `predictions_ia`

Historique des scores de risque de décrochage calculés par le modèle de régression logistique.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `scoreRisque` | DOUBLE PRECISION | Oui |  |  | Score de risque /100 (probabilité x 100) |
| `niveauRisque` | ENUM (faible, moyen, eleve) | Oui |  |  | Niveau de risque |
| `dateCalcul` | TIMESTAMPTZ | Oui |  |  | Date du calcul |
| `facteursCles` | TEXT | Non |  |  | Facteurs expliquant le score |
| `alerteGeneree` | BOOLEAN | Oui | false |  | Seuil d’alerte dépassé (60/100) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |

### Vie scolaire et communication

#### 3.13. `absences`

Absences et retards d'un élève, justifiés ou non, saisis par l'Académie ou par un professeur via son accès temporaire.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `date` | DATE | Oui |  |  | Date |
| `justifie` | BOOLEAN | Oui | false |  | Absence justifiée |
| `motif` | VARCHAR(255) | Non |  |  | Motif du justificatif |
| `cours` | VARCHAR(255) | Non |  |  | Cours concerné |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |
| `saisiParAcademieId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Académie auteur de la saisie |
| `compteEphemereId` | INTEGER | Non |  | FK → comptes_ephemeres.id | Accès temporaire du professeur ayant fait l’appel |
| `type` | ENUM (absence, retard) | Oui | absence |  | Absence ou retard |

#### 3.14. `emplois_du_temps`

Créneaux de cours d'une classe en cours de préparation (brouillon de l'Académie).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `jour` | VARCHAR(255) | Oui |  |  | Jour de la semaine |
| `heureDebut` | VARCHAR(255) | Oui |  |  | Heure de début |
| `heureFin` | VARCHAR(255) | Oui |  |  | Heure de fin |
| `salle` | VARCHAR(255) | Non |  |  | Salle |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `semestreId` | INTEGER | Non |  | FK → semestres.id | Semestre |
| `matiere` | VARCHAR(255) | Non |  |  | Matière |

#### 3.15. `publications_emplois_du_temps`

Version publiée de l'emploi du temps d'une classe, seule visible par les étudiants et les parents.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `creneaux` | JSON | Oui | [] |  | Créneaux publiés (JSON) |
| `publieLe` | TIMESTAMPTZ | Oui |  |  | Date de publication |
| `nbDestinataires` | INTEGER | Oui | 0 |  | Étudiants et parents prévenus |
| `version` | INTEGER | Oui | 1 |  | Numéro de version |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `semestreId` | INTEGER | Non |  | FK → semestres.id | Semestre |
| `publieParId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Académie ayant publié |

#### 3.16. `cahiers_de_textes`

Contenu des séances (cahier de textes) d'une classe.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `date` | DATE | Oui |  |  | Date de la séance |
| `contenuSeance` | TEXT | Oui |  |  | Contenu |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `academieId` | INTEGER | Non |  | FK → utilisateurs.id | Auteur (Académie) |
| `compteEphemereId` | INTEGER | Non |  | FK → comptes_ephemeres.id | Accès temporaire utilisé |

#### 3.17. `messages_annonces`

Messages, annonces et convocations envoyés à une classe.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `titre` | VARCHAR(255) | Oui |  |  | Titre |
| `contenu` | TEXT | Oui |  |  | Contenu |
| `dateEnvoi` | TIMESTAMPTZ | Oui |  |  | Date d'envoi |
| `type` | ENUM (message, annonce, convocation) | Oui | message |  | Type de message |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `auteurId` | INTEGER | Non |  | FK → utilisateurs.id | Auteur |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe destinataire |

#### 3.18. `notifications`

Notifications individuelles des utilisateurs (absence, paiement, publication...).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `contenu` | VARCHAR(255) | Oui |  |  | Texte de la notification |
| `dateEnvoi` | TIMESTAMPTZ | Oui |  |  | Date d'envoi |
| `lu` | BOOLEAN | Oui | false |  | Notification lue |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `utilisateurId` | INTEGER | Non |  | FK → utilisateurs.id | Destinataire |

### Accès temporaires des professeurs

#### 3.19. `comptes_ephemeres`

Accès temporaires ouverts à un professeur (lien à jeton) pour saisir des notes ou faire l'appel, avec portée et durée.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `jeton` | VARCHAR(255) | Oui |  | UNIQUE | Jeton secret du lien |
| `tache` | ENUM (saisie_notes, saisie_absences, cahier_de_textes) | Oui | saisie_notes |  | Mission (notes, appel, cahier de textes) |
| `categorie` | ENUM (cc, examen) | Oui | cc |  | Type de note (CC ou examen) |
| `evaluationLibelle` | VARCHAR(255) | Non |  |  | Intitulé de l'évaluation |
| `dateCreation` | TIMESTAMPTZ | Oui |  |  | Date de création |
| `dateExpiration` | TIMESTAMPTZ | Oui |  |  | Date d'expiration du lien |
| `statut` | ENUM (actif, revoque, expire) | Oui | actif |  | Actif, révoqué ou expiré |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `creeParAcademieId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Académie créateur |
| `professeurId` | INTEGER | Non |  | FK → professeurs.id | Professeur |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `matiereId` | INTEGER | Non |  | FK → matieres.id | Matière |
| `saisieEnvoyeeLe` | TIMESTAMPTZ | Non |  |  | Date d’envoi de la saisie par le professeur |

#### 3.20. `comptes_rendus_saisie`

Copie figée de ce qu'un professeur a envoyé avec son accès : feuille d'appel complète ou liste des notes.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `tache` | ENUM (saisie_notes, saisie_absences) | Oui |  |  | Appel ou saisie de notes |
| `date` | DATE | Oui |  |  | Date de la séance |
| `professeurNom` | VARCHAR(255) | Non |  |  | Nom du professeur (copie) |
| `classeNom` | VARCHAR(255) | Non |  |  | Nom de la classe (copie) |
| `matiereNom` | VARCHAR(255) | Non |  |  | Nom de la matière (copie) |
| `categorie` | VARCHAR(10) | Non |  |  | Type de note |
| `evaluationLibelle` | VARCHAR(255) | Non |  |  | Intitulé de l'évaluation |
| `resume` | JSON | Oui | {} |  | Synthèse (présents, absents, retards ou moyenne, min, max) |
| `lignes` | JSON | Oui | [] |  | Détail par élève (JSON) |
| `envoyeLe` | TIMESTAMPTZ | Oui |  |  | Date d'envoi |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `compteEphemereId` | INTEGER | Non |  | FK → comptes_ephemeres.id | Accès temporaire |
| `classeId` | INTEGER | Non |  | FK → classes.id | Classe |
| `professeurId` | INTEGER | Non |  | FK → professeurs.id | Professeur |
| `matiereId` | INTEGER | Non |  | FK → matieres.id | Matière |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |

### Finance et paie

#### 3.21. `frais_scolarite`

Frais dus par un élève (scolarité, inscription...) et montant déjà réglé.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `libelle` | VARCHAR(255) | Oui |  |  | Libellé du frais |
| `montant` | DOUBLE PRECISION | Oui |  |  | Montant dû (FCFA) |
| `montantRegle` | DOUBLE PRECISION | Oui | 0 |  | Montant déjà réglé |
| `dateEcheance` | DATE | Oui |  |  | Date d'échéance |
| `statut` | ENUM (du, partiel, solde, impaye) | Oui | du |  | Statut du frais |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `eleveId` | INTEGER | Non |  | FK → eleves.id | Élève |
| `semestreId` | INTEGER | Non |  | FK → semestres.id | Semestre |

#### 3.22. `paiements`

Paiements encaissés par la Finance pour un frais.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `montant` | DOUBLE PRECISION | Oui |  |  | Montant payé (FCFA) |
| `datePaiement` | TIMESTAMPTZ | Oui |  |  | Date du paiement |
| `modePaiement` | ENUM (especes, mobile_money, virement) | Oui |  |  | Mode de paiement |
| `statut` | ENUM (valide, invalide) | Oui | valide |  | Paiement valide ou non |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `fraisId` | INTEGER | Non |  | FK → frais_scolarite.id | Frais réglé |
| `enregistreParFinanceId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Finance ayant encaissé |

#### 3.23. `recus`

Reçus de paiement numérotés (document PDF).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `numero` | VARCHAR(255) | Oui |  | UNIQUE | Numéro REC-AAAA-NNNNN |
| `dateEmission` | TIMESTAMPTZ | Oui |  |  | Date d'émission |
| `fichierPDF` | VARCHAR(255) | Non |  |  | Adresse du PDF |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `paiementId` | INTEGER | Non |  | FK → paiements.id | Paiement |

#### 3.24. `personnel`

Personnel rémunéré : professeurs repris automatiquement et autre personnel ajouté par la Finance.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nom` | VARCHAR(255) | Oui |  |  | Nom |
| `prenom` | VARCHAR(255) | Oui |  |  | Prénom |
| `email` | VARCHAR(255) | Non |  |  | E-mail (envoi des fiches de paie) |
| `poste` | VARCHAR(255) | Oui |  |  | Poste |
| `salaireBase` | DOUBLE PRECISION | Non |  |  | Salaire de base (FCFA) |
| `dateEmbauche` | DATE | Non |  |  | Date d'embauche |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `etablissementId` | INTEGER | Non |  | FK → etablissements.id | Établissement |
| `professeurId` | INTEGER | Non |  | FK → professeurs.id | Professeur correspondant (si enseignant) |

#### 3.25. `salaires`

Versements de salaire et fiches de paie.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `montant` | DOUBLE PRECISION | Oui |  |  | Montant net (FCFA) |
| `periode` | VARCHAR(255) | Oui |  |  | Période (mois) |
| `statut` | ENUM (prevu, verse) | Oui | prevu |  | Prévu ou versé |
| `dateVersement` | DATE | Non |  |  | Date de versement |
| `fichierPDF` | VARCHAR(255) | Non |  |  | Adresse de la fiche de paie |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |
| `gereParFinanceId` | INTEGER | Non |  | FK → utilisateurs.id | Compte Finance |
| `personnelId` | INTEGER | Non |  | FK → personnel.id | Membre du personnel |

### Documents et journaux

#### 3.26. `documents_pdf`

Tous les documents PDF générés (bulletins, reçus, fiches de paie, emplois du temps), stockés dans la base.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `nomFichier` | VARCHAR(255) | Oui |  | UNIQUE | Nom unique du fichier |
| `typeDocument` | VARCHAR(30) | Oui | document |  | Bulletin, reçu, fiche de paie ou emploi du temps |
| `contenu` | BYTEA | Oui |  |  | Contenu binaire du PDF |
| `taille` | INTEGER | Oui | 0 |  | Taille en octets |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |

#### 3.27. `journal_emails`

Journal des e-mails envoyés par la plateforme (adresse masquée), pour le diagnostic du superadmin.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `destinataire` | VARCHAR(255) | Oui |  |  | Adresse masquée du destinataire |
| `sujet` | VARCHAR(300) | Oui |  |  | Objet du message |
| `service` | VARCHAR(30) | Oui |  |  | Service d'envoi utilisé |
| `statut` | ENUM (envoye, simule, echec) | Oui |  |  | Envoyé, simulé ou en échec |
| `erreurs` | JSON | Oui | [] |  | Erreurs rencontrées (JSON) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |

### Pilotage de la plateforme (superadmin)

#### 3.28. `fonctionnalites_personnalisees`

Fonctionnalités créées sans code par le superadmin (page de contenu ou lien).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `cle` | VARCHAR(255) | Oui |  | UNIQUE | Clé technique unique |
| `type` | ENUM (page, lien) | Oui |  |  | Page de contenu ou lien |
| `nom` | VARCHAR(80) | Oui |  |  | Nom affiché |
| `description` | VARCHAR(300) | Oui |  |  | Description |
| `icone` | VARCHAR(40) | Oui | FileText |  | Icône |
| `espaces` | JSON | Oui | [] |  | Espaces concernés (JSON) |
| `contenu` | TEXT | Non |  |  | Contenu de la page |
| `url` | VARCHAR(500) | Non |  |  | Adresse du lien |
| `libelleBouton` | VARCHAR(60) | Non |  |  | Texte du bouton |
| `auteurId` | INTEGER | Non |  |  | Superadmin auteur |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |

#### 3.29. `activations_fonctionnalites`

Fonctionnalités (modules intégrés ou personnalisés) ouvertes pour chaque établissement.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `etablissementId` | INTEGER | Oui |  |  | Établissement |
| `cle` | VARCHAR(255) | Oui |  |  | Clé de la fonctionnalité ouverte |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |

#### 3.30. `parametres_plateforme`

Paramètres globaux de la plateforme (annonce, maintenance...) sous forme clé / valeur.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `cle` | VARCHAR(255) | Oui |  | PK | Nom du paramètre (clé primaire) |
| `valeur` | JSON | Non |  |  | Valeur (JSON) |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |

#### 3.31. `mises_a_jour`

Notes de version publiées par le superadmin et affichées aux utilisateurs (« Nouveautés »).

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `version` | VARCHAR(20) | Oui |  |  | Numéro de version |
| `titre` | VARCHAR(140) | Oui |  |  | Titre |
| `contenu` | TEXT | Oui |  |  | Notes de version |
| `type` | ENUM (nouveaute, amelioration, correctif) | Oui | nouveaute |  | Nouveauté, amélioration ou correctif |
| `statut` | ENUM (brouillon, publiee) | Oui | brouillon |  | Brouillon ou publiée |
| `publieeLe` | TIMESTAMPTZ | Non |  |  | Date de publication |
| `espaces` | JSON | Oui | [] |  | Espaces concernés (JSON) |
| `auteurId` | INTEGER | Non |  |  | Superadmin auteur |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |
| `updatedAt` | TIMESTAMPTZ | Oui |  |  | Date de dernière modification |

#### 3.32. `journal_administration`

Journal des actions du superadmin.

| Colonne | Type | Obligatoire | Défaut | Clé | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | Oui | auto-incrément | PK | Identifiant unique (clé primaire) |
| `auteurId` | INTEGER | Non |  |  | Superadmin |
| `auteurNom` | VARCHAR(255) | Oui |  |  | Nom de l'auteur (copie) |
| `categorie` | VARCHAR(30) | Oui |  |  | Catégorie d'action |
| `libelle` | VARCHAR(400) | Oui |  |  | Description de l'action |
| `createdAt` | TIMESTAMPTZ | Oui |  |  | Date de création de la ligne |

## 4. Relations (clés étrangères)

| Table | Colonne | Référence | À la suppression de la ligne référencée |
|---|---|---|---|
| `absences` | `compteEphemereId` | `comptes_ephemeres.id` | mise à NULL |
| `absences` | `eleveId` | `eleves.id` | mise à NULL |
| `absences` | `saisiParAcademieId` | `utilisateurs.id` | mise à NULL |
| `bulletins` | `eleveId` | `eleves.id` | mise à NULL |
| `bulletins` | `semestreId` | `semestres.id` | mise à NULL |
| `cahiers_de_textes` | `academieId` | `utilisateurs.id` | mise à NULL |
| `cahiers_de_textes` | `classeId` | `classes.id` | mise à NULL |
| `cahiers_de_textes` | `compteEphemereId` | `comptes_ephemeres.id` | mise à NULL |
| `classes` | `etablissementId` | `etablissements.id` | mise à NULL |
| `comptes_ephemeres` | `classeId` | `classes.id` | mise à NULL |
| `comptes_ephemeres` | `creeParAcademieId` | `utilisateurs.id` | mise à NULL |
| `comptes_ephemeres` | `matiereId` | `matieres.id` | mise à NULL |
| `comptes_ephemeres` | `professeurId` | `professeurs.id` | mise à NULL |
| `comptes_rendus_saisie` | `classeId` | `classes.id` | mise à NULL |
| `comptes_rendus_saisie` | `compteEphemereId` | `comptes_ephemeres.id` | mise à NULL |
| `comptes_rendus_saisie` | `etablissementId` | `etablissements.id` | mise à NULL |
| `comptes_rendus_saisie` | `matiereId` | `matieres.id` | mise à NULL |
| `comptes_rendus_saisie` | `professeurId` | `professeurs.id` | mise à NULL |
| `eleves` | `classeId` | `classes.id` | mise à NULL |
| `eleves` | `compteEtudiantId` | `utilisateurs.id` | mise à NULL |
| `eleves` | `etablissementId` | `etablissements.id` | mise à NULL |
| `eleves` | `parentId` | `utilisateurs.id` | mise à NULL |
| `emplois_du_temps` | `classeId` | `classes.id` | mise à NULL |
| `emplois_du_temps` | `semestreId` | `semestres.id` | mise à NULL |
| `frais_scolarite` | `eleveId` | `eleves.id` | mise à NULL |
| `frais_scolarite` | `semestreId` | `semestres.id` | mise à NULL |
| `incidents_comportement` | `eleveId` | `eleves.id` | mise à NULL |
| `incidents_comportement` | `saisiParAcademieId` | `utilisateurs.id` | mise à NULL |
| `matieres` | `uniteEnseignementId` | `unites_enseignement.id` | mise à NULL |
| `messages_annonces` | `auteurId` | `utilisateurs.id` | mise à NULL |
| `messages_annonces` | `classeId` | `classes.id` | mise à NULL |
| `notes` | `compteEphemereId` | `comptes_ephemeres.id` | mise à NULL |
| `notes` | `eleveId` | `eleves.id` | mise à NULL |
| `notes` | `matiereId` | `matieres.id` | mise à NULL |
| `notes` | `saisiParAcademieId` | `utilisateurs.id` | mise à NULL |
| `notifications` | `utilisateurId` | `utilisateurs.id` | mise à NULL |
| `paiements` | `enregistreParFinanceId` | `utilisateurs.id` | mise à NULL |
| `paiements` | `fraisId` | `frais_scolarite.id` | mise à NULL |
| `personnel` | `etablissementId` | `etablissements.id` | mise à NULL |
| `personnel` | `professeurId` | `professeurs.id` | mise à NULL |
| `predictions_ia` | `eleveId` | `eleves.id` | mise à NULL |
| `professeurs` | `etablissementId` | `etablissements.id` | mise à NULL |
| `publications_emplois_du_temps` | `classeId` | `classes.id` | mise à NULL |
| `publications_emplois_du_temps` | `publieParId` | `utilisateurs.id` | mise à NULL |
| `publications_emplois_du_temps` | `semestreId` | `semestres.id` | mise à NULL |
| `recus` | `paiementId` | `paiements.id` | mise à NULL |
| `salaires` | `gereParFinanceId` | `utilisateurs.id` | mise à NULL |
| `salaires` | `personnelId` | `personnel.id` | mise à NULL |
| `semestres` | `etablissementId` | `etablissements.id` | mise à NULL |
| `unites_enseignement` | `semestreId` | `semestres.id` | mise à NULL |
| `utilisateurs` | `etablissementId` | `etablissements.id` | mise à NULL |

## 5. Types énumérés

| Type PostgreSQL | Valeurs possibles |
|---|---|
| `enum_absences_type` | absence, retard |
| `enum_bulletins_statut` | genere, envoye |
| `enum_comptes_ephemeres_categorie` | cc, examen |
| `enum_comptes_ephemeres_statut` | actif, revoque, expire |
| `enum_comptes_ephemeres_tache` | saisie_notes, saisie_absences, cahier_de_textes |
| `enum_comptes_rendus_saisie_tache` | saisie_notes, saisie_absences |
| `enum_etablissements_statut` | actif, suspendu |
| `enum_fonctionnalites_personnalisees_type` | page, lien |
| `enum_frais_scolarite_statut` | du, partiel, solde, impaye |
| `enum_incidents_comportement_gravite` | mineur, majeur |
| `enum_journal_emails_statut` | envoye, simule, echec |
| `enum_messages_annonces_type` | message, annonce, convocation |
| `enum_mises_a_jour_statut` | brouillon, publiee |
| `enum_mises_a_jour_type` | nouveaute, amelioration, correctif |
| `enum_notes_session` | normale, rattrapage |
| `enum_paiements_modePaiement` | especes, mobile_money, virement |
| `enum_paiements_statut` | valide, invalide |
| `enum_predictions_ia_niveauRisque` | faible, moyen, eleve |
| `enum_salaires_statut` | prevu, verse |
| `enum_semestres_cycle` | licence, master, doctorat |
| `enum_utilisateurs_role` | superadmin, academie, finance, etudiant, parent |
| `enum_utilisateurs_statut` | actif, verrouille |
