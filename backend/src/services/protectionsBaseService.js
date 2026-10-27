// Protections posées directement dans PostgreSQL, en plus de celles de
// l'application : même une requête SQL écrite à la main (ou un bug) ne peut
// pas les contourner sans d'abord les retirer explicitement.
//
//   - journal_audit en ajout seul : UPDATE, DELETE et TRUNCATE refusés ;
//   - certifications_documents : le code, la signature et le contenu
//     certifié ne se modifient plus après l'émission (seuls le statut,
//     les empreintes de fichier et les compteurs de vérification évoluent) ;
//   - contraintes de domaine : notes comprises entre 0 et 20.
const REQUETES = [
  `CREATE OR REPLACE FUNCTION edusphere_ajout_seul() RETURNS trigger AS $$
   BEGIN
     RAISE EXCEPTION 'EduSphere : la table % est en ajout seul (journal scellé)', TG_TABLE_NAME;
   END; $$ LANGUAGE plpgsql`,
  'DROP TRIGGER IF EXISTS journal_audit_ajout_seul ON journal_audit',
  `CREATE TRIGGER journal_audit_ajout_seul BEFORE UPDATE OR DELETE ON journal_audit
   FOR EACH ROW EXECUTE FUNCTION edusphere_ajout_seul()`,
  'DROP TRIGGER IF EXISTS journal_audit_sans_vidage ON journal_audit',
  `CREATE TRIGGER journal_audit_sans_vidage BEFORE TRUNCATE ON journal_audit
   FOR EACH STATEMENT EXECUTE FUNCTION edusphere_ajout_seul()`,

  `CREATE OR REPLACE FUNCTION edusphere_certification_figee() RETURNS trigger AS $$
   BEGIN
     IF NEW.code IS DISTINCT FROM OLD.code OR NEW.signature IS DISTINCT FROM OLD.signature
        OR NEW."empreinteContenu" IS DISTINCT FROM OLD."empreinteContenu" OR NEW.titre IS DISTINCT FROM OLD.titre
        OR NEW.titulaire IS DISTINCT FROM OLD.titulaire OR NEW.elements::text IS DISTINCT FROM OLD.elements::text
        OR NEW."emisLe" IS DISTINCT FROM OLD."emisLe" OR NEW."typeDocument" IS DISTINCT FROM OLD."typeDocument" THEN
       RAISE EXCEPTION 'EduSphere : le contenu certifié d''un document ne se modifie pas';
     END IF;
     RETURN NEW;
   END; $$ LANGUAGE plpgsql`,
  'DROP TRIGGER IF EXISTS certification_figee ON certifications_documents',
  `CREATE TRIGGER certification_figee BEFORE UPDATE ON certifications_documents
   FOR EACH ROW EXECUTE FUNCTION edusphere_certification_figee()`,
];

// Contraintes ajoutées seulement si absentes (ALTER TABLE ... ADD
// CONSTRAINT n'a pas de IF NOT EXISTS).
const CONTRAINTES = [
  ['notes', 'notes_cc_0_20', 'CHECK ("moyenneCC" IS NULL OR ("moyenneCC" >= 0 AND "moyenneCC" <= 20)) NOT VALID'],
  ['notes', 'notes_examen_0_20', 'CHECK ("moyenneExamen" IS NULL OR ("moyenneExamen" >= 0 AND "moyenneExamen" <= 20)) NOT VALID'],
];

async function poserProtections(sequelize) {
  for (const sql of REQUETES) {
    try {
      await sequelize.query(sql);
    } catch (err) {
      console.error('Protection PostgreSQL non posée :', err.message);
    }
  }
  for (const [table, nom, definition] of CONTRAINTES) {
    try {
      const [existe] = await sequelize.query('SELECT 1 FROM pg_constraint WHERE conname = :nom', { replacements: { nom } });
      if (!existe.length) await sequelize.query(`ALTER TABLE ${table} ADD CONSTRAINT ${nom} ${definition}`);
    } catch (err) {
      console.error(`Contrainte ${nom} non posée :`, err.message);
    }
  }
}

module.exports = { poserProtections };
