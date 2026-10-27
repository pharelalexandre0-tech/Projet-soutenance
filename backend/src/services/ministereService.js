// Données nationales du Ministère de l'Enseignement supérieur.
//
// Le ministère ne lit JAMAIS les tables des écoles : seulement des vues
// agrégées (effectifs, résultats, assiduité, risques, documents), à travers
// un rôle PostgreSQL dédié (edusphere_ministere) qui n'a de droit qu'en
// lecture sur ces vues. Une requête du ministère qui viserait la table des
// élèves ou des notes serait refusée par PostgreSQL lui-même, pas
// seulement par l'application.
const ROLE = 'edusphere_ministere';
let roleDisponible = false;

// Province de chaque ville du Gabon (repli : à préciser par le superadmin).
const PROVINCES = {
  Estuaire: ['libreville', 'owendo', 'akanda', 'ntoum', 'kango', 'cocobeach', 'cap esterias'],
  'Haut-Ogooué': ['franceville', 'moanda', 'mounana', 'okondja', 'leconi', 'akieni', 'boumango', 'bongoville'],
  'Moyen-Ogooué': ['lambaréné', 'lambarene', 'ndjolé', 'ndjole'],
  Ngounié: ['mouila', 'fougamou', 'ndendé', 'ndende', 'mbigou', 'mimongo', 'lébamba', 'lebamba'],
  Nyanga: ['tchibanga', 'mayumba', 'moabi'],
  'Ogooué-Ivindo': ['makokou', 'booué', 'boue', 'mékambo', 'mekambo', 'ovan'],
  'Ogooué-Lolo': ['koulamoutou', 'lastoursville', 'pana', 'iboundji'],
  'Ogooué-Maritime': ['port-gentil', 'port gentil', 'omboué', 'ombooue', 'gamba'],
  'Woleu-Ntem': ['oyem', 'bitam', 'mitzic', 'minvoul', 'médouneu', 'medouneu'],
};
const LISTE_PROVINCES = Object.keys(PROVINCES);

function provinceDe(ville) {
  const v = String(ville || '').trim().toLowerCase();
  return LISTE_PROVINCES.find((p) => PROVINCES[p].includes(v)) || null;
}

const VUES = [
  `CREATE OR REPLACE VIEW vue_ministere_etablissements AS
   SELECT e.id, e.nom, e.sigle, e.ville, e.province, e."typeEtablissement", e."agrementStatut", e."agrementNumero",
          e."agrementDate", e."agrementExpiration", e.statut, e."createdAt", e."seuilValidation",
          (SELECT count(*) FROM eleves el WHERE el."etablissementId" = e.id)::int AS effectif,
          (SELECT count(*) FROM classes c WHERE c."etablissementId" = e.id)::int AS classes,
          (SELECT count(*) FROM professeurs p WHERE p."etablissementId" = e.id)::int AS enseignants
   FROM etablissements e`,
  // Moyenne de chaque étudiant (notes finales (CC + examen) / 2 pondérées
  // par les coefficients), puis agrégat par établissement et par niveau :
  // aucun nom ne sort de la vue.
  `CREATE OR REPLACE VIEW vue_ministere_resultats AS
   WITH moyennes AS (
     SELECT el."etablissementId" AS etab, coalesce(c.niveau, 'Non classé') AS niveau, el.id AS eleve,
            sum(((coalesce(n."moyenneCC", n."moyenneExamen") + coalesce(n."moyenneExamen", n."moyenneCC")) / 2) * coalesce(m.coefficient, 1))
              / nullif(sum(coalesce(m.coefficient, 1)), 0) AS moyenne
     FROM notes n
     JOIN eleves el ON el.id = n."eleveId"
     LEFT JOIN classes c ON c.id = el."classeId"
     JOIN matieres m ON m.id = n."matiereId"
     WHERE n.session = 'normale' AND (n."moyenneCC" IS NOT NULL OR n."moyenneExamen" IS NOT NULL)
     GROUP BY el."etablissementId", c.niveau, el.id
   )
   SELECT mo.etab AS "etablissementId", mo.niveau, count(*)::int AS evalues,
          round(avg(mo.moyenne)::numeric, 2)::float AS moyenne,
          count(*) FILTER (WHERE mo.moyenne >= coalesce(e."seuilValidation", 10))::int AS admis
   FROM moyennes mo JOIN etablissements e ON e.id = mo.etab
   GROUP BY mo.etab, mo.niveau`,
  `CREATE OR REPLACE VIEW vue_ministere_assiduite AS
   SELECT el."etablissementId", count(*) FILTER (WHERE a.type <> 'retard' AND NOT a.justifie)::int AS absences_non_justifiees,
          count(*) FILTER (WHERE a.type <> 'retard' AND a.justifie)::int AS absences_justifiees,
          count(*) FILTER (WHERE a.type = 'retard')::int AS retards,
          count(DISTINCT a."eleveId")::int AS etudiants_concernes
   FROM absences a JOIN eleves el ON el.id = a."eleveId"
   GROUP BY el."etablissementId"`,
  `CREATE OR REPLACE VIEW vue_ministere_risques AS
   WITH dernieres AS (
     SELECT DISTINCT ON (p."eleveId") p."eleveId", p."niveauRisque"
     FROM predictions_ia p ORDER BY p."eleveId", p."dateCalcul" DESC
   )
   SELECT el."etablissementId", count(*) FILTER (WHERE d."niveauRisque" = 'eleve')::int AS risque_eleve,
          count(*) FILTER (WHERE d."niveauRisque" = 'moyen')::int AS risque_moyen,
          count(*) FILTER (WHERE d."niveauRisque" = 'faible')::int AS risque_faible
   FROM dernieres d JOIN eleves el ON el.id = d."eleveId"
   GROUP BY el."etablissementId"`,
  `CREATE OR REPLACE VIEW vue_ministere_documents AS
   SELECT "etablissementId", "typeDocument", statut, count(*)::int AS nombre, sum("nombreVerifications")::int AS verifications
   FROM certifications_documents GROUP BY "etablissementId", "typeDocument", statut`,
];
const NOMS_VUES = ['vue_ministere_etablissements', 'vue_ministere_resultats', 'vue_ministere_assiduite', 'vue_ministere_risques', 'vue_ministere_documents'];

