// Régime juridique des établissements d'enseignement supérieur au Gabon,
// tel qu'appliqué par le Ministère de l'Enseignement Supérieur et de la
// Recherche Scientifique (MESRS) :
//   - établissement privé : deux actes successifs, l'habilitation à fonder
//     puis l'autorisation d'ouverture (décrets, pris après avis de la
//     Commission pour l'Enseignement Supérieur Privé, la CESP) ; le
//     ministère peut ensuite mettre en demeure, suspendre ou fermer un
//     établissement non conforme ;
//   - université ou établissement public : créé par un texte (loi ou décret).
// Les intitulés restent modifiables ici sans toucher au reste du code.
const STATUTS_TUTELLE = ['dossier_depose', 'habilite', 'autorise', 'cree_par_texte', 'mise_en_demeure', 'suspendu', 'ferme'];

const LIBELLES_TUTELLE = {
  dossier_depose: 'Dossier déposé, en instruction',
  habilite: 'Habilité à fonder',
  autorise: 'Autorisé à ouvrir',
  cree_par_texte: 'Établissement public',
  mise_en_demeure: 'Mis en demeure',
  suspendu: 'Suspendu',
  ferme: 'Fermé',
};

// Acte qui porte chaque décision (sert aux libellés et au numéro exigé).
const ACTES = {
  habilite: { acte: 'décret', obligatoire: true, exemple: 'Décret n° 0000/PR/MESRS' },
  autorise: { acte: 'décret', obligatoire: true, exemple: 'Décret n° 0000/PR/MESRS' },
  cree_par_texte: { acte: 'texte de création', obligatoire: true, exemple: 'Loi ou décret n° 0000/PR' },
  mise_en_demeure: { acte: 'lettre de mise en demeure', obligatoire: false, exemple: 'N° 0000/MESRS/SG' },
  suspendu: { acte: 'arrêté', obligatoire: false, exemple: 'Arrêté n° 0000/MESRS' },
  ferme: { acte: 'arrêté', obligatoire: false, exemple: 'Arrêté n° 0000/MESRS' },
  dossier_depose: { acte: 'récépissé de dépôt', obligatoire: false, exemple: 'Récépissé n° 0000' },
};

// Statuts qui permettent d'accueillir des étudiants.
const EN_ACTIVITE = ['autorise', 'cree_par_texte'];
// Statuts soumis à un avis préalable de la CESP (établissements privés).
const AVIS_CESP_REQUIS = { habilite: 'habilitation', autorise: 'autorisation' };
const OBJETS_CESP = ['habilitation', 'autorisation', 'renouvellement', 'controle'];
const LIBELLES_OBJET_CESP = { habilitation: 'Habilitation à fonder', autorisation: "Autorisation d'ouverture", renouvellement: 'Renouvellement', controle: 'Contrôle de conformité' };
const AVIS_CESP = ['favorable', 'reserves', 'defavorable'];
const LIBELLES_AVIS_CESP = { favorable: 'Favorable', reserves: 'Favorable avec réserves', defavorable: 'Défavorable' };

// Grille de conformité : points vérifiés par les agents (inspection, dossier).
const POINTS_CONFORMITE = [
  ['conventionEtat', "Convention signée avec l'État"],
  ['quitusFiscal', 'Quitus fiscal à jour'],
  ['locauxConformes', 'Locaux conformes (hygiène et sécurité)'],
  ['equipementsPedagogiques', 'Bibliothèque, salles et équipements pédagogiques'],
  ['diplomesEnseignantsVerifies', 'Diplômes des enseignants vérifiés'],
];

// Anciennes valeurs (agrément générique) vers le régime gabonais.
const ANCIENS_STATUTS = { en_instruction: 'dossier_depose', provisoire: 'habilite', agree: 'autorise', retire: 'ferme' };

// À lancer avant sync({ alter: true }) : convertit les statuts déjà en base.
// Une université publique « agréée » devient « établissement public ».
async function migrerStatutsTutelle(sequelize) {
  const [[table]] = await sequelize.query("SELECT to_regclass('public.etablissements') AS oid");
  if (!table?.oid) return;
  await sequelize.query(`UPDATE etablissements SET "agrementStatut" = 'cree_par_texte'
    WHERE "agrementStatut" = 'agree' AND "typeEtablissement" = 'universite_publique'`);
  for (const [ancien, nouveau] of Object.entries(ANCIENS_STATUTS)) {
    await sequelize.query('UPDATE etablissements SET "agrementStatut" = :nouveau WHERE "agrementStatut" = :ancien', { replacements: { ancien, nouveau } });
  }
  await sequelize.query(`ALTER TABLE etablissements ALTER COLUMN "agrementStatut" SET DEFAULT 'dossier_depose'`).catch(() => {});
  const [[decisions]] = await sequelize.query("SELECT to_regclass('public.decisions_agrement') AS oid");
  if (!decisions?.oid) return;
  for (const [ancien, nouveau] of Object.entries(ANCIENS_STATUTS)) {
    await sequelize.query('UPDATE decisions_agrement SET statut = :nouveau WHERE statut = :ancien', { replacements: { ancien, nouveau } });
  }
}

// Grille de conformité d'un établissement : points saisis par le ministère
// et indicateurs calculés à partir des données de l'école.
function evaluerConformite(fiche) {
  const saisie = fiche.conformite || {};
  const points = POINTS_CONFORMITE.map(([cle, libelle]) => ({ cle, libelle, valeur: saisie[cle] === true ? true : saisie[cle] === false ? false : null }));
  const capacite = Number(saisie.capaciteAccueil) || null;
  const automatiques = [
    {
      cle: 'capacite', libelle: "Effectif dans la capacité d'accueil déclarée",
      valeur: capacite ? fiche.effectif <= capacite : null,
      detail: capacite ? `${fiche.effectif} étudiants pour ${capacite} places` : 'capacité non renseignée',
    },
    {
      cle: 'lmd', libelle: 'Semestres organisés à 30 crédits ECTS (LMD)',
      valeur: fiche.semestresLmd ? fiche.semestresLmdConformes === fiche.semestresLmd : null,
      detail: fiche.semestresLmd ? `${fiche.semestresLmdConformes} sur ${fiche.semestresLmd} semestres` : 'aucune maquette saisie',
    },
  ];
  const permanents = fiche.enseignants ? Math.round((fiche.enseignantsPermanents / fiche.enseignants) * 1000) / 10 : null;
  const tous = [...points, ...automatiques].filter((p) => p.valeur !== null);
  return {
    points,
    automatiques,
    capaciteAccueil: capacite,
    enseignantsPermanents: fiche.enseignantsPermanents || 0,
    tauxPermanents: permanents,
    observations: saisie.observations || '',
    verifieLe: saisie.verifieLe || null,
    verifieParNom: saisie.verifieParNom || null,
    satisfaits: tous.filter((p) => p.valeur).length,
    evalues: tous.length,
  };
}

module.exports = {
  STATUTS_TUTELLE, LIBELLES_TUTELLE, ACTES, EN_ACTIVITE, AVIS_CESP_REQUIS, OBJETS_CESP, LIBELLES_OBJET_CESP, AVIS_CESP, LIBELLES_AVIS_CESP,
  POINTS_CONFORMITE, migrerStatutsTutelle, evaluerConformite,
};
