// Passage des anciens comptes Parent au modèle actuel : le parent n'a plus
// de compte à lui, seulement une adresse rattachée à l'élève
// (eleves.emailParent) avec laquelle il ouvre le compte étudiant de son
// enfant.
//
// Doit tourner AVANT sequelize.sync({ alter: true }) : la synchronisation
// supprime la colonne eleves.parentId, qui ne figure plus dans le modèle, et
// avec elle le lien vers l'adresse du parent. Sans effet sur une base neuve
// ou déjà migrée.
async function migrerComptesParents(sequelize) {
  // to_regclass plutôt qu'une lecture de information_schema.tables :
  // Sequelize réinterprète ce type de requête (liste des tables) et n'en
  // renvoie qu'une partie.
  const [[existe]] = await sequelize.query(
    "SELECT to_regclass('public.eleves') IS NOT NULL AS eleves, to_regclass('public.utilisateurs') IS NOT NULL AS utilisateurs"
  );
  if (!existe.eleves || !existe.utilisateurs) return;

  await sequelize.query('ALTER TABLE eleves ADD COLUMN IF NOT EXISTS "emailParent" VARCHAR(255)');
  const [[colonne]] = await sequelize.query(
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'eleves' AND column_name = 'parentId'"
  );
  if (colonne.n > 0) {
    await sequelize.query(`
      UPDATE eleves e SET "emailParent" = u.email
      FROM utilisateurs u
      WHERE e."parentId" = u.id AND e."emailParent" IS NULL`);
    await sequelize.query('UPDATE eleves SET "parentId" = NULL WHERE "parentId" IS NOT NULL');
  }

  const [parents] = await sequelize.query("SELECT id FROM utilisateurs WHERE role::text = 'parent'");
  if (parents.length === 0) return;
  const ids = parents.map((p) => p.id);
  await sequelize.query('DELETE FROM notifications WHERE "utilisateurId" IN (:ids)', { replacements: { ids } });
  await sequelize.query('DELETE FROM utilisateurs WHERE id IN (:ids)', { replacements: { ids } });
  console.log(`[Migration] ${ids.length} ancien(s) compte(s) parent remplacé(s) par l'adresse e-mail rattachée à l'élève.`);
}

// Après la synchronisation : l'espace Parents n'existe plus (le parent voit
// l'espace Étudiant de son enfant), les fonctionnalités et notes de version
// qui le visaient visent désormais l'espace Étudiant.
async function fusionnerEspaceParents() {
  const { FonctionnalitePersonnalisee, MiseAJour } = require('../models');
  for (const Modele of [FonctionnalitePersonnalisee, MiseAJour]) {
    const lignes = await Modele.findAll();
    for (const ligne of lignes) {
      const espaces = Array.isArray(ligne.espaces) ? ligne.espaces : [];
      if (!espaces.includes('parent')) continue;
      ligne.espaces = [...new Set(espaces.map((e) => (e === 'parent' ? 'etudiant' : e)))];
      await ligne.save();
    }
  }
}

module.exports = { migrerComptesParents, fusionnerEspaceParents };
