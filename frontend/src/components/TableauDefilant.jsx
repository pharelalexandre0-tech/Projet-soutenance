// Un groupe (ex. les élèves d'une classe) dont le contenu reste directement
// visible mais défile dans une hauteur bornée — jamais replié derrière un
// clic, seulement borné pour qu'une classe nombreuse n'étire plus la page
// entière. L'en-tête du tableau reste collé en haut pendant le défilement.
export default function TableauDefilant({ titre, compte, children }) {
  return (
    <div className="tableau-defilant">
      <div className="tableau-defilant-entete">
        <span className="tableau-defilant-titre">{titre}</span>
        {compte !== undefined && <span className="tableau-defilant-compte">{compte}</span>}
      </div>
      <div className="tableau-defilant-corps">{children}</div>
    </div>
  );
}
