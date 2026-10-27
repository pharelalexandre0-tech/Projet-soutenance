// Fil de chargement aux quatre couleurs d'EduSphere : les brins se tissent
// l'un après l'autre, puis recommencent tant que l'écran reste affiché.
export default function FilOuverture() {
  return (
    <span className="fil-ouverture" aria-hidden="true">
      <span className="brin bleu" />
      <span className="brin teal" />
      <span className="brin vert" />
      <span className="brin or" />
    </span>
  );
}
