# Diagrammes UML d'EduSphere (PlantUML)

Chaque fichier `.puml` contient le code PlantUML complet d'un diagramme, fidèle au code livré. La numérotation des séquences et activités reprend celle utilisée dans le code (commentaires « Diagramme 4 », « diagramme d'activité 7 »...).

## Comment les afficher

1. **En ligne** : copier le contenu d'un fichier dans https://www.planttext.com ou https://www.plantuml.com/plantuml, puis exporter en PNG ou SVG.
2. **Dans VS Code** : extension « PlantUML » (jebbs), puis `Alt+D` pour l'aperçu et « Export Current Diagram » pour l'image.
3. **En ligne de commande** : `java -jar plantuml.jar -tpng docs/uml/*.puml` (Java et Graphviz requis).

## Liste des diagrammes

| Fichier | Type | Contenu |
|---|---|---|
| `00-cas-utilisation.puml` | Cas d'utilisation | Acteurs (Superadmin, Académie, Finance, Étudiant, Parent, Professeur, Système) et ce que chacun peut faire. |
| `01-classes.puml` | Classes | Classes métier, attributs, méthodes principales et associations avec leurs multiplicités. |
| `02-modele-relationnel.puml` | Modèle relationnel (MLD / MPD) | Les 32 tables PostgreSQL, clés primaires et étrangères, généré depuis la base réelle. |
| `architecture-composants.puml` | Composants | Architecture logicielle : frontend, routes, contrôleurs, services, modèles, base. |
| `deploiement.puml` | Déploiement | Navigateur, conteneurs Render (nginx + React, Node.js + Express), PostgreSQL, service e-mail. |
| `diagramme-01-sequence-inscription-eleve.puml` | Séquence 1 | Inscription d'un élève et attribution du matricule SIGLE-XY-NNNN. |
| `diagramme-02-sequence-creation-etablissement.puml` | Séquence 2 | Création d'un établissement et ouverture de ses fonctionnalités par le Superadmin. |
| `diagramme-03-sequence-authentification.puml` | Séquence 3 | Connexion, double facteur par e-mail (étudiants, parents), maintenance, compte verrouillé. |
| `diagramme-04-sequence-acces-temporaire.puml` | Séquence 4 | Accès temporaire d'un professeur : lien, saisie des notes ou appel, compte rendu, fermeture. |
| `diagramme-05-sequence-bulletin.puml` | Séquence 5 | Calcul des moyennes (règles LMD), génération du PDF, envoi par e-mail. |
| `diagramme-06-activite-absences.puml` | Activité 6 | De l'appel du professeur au suivi et à la justification des absences. |
| `diagramme-07-activite-prediction-risque.puml` | Activité 7 | Analyse du risque de décrochage par régression logistique et alertes. |
| `diagramme-08-sequence-paiement.puml` | Séquence 8 | Encaissement, vérification du montant, reçu PDF, e-mail et notification. |
| `diagramme-09-activite-impayes.puml` | Activité 9 | Vérification quotidienne des échéances, relances et régularisation. |
| `diagramme-10-sequence-publication-emploi-du-temps.puml` | Séquence 10 | Brouillon, publication et consultation de l'emploi du temps. |
| `diagramme-11-activite-signalement-comportement.puml` | Activité 11 | Signalement d'un incident : dossier, score de risque, parent prévenu. |
| `diagramme-12-etats-compte-ephemere.puml` | États 12 | Cycle de vie d'un accès temporaire (actif, révoqué, expiré). |
| `diagramme-13-etats-frais-scolarite.puml` | États 13 | Cycle de vie d'un frais (dû, partiel, soldé, impayé). |
| `diagramme-14-etats-emploi-du-temps.puml` | États 14 | Brouillon, publié, modifications non publiées. |
