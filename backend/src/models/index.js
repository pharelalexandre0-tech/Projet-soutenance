const sequelize = require('../config/db');

const Utilisateur = require('./Utilisateur');
const Professeur = require('./Professeur');
const Classe = require('./Classe');
const Semestre = require('./Semestre');
const UniteEnseignement = require('./UniteEnseignement');
const Matiere = require('./Matiere');
const EmploiDuTemps = require('./EmploiDuTemps');
const PublicationEmploiDuTemps = require('./PublicationEmploiDuTemps');
const Eleve = require('./Eleve');
const CompteEphemere = require('./CompteEphemere');
const CahierDeTextes = require('./CahierDeTextes');
const Absence = require('./Absence');
const IncidentComportement = require('./IncidentComportement');
const Note = require('./Note');
const Bulletin = require('./Bulletin');
const PredictionIA = require('./PredictionIA');
const MessageAnnonce = require('./MessageAnnonce');
const Notification = require('./Notification');
const FraisScolarite = require('./FraisScolarite');
const Paiement = require('./Paiement');
const Recu = require('./Recu');
const Salaire = require('./Salaire');
const Personnel = require('./Personnel');
const Etablissement = require('./Etablissement');
// Pilotage de la plateforme par le superadmin (modules, notes de version,
// annonce/maintenance, journal) — sans lien avec le contenu d'une école.
const FonctionnalitePersonnalisee = require('./FonctionnalitePersonnalisee');
const ActivationFonctionnalite = require('./ActivationFonctionnalite');
const ParametrePlateforme = require('./ParametrePlateforme');
const MiseAJour = require('./MiseAJour');
const JournalAdministration = require('./JournalAdministration');

// ---- Multi-établissement (superadmin) --------------------------------------
// EduSphere héberge plusieurs écoles : chaque compte (hors superadmin), et
// chaque entité "racine" (Classe, Semestre, Professeur, Personnel, Eleve),
// appartient à un seul Etablissement — jamais partagé entre écoles.
Etablissement.hasMany(Utilisateur, { foreignKey: 'etablissementId' });
Utilisateur.belongsTo(Etablissement, { foreignKey: 'etablissementId' });
Etablissement.hasMany(Classe, { foreignKey: 'etablissementId' });
Classe.belongsTo(Etablissement, { foreignKey: 'etablissementId' });
Etablissement.hasMany(Semestre, { foreignKey: 'etablissementId' });
Semestre.belongsTo(Etablissement, { foreignKey: 'etablissementId' });
Etablissement.hasMany(Professeur, { foreignKey: 'etablissementId' });
Professeur.belongsTo(Etablissement, { foreignKey: 'etablissementId' });
Etablissement.hasMany(Personnel, { foreignKey: 'etablissementId' });
Personnel.belongsTo(Etablissement, { foreignKey: 'etablissementId' });
Etablissement.hasMany(Eleve, { foreignKey: 'etablissementId' });
Eleve.belongsTo(Etablissement, { foreignKey: 'etablissementId' });

// ---- Academie / structure pedagogique -------------------------------------
Classe.hasMany(EmploiDuTemps, { foreignKey: 'classeId' });
EmploiDuTemps.belongsTo(Classe, { foreignKey: 'classeId' });

Semestre.hasMany(EmploiDuTemps, { foreignKey: 'semestreId' });
EmploiDuTemps.belongsTo(Semestre, { foreignKey: 'semestreId' });

Classe.hasOne(PublicationEmploiDuTemps, { foreignKey: 'classeId' });
PublicationEmploiDuTemps.belongsTo(Classe, { foreignKey: 'classeId' });
Semestre.hasMany(PublicationEmploiDuTemps, { foreignKey: 'semestreId' });
PublicationEmploiDuTemps.belongsTo(Semestre, { foreignKey: 'semestreId' });
Utilisateur.hasMany(PublicationEmploiDuTemps, { foreignKey: 'publieParId' });
PublicationEmploiDuTemps.belongsTo(Utilisateur, { foreignKey: 'publieParId', as: 'publiePar' });

