const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Classe Utilisateur du diagramme de classes : regroupe Academie, Finance et
// Etudiant (le Professeur n'a volontairement PAS de compte permanent, voir
// CompteEphemere). Plateforme universitaire : c'est l'étudiant lui-même qui
// a un compte et consulte son propre dossier, pas un parent. Le champ `role`
// fait office de discriminant plutot que
// des sous-classes Sequelize separees, avec deux colonnes optionnelles qui
// ne servent qu'a un seul role (service pour Academie, fonction pour
// Finance) pour rester fidele au modele de domaine.
class Utilisateur extends Model {
  toPublicJSON() {
    const { id, nom, prenom, email, role, service, fonction, etablissementId, statut, createdAt } = this;
    return { id, nom, prenom, email, role, service, fonction, etablissementId, statut, createdAt };
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
    role: { type: DataTypes.ENUM('superadmin', 'academie', 'finance', 'etudiant'), allowNull: false },
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
    // "Mot de passe oublié" : jeton aléatoire à usage unique envoyé par
    // e-mail, même principe de durée de vie courte que le code 2FA
    // ci-dessus. Nul en dehors d'une réinitialisation en cours.
    tokenReinitialisation: { type: DataTypes.STRING, allowNull: true },
    tokenReinitialisationExpire: { type: DataTypes.DATE, allowNull: true },
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
    defaultScope: { attributes: { exclude: ['motDePasse', 'codeDoubleFacteur', 'codeDoubleFacteurExpire', 'tokenReinitialisation', 'tokenReinitialisationExpire'] } },
    scopes: { avecMotDePasse: { attributes: {} } },
  }
);

module.exports = Utilisateur;
