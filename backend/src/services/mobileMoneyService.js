const crypto = require('crypto');

// Fournisseurs de paiement mobile money (Airtel Money, Moov Money).
//
// MOBILE_MONEY_FOURNISSEUR choisit le fournisseur ; absent, la plateforme
// fonctionne en MODE TEST : la demande de paiement est simulée et l'étudiant
// confirme avec un code de test, aucun argent n'est débité. Pour passer au
// réel, on ajoute ici un adaptateur (E-Billing, CinetPay...) avec les mêmes
// trois fonctions, branché sur les clés du compte marchand (variables
// d'environnement de l'hébergeur, jamais dans le code) :
//   initier({ reference, montant, telephone, operateur, description }) -> { referenceFournisseur }
//   verifier(paiement) -> 'en_attente' | 'reussi' | 'echoue'
//   lireNotification(req) -> { reference, statut } | null   (rappel du fournisseur)

const CODE_TEST = '1234';

const fournisseurs = {
  test: {
    nom: 'Mode test',
    reel: false,
    async initier({ reference }) {
      return { referenceFournisseur: `TEST-${reference}` };
    },
    async verifier(paiement) {
      return paiement.statut;
    },
    lireNotification() {
      return null;
    },
  },
};

// Le mode test n'est ouvert qu'aux écoles de démonstration (adresses en
// example.com) : dans une vraie école, il permettrait de « payer » sans
// argent. Une vraie école attend le branchement de son fournisseur.
function ecoleDeDemonstration(etablissement) {
  return /(^|[.@])example\.com$/i.test(String(etablissement?.email || '').trim());
}

function fournisseurActif(etablissement = null) {
  const cle = String(process.env.MOBILE_MONEY_FOURNISSEUR || 'test').trim().toLowerCase();
  if (cle === 'test' && etablissement && !ecoleDeDemonstration(etablissement)) {
    const err = new Error('le paiement mobile money sera disponible dès que le compte marchand Airtel Money et Moov Money de l’établissement sera branché');
    err.status = 503;
    throw err;
  }
  const f = fournisseurs[cle];
  if (!f) {
    const err = new Error(`le fournisseur de paiement « ${cle} » n’est pas encore branché sur la plateforme`);
    err.status = 503;
    throw err;
  }
  return { cle, ...f };
}

function nouvelleReference() {
  return `PEL-${new Date().getFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

// Numéros gabonais : 8 ou 9 chiffres, éventuellement précédés de +241 ou 241.
function normaliserTelephone(brut) {
  const chiffres = String(brut || '').replace(/[^\d]/g, '').replace(/^241/, '');
  if (!/^0?[67]\d{7}$/.test(chiffres)) return null;
  return chiffres.startsWith('0') ? chiffres : `0${chiffres}`;
}

module.exports = { ecoleDeDemonstration, fournisseurActif, nouvelleReference, normaliserTelephone, CODE_TEST };