Semestre.hasMany(UniteEnseignement, { foreignKey: 'semestreId' });
UniteEnseignement.belongsTo(Semestre, { foreignKey: 'semestreId' });

// Une UE regroupe plusieurs matières allant "dans le même sens"
// (ex. UE "Programmation" -> Python, PHP, Java).
UniteEnseignement.hasMany(Matiere, { foreignKey: 'uniteEnseignementId' });
Matiere.belongsTo(UniteEnseignement, { foreignKey: 'uniteEnseignementId' });

Classe.hasMany(Eleve, { foreignKey: 'classeId' });
Eleve.belongsTo(Classe, { foreignKey: 'classeId' });

// Le compte Étudiant reste (l'élève consulte directement son propre
// dossier) et coexiste avec un compte Parent optionnel : un même parent
// peut être rattaché à plusieurs enfants (hasMany), l'inverse non — un
// élève a un seul contact parent principal dans le système.
Utilisateur.hasOne(Eleve, { foreignKey: 'compteEtudiantId', as: 'dossierEtudiant' });
Eleve.belongsTo(Utilisateur, { foreignKey: 'compteEtudiantId', as: 'compteEtudiant' });
Utilisateur.hasMany(Eleve, { foreignKey: 'parentId', as: 'enfants' });
Eleve.belongsTo(Utilisateur, { foreignKey: 'parentId', as: 'parent' });

// Cahier de textes : tenu par l'Academie ou par un Professeur via un compte
// ephemere (jamais directement par le Professeur).
Classe.hasMany(CahierDeTextes, { foreignKey: 'classeId' });
CahierDeTextes.belongsTo(Classe, { foreignKey: 'classeId' });
Utilisateur.hasMany(CahierDeTextes, { foreignKey: 'academieId' });
CahierDeTextes.belongsTo(Utilisateur, { foreignKey: 'academieId', as: 'redacteurAcademie' });
CompteEphemere.hasMany(CahierDeTextes, { foreignKey: 'compteEphemereId' });
CahierDeTextes.belongsTo(CompteEphemere, { foreignKey: 'compteEphemereId' });

// ---- Compte ephemere (diagramme 4) -----------------------------------------
Utilisateur.hasMany(CompteEphemere, { foreignKey: 'creeParAcademieId', as: 'comptesEphemeresCrees' });
CompteEphemere.belongsTo(Utilisateur, { foreignKey: 'creeParAcademieId', as: 'creePar' });

Professeur.hasMany(CompteEphemere, { foreignKey: 'professeurId' });
CompteEphemere.belongsTo(Professeur, { foreignKey: 'professeurId' });

Classe.hasMany(CompteEphemere, { foreignKey: 'classeId' });
CompteEphemere.belongsTo(Classe, { foreignKey: 'classeId' });

Matiere.hasMany(CompteEphemere, { foreignKey: 'matiereId' });
CompteEphemere.belongsTo(Matiere, { foreignKey: 'matiereId' });

// ---- Absences (diagramme 6) -------------------------------------------------
Eleve.hasMany(Absence, { foreignKey: 'eleveId' });
Absence.belongsTo(Eleve, { foreignKey: 'eleveId' });
Utilisateur.hasMany(Absence, { foreignKey: 'saisiParAcademieId' });
Absence.belongsTo(Utilisateur, { foreignKey: 'saisiParAcademieId', as: 'saisiParAcademie' });
CompteEphemere.hasMany(Absence, { foreignKey: 'compteEphemereId' });
Absence.belongsTo(CompteEphemere, { foreignKey: 'compteEphemereId' });

// Troisième signal du module IA (notes, absences, comportement).
Eleve.hasMany(IncidentComportement, { foreignKey: 'eleveId' });
IncidentComportement.belongsTo(Eleve, { foreignKey: 'eleveId' });
Utilisateur.hasMany(IncidentComportement, { foreignKey: 'saisiParAcademieId' });
IncidentComportement.belongsTo(Utilisateur, { foreignKey: 'saisiParAcademieId', as: 'saisiParAcademie' });

