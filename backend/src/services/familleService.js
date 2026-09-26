const { fn, col, where } = require('sequelize');
const { Eleve, Utilisateur } = require('../models');
const { envoyerEmail } = require('./emailService');

// Le parent n'a pas de compte à lui : il ouvre le compte étudiant de son
// enfant avec sa propre adresse (Eleve.emailParent) et le même mot de passe,
// le matricule. Une notification déposée sur ce compte est donc vue par les
// deux ; les e-mails, eux, partent aux deux adresses.

function normaliserEmail(adresse) {
  return String(adresse || '').trim().toLowerCase();
}

// Adresses de l'étudiant et de son parent, sans doublon.
function adressesFamille(eleve) {
  const vues = new Set();
  return [eleve?.compteEtudiant?.email, eleve?.emailParent].filter((adresse) => {
    const cle = normaliserEmail(adresse);
    if (!cle || vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

// Même e-mail à l'étudiant et à son parent. `eleve` doit inclure son
// compteEtudiant. Renvoie les adresses effectivement visées.
async function envoyerALaFamille(eleve, sujet, texte, piecesJointes = [], options = {}) {
  const adresses = adressesFamille(eleve);
  for (const adresse of adresses) {
    await envoyerEmail(adresse, sujet, texte, piecesJointes, options);
  }
  return adresses;
}

// Dossiers dont l'adresse est celle du parent (un même parent peut avoir
// plusieurs enfants dans la plateforme), avec le compte étudiant et son
// mot de passe haché pour vérifier la connexion.
async function dossiersDuParent(email) {
  const cle = normaliserEmail(email);
  if (!cle) return [];
  return Eleve.findAll({
    where: where(fn('lower', col('emailParent')), cle),
    include: [{ model: Utilisateur.scope('avecMotDePasse'), as: 'compteEtudiant', where: { role: 'etudiant' } }],
    order: [['id', 'ASC']],
  });
}

// Refuse une adresse parent identique à celle de l'élève (le parent doit
// pouvoir se connecter avec SA propre adresse).
function erreurEmailParent(emailParent, emailEleve) {
  if (!emailParent) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParent)) return "l'adresse e-mail du parent est invalide";
  if (normaliserEmail(emailParent) === normaliserEmail(emailEleve)) {
    return "l'e-mail du parent doit être différent de celui de l'élève";
  }
  return null;
}

module.exports = { adressesFamille, envoyerALaFamille, dossiersDuParent, erreurEmailParent };
