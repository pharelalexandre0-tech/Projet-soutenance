// À lancer avant sync({ alter: true }) : le code d'une UE n'est plus unique
// dans toute la plateforme mais par semestre et par formation (une même UE
// revient d'une année à l'autre sous le même code). sync n'efface pas les
// anciennes contraintes : elles sont retirées ici. Sans effet une fois faites.
async function migrerCodesUE(sequelize) {
  const [[table]] = await sequelize.query("SELECT to_regclass('public.unites_enseignement') AS oid");
  if (!table?.oid) return;
  const [contraintes] = await sequelize.query(`
    SELECT c.conname AS nom FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.unites_enseignement'::regclass AND c.contype = 'u'
      AND a.attname = 'code' AND array_length(c.conkey, 1) = 1`);
  for (const { nom } of contraintes) await sequelize.query(`ALTER TABLE unites_enseignement DROP CONSTRAINT "${nom}"`);
  const [index] = await sequelize.query(`
    SELECT i.relname AS nom FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY(x.indkey)
    WHERE x.indrelid = 'public.unites_enseignement'::regclass AND x.indisunique AND NOT x.indisprimary
      AND a.attname = 'code' AND x.indnatts = 1`);
  for (const { nom } of index) await sequelize.query(`DROP INDEX IF EXISTS "${nom}"`);
}

module.exports = { migrerCodesUE };