// ---- Notes / Bulletin (diagrammes 4 et 5) ----------------------------------
Eleve.hasMany(Note, { foreignKey: 'eleveId' });
Note.belongsTo(Eleve, { foreignKey: 'eleveId' });
Matiere.hasMany(Note, { foreignKey: 'matiereId' });
Note.belongsTo(Matiere, { foreignKey: 'matiereId' });
CompteEphemere.hasMany(Note, { foreignKey: 'compteEphemereId' });
Note.belongsTo(CompteEphemere, { foreignKey: 'compteEphemereId' });
Utilisateur.hasMany(Note, { foreignKey: 'saisiParAcademieId' });
Note.belongsTo(Utilisateur, { foreignKey: 'saisiParAcademieId', as: 'saisiParAcademie' });

Eleve.hasMany(Bulletin, { foreignKey: 'eleveId' });
Bulletin.belongsTo(Eleve, { foreignKey: 'eleveId' });
Semestre.hasMany(Bulletin, { foreignKey: 'semestreId' });
Bulletin.belongsTo(Semestre, { foreignKey: 'semestreId' });

// ---- Prediction IA (diagramme 7) -------------------------------------------
Eleve.hasMany(PredictionIA, { foreignKey: 'eleveId' });
PredictionIA.belongsTo(Eleve, { foreignKey: 'eleveId' });

// ---- Messagerie / notifications --------------------------------------------
Utilisateur.hasMany(MessageAnnonce, { foreignKey: 'auteurId' });
MessageAnnonce.belongsTo(Utilisateur, { foreignKey: 'auteurId', as: 'auteur' });
Classe.hasMany(MessageAnnonce, { foreignKey: 'classeId' });
MessageAnnonce.belongsTo(Classe, { foreignKey: 'classeId' });

Utilisateur.hasMany(Notification, { foreignKey: 'utilisateurId' });
Notification.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

// ---- Finance (diagrammes 8 et 9) -------------------------------------------
Eleve.hasMany(FraisScolarite, { foreignKey: 'eleveId' });
FraisScolarite.belongsTo(Eleve, { foreignKey: 'eleveId' });
Semestre.hasMany(FraisScolarite, { foreignKey: 'semestreId' });
FraisScolarite.belongsTo(Semestre, { foreignKey: 'semestreId' });

FraisScolarite.hasMany(Paiement, { foreignKey: 'fraisId' });
Paiement.belongsTo(FraisScolarite, { foreignKey: 'fraisId' });
Utilisateur.hasMany(Paiement, { foreignKey: 'enregistreParFinanceId' });
Paiement.belongsTo(Utilisateur, { foreignKey: 'enregistreParFinanceId', as: 'enregistrePar' });

Paiement.hasOne(Recu, { foreignKey: 'paiementId' });
Recu.belongsTo(Paiement, { foreignKey: 'paiementId' });

Utilisateur.hasMany(Salaire, { foreignKey: 'gereParFinanceId' });
Salaire.belongsTo(Utilisateur, { foreignKey: 'gereParFinanceId', as: 'gerePar' });
Personnel.hasMany(Salaire, { foreignKey: 'personnelId' });
Salaire.belongsTo(Personnel, { foreignKey: 'personnelId' });

module.exports = {
  sequelize,
  Utilisateur,
  Professeur,
  Classe,
  Semestre,
  UniteEnseignement,
  Matiere,
  EmploiDuTemps,
  PublicationEmploiDuTemps,
  Eleve,
  CompteEphemere,
  CahierDeTextes,
  Absence,
  IncidentComportement,
  Note,
  Bulletin,
  PredictionIA,
  MessageAnnonce,
  Notification,
  FraisScolarite,
  Paiement,
  Recu,
  Salaire,
  Personnel,
  Etablissement,
  FonctionnalitePersonnalisee,
  ActivationFonctionnalite,
  ParametrePlateforme,
  MiseAJour,
  JournalAdministration,
};
