const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Classe Utilisateur du diagramme de classes : regroupe Academie, Finance et
// Etudiant (le Professeur n'a volontairement PAS de compte permanent, voir
// CompteEphemere). Le parent non plus : il ouvre le compte étudiant de son
// enfant avec sa propre adresse e-mail (Eleve.emailParent) et le même mot
// de passe. Le champ `role` fait office de discriminant plutot que
// des sous-classes Sequelize separees, avec deux colonnes optionnelles qui
// ne servent qu'a un seul role (service pour Academie, fonction pour
// Finance) pour rester fidele au modele de domaine.
class Utilisateur extends Model {
  toPublicJSON() {
    const { id, nom, prenom, email, role, service, fonction, etablissementId, statut, createdAt } = this;
    return { id, nom, prenom, email, role, service, fonction, etablissementId, statut, createdAt, doubleFacteurActif: Boolean(this.totpActif) };
  }
}

Utilisateur.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    motDePasse: { type: DataTypes.STRING, allowNull: false },
    // 'superadmin' n'appartient à aucun établissement (etablissementId reste
    // null pour ce rôle) — il gère la liste des écoles elles-mêmes.
    // 'ministere' : agent du Ministère de l'Enseignement supérieur (tutelle),
    // sans établissement, ne voit que des données agrégées.
    role: { type: DataTypes.ENUM('superadmin', 'academie', 'finance', 'etudiant', 'ministere'), allowNull: false },
    // specifique Academie
    service: { type: DataTypes.STRING, allowNull: true },
    // specifique Finance
    fonction: { type: DataTypes.STRING, allowNull: true },
    // Verrouillage d'un compte précis par le superadmin — distinct de la
    // suspension d'un établissement entier (qui verrouille tous ses comptes
    // d'un coup, voir Etablissement.statut).
    statut: { type: DataTypes.ENUM('actif', 'verrouille'), allowNull: false, defaultValue: 'actif' },
    // Double authentification (obligatoire pour le rôle Etudiant) : code à
    // 6 chiffres envoyé par e-mail après le mot de passe, à durée de vie
    // courte. Nul en dehors d'une connexion en cours.
    codeDoubleFacteur: { type: DataTypes.STRING, allowNull: true },
    codeDoubleFacteurExpire: { type: DataTypes.DATE, allowNull: true },
    // Adresse à laquelle le code a été envoyé : celle de l'étudiant, ou
    // celle de son parent quand c'est lui qui se connecte (session parent).
    codeDoubleFacteurPour: { type: DataTypes.STRING, allowNull: true },
    // "Mot de passe oublié" : jeton aléatoire à usage unique envoyé par
    // e-mail, même principe de durée de vie courte que le code 2FA
    // ci-dessus. Nul en dehors d'une réinitialisation en cours.
    tokenReinitialisation: { type: DataTypes.STRING, allowNull: true },
    tokenReinitialisationExpire: { type: DataTypes.DATE, allowNull: true },
    // Dernière ouverture de la fenêtre "Nouveautés" : toute note de version
    // publiée après cette date compte comme non lue. Nul = jamais ouverte,
    // on repart alors de la création du compte (pas tout l'historique).
    nouveautesVuesLe: { type: DataTypes.DATE, allowNull: true },
    // Code e-mail : essais restants avant qu'il soit invalidé (5 au plus).
    codeDoubleFacteurEssais: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Application d'authentification (TOTP), obligatoire pour le personnel
    // (Académie, Finance, Superadmin). Secret chiffré en base (AES-256-GCM),
    // dernier pas de 30 s utilisé (un code ne sert qu'une fois), empreintes
    // SHA-256 des codes de secours restants.
    totpSecret: { type: DataTypes.TEXT, allowNull: true },
    totpActif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    totpActiveLe: { type: DataTypes.DATE, allowNull: true },
    totpDernierPas: { type: DataTypes.BIGINT, allowNull: true },
    totpCodesSecours: { type: DataTypes.JSON, allowNull: true },
    // Nouveau secret en cours d'enregistrement (premier appareil ou
    // changement de téléphone) : remplace le secret actif seulement après
    // un premier code correct.
    totpSecretEnAttente: { type: DataTypes.TEXT, allowNull: true },
    // Verrouillage temporaire après des échecs répétés (mot de passe ou
    // code) : freine l'essai de mots de passe en série sur un compte.
    echecsConnexion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    verrouilleJusqua: { type: DataTypes.DATE, allowNull: true },
    derniereConnexion: { type: DataTypes.DATE, allowNull: true },
    // Photo de profil : JPEG carré 256 px (data URI), préparée par le serveur.
    photo: { type: DataTypes.TEXT, allowNull: true },
    motDePasseChangeLe: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Utilisateur',
    tableName: 'utilisateurs',
    // Le hash du mot de passe et les jetons temporaires (2FA, réinitialisation)
    // ne doivent jamais sortir dans une réponse JSON, y compris quand
    // Utilisateur est inclus en relation imbriquée (ex. compte étudiant d'un
    // élève). Le scope "avecMotDePasse" (auth uniquement) permet de les
    // récupérer explicitement pour la vérification.
    defaultScope: {
      attributes: {
        exclude: ['motDePasse', 'codeDoubleFacteur', 'codeDoubleFacteurExpire', 'codeDoubleFacteurPour', 'codeDoubleFacteurEssais', 'tokenReinitialisation',
          'tokenReinitialisationExpire', 'totpSecret', 'totpSecretEnAttente', 'totpDernierPas', 'totpCodesSecours', 'photo'],
      },
    },
    scopes: { avecMotDePasse: { attributes: {} } },
  }
);

module.exports = Utilisateur;