// Avant la synchronisation des modèles (sync alter) : les vues sont
// retirées, sinon PostgreSQL refuse de retoucher les colonnes qu'elles
// lisent. Elles sont recréées juste après par preparerBaseMinistere.
async function retirerVuesMinistere(sequelize) {
  for (const vue of [...NOMS_VUES].reverse()) {
    await sequelize.query(`DROP VIEW IF EXISTS ${vue}`);
  }
}

// Au démarrage : vues, rôle restreint et provinces manquantes.
async function preparerBaseMinistere(sequelize) {
  const { Etablissement } = require('../models');
  for (const e of await Etablissement.findAll({ where: { province: null } })) {
    const province = provinceDe(e.ville);
    if (province) await e.update({ province });
  }
  for (const sql of VUES) {
    try { await sequelize.query(sql); } catch (err) { console.error('Vue du ministère non créée :', err.message); }
  }
  try {
    const [[existe]] = await sequelize.query(`SELECT count(*)::int AS n FROM pg_roles WHERE rolname = '${ROLE}'`);
    if (!existe.n) await sequelize.query(`CREATE ROLE ${ROLE} NOLOGIN`);
    await sequelize.query(`GRANT ${ROLE} TO CURRENT_USER`).catch(() => {});
    await sequelize.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    await sequelize.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
    await sequelize.query(`GRANT SELECT ON ${NOMS_VUES.join(', ')} TO ${ROLE}`);
    // Contrôle : le rôle peut-il être endossé ?
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SET LOCAL ROLE ${ROLE}`, { transaction });
    });
    roleDisponible = true;
  } catch (err) {
    roleDisponible = false;
    console.error('Rôle PostgreSQL du ministère indisponible (lecture par l\'application seule) :', err.message);
  }
}

// Exécute une lecture nationale sous le rôle restreint.
async function lireNational(sql, replacements = {}) {
  const sequelize = require('../config/db');
  return sequelize.transaction(async (transaction) => {
    if (roleDisponible) await sequelize.query(`SET LOCAL ROLE ${ROLE}`, { transaction });
    const [lignes] = await sequelize.query(sql, { replacements, transaction });
    return lignes;
  });
}

const etatRole = () => roleDisponible;

module.exports = { preparerBaseMinistere, retirerVuesMinistere, lireNational, provinceDe, LISTE_PROVINCES, etatRole };
