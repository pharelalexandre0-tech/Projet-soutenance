const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Classe Utilisateur du diagramme de classes : regroupe Academie, Finance et
// Parent (le Professeur n'a volontairement PAS de compte permanent, voir
// CompteEphemere). Le champ `role` fait office de discriminant plutot que
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
    role: { type: DataTypes.ENUM('superadmin', 'academie', 'finance', 'parent'), allowNull: false },
    // specifique Academie
    service: { type: DataTypes.STRING, allowNull: true },
    // specifique Finance
    fonction: { type: DataTypes.STRING, allowNull: true },
    // Verrouillage d'un compte précis par le superadmin — distinct de la
    // suspension d'un établissement entier (qui verrouille tous ses comptes
    // d'un coup, voir Etablissement.statut).
    statut: { type: DataTypes.ENUM('actif', 'verrouille'), allowNull: false, defaultValue: 'actif' },
  },
  {
    sequelize,
    modelName: 'Utilisateur',
    tableName: 'utilisateurs',
    // Le hash du mot de passe ne doit jamais sortir dans une réponse JSON,
    // y compris quand Utilisateur est inclus en relation imbriquée (ex.
    // parent d'un élève). Le scope "avecMotDePasse" (auth uniquement)
    // permet de le récupérer explicitement pour la vérification bcrypt.
    defaultScope: { attributes: { exclude: ['motDePasse'] } },
    scopes: { avecMotDePasse: { attributes: {} } },
  }
);

module.exports = Utilisateur;
