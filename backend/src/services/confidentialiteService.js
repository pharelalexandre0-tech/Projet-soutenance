const { ParametrePlateforme } = require('../models');

// Politique de confidentialité, publique (page /confidentialite), enregistrée
// dans PostgreSQL (parametres_plateforme, clé « politique_confidentialite ») et
// modifiable par le superadmin. Ce texte n'est que la version de départ.
const CLE = 'politique_confidentialite';

const SECTIONS_PAR_DEFAUT = [
  {
    titre: 'Qui est responsable de vos données',
    contenu: "Chaque établissement qui utilise EduSphere est responsable des données de ses élèves, de leurs familles et de son personnel : c'est lui qui les saisit et décide de leur usage. EduSphere fournit et héberge la plateforme pour le compte de l'établissement, sans utiliser ces données à d'autres fins.",
  },
  {
    titre: 'Les données que nous traitons',
    contenu: "Identité et coordonnées (nom, prénom, date de naissance, adresse e-mail de l'élève et de son parent), matricule, classe, notes, absences et retards, signalements de comportement, frais de scolarité, paiements et reçus. Pour le personnel : identité, poste, salaires versés et fiches de paie. Pour tous : l'historique des connexions et des actions sensibles, nécessaire à la sécurité.",
  },
  {
    titre: 'Pourquoi nous les traitons',
    contenu: "Pour permettre à l'établissement de gérer la scolarité (inscriptions, notes, bulletins, absences, emplois du temps), de communiquer avec les élèves et leurs parents, de suivre les frais et la paie, et de sécuriser l'accès aux espaces. Aucune donnée n'est vendue, louée ni utilisée à des fins publicitaires.",
  },
  {
    titre: 'La prédiction du risque de décrochage',
    contenu: "À partir des notes de contrôle continu, de l'assiduité, du comportement et de la régularité des paiements, un modèle statistique estime pour chaque élève un risque de décrochage. Ce score est une aide destinée à l'équipe pédagogique pour proposer un accompagnement : il ne déclenche jamais de décision ni de sanction automatique. Chaque score est accompagné des signaux qui l'expliquent, et l'élève ou son parent peut en demander le détail à l'établissement.",
  },
  {
    titre: 'Qui peut voir vos données',
    contenu: "Seules les personnes habilitées de votre établissement, selon leur rôle (scolarité, finance), ainsi que l'élève et son parent pour le dossier qui les concerne. Les données d'une école ne sont jamais visibles par une autre école. L'équipe EduSphere administre la plateforme sans accéder au contenu des dossiers scolaires. Les professeurs n'accèdent qu'à la liste de la classe concernée, par un lien temporaire.",
  },
  {
    titre: 'Combien de temps nous les conservons',
    contenu: "Les données sont conservées tant que l'élève ou le membre du personnel est rattaché à l'établissement, puis selon les durées fixées par l'établissement et par la réglementation scolaire et comptable. Les journaux techniques d'envoi d'e-mails sont supprimés au bout de 90 jours.",
  },
  {
    titre: 'Comment nous les protégeons',
    contenu: "Connexion chiffrée (HTTPS), mots de passe enregistrés sous forme hachée, code de vérification envoyé par e-mail à chaque connexion d'un élève ou d'un parent, accès limité par rôle, sessions à durée limitée, verrouillage des comptes et journal des actions sensibles.",
  },
  {
    titre: 'Vos droits',
    contenu: "Conformément à la loi gabonaise n° 001/2011 relative à la protection des données à caractère personnel, vous pouvez demander l'accès à vos données, leur rectification, leur effacement lorsque la loi le permet, ou vous opposer à certains traitements. Adressez votre demande au service de la scolarité de votre établissement. En cas de difficulté, vous pouvez saisir la Commission nationale pour la protection des données à caractère personnel (CNPDCP).",
  },
  {
    titre: 'Cookies et suivi',
    contenu: "EduSphere n'utilise ni cookies publicitaires ni outil de mesure d'audience. Seule une information de session est gardée dans votre navigateur pendant que vous êtes connecté, et elle disparaît à la déconnexion. Les e-mails envoyés par la plateforme ne contiennent aucun pixel de suivi.",
  },
  {
    titre: 'Nous contacter',
    contenu: "Pour toute question sur vos données, contactez d'abord le service de la scolarité de votre établissement : ses coordonnées figurent en bas de chaque e-mail reçu de la plateforme.",
  },
];

async function lirePolitique() {
  const ligne = await ParametrePlateforme.findByPk(CLE);
  const valeur = ligne?.valeur;
  if (valeur && Array.isArray(valeur.sections) && valeur.sections.length) {
    return { sections: valeur.sections, misAJourLe: valeur.misAJourLe || ligne.updatedAt, personnalisee: true };
  }
  return { sections: SECTIONS_PAR_DEFAUT, misAJourLe: null, personnalisee: false };
}

async function enregistrerPolitique(sections) {
  const propres = (Array.isArray(sections) ? sections : [])
    .map((s) => ({ titre: String(s?.titre || '').trim().slice(0, 150), contenu: String(s?.contenu || '').trim().slice(0, 5000) }))
    .filter((s) => s.titre && s.contenu);
  if (!propres.length) {
    const erreur = new Error('ajoute au moins une section avec un titre et un texte');
    erreur.status = 400;
    throw erreur;
  }
  await ParametrePlateforme.upsert({ cle: CLE, valeur: { sections: propres, misAJourLe: new Date() } });
  return lirePolitique();
}

async function reinitialiserPolitique() {
  await ParametrePlateforme.destroy({ where: { cle: CLE } });
  return lirePolitique();
}

module.exports = { lirePolitique, enregistrerPolitique, reinitialiserPolitique };
