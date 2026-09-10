import useCompteurAnime from '../hooks/useCompteurAnime';

export default function ChiffreAnime({ valeur, decimales = 0, suffixe = '', formateur }) {
  const anime = useCompteurAnime(valeur);
  const arrondi = Number(anime.toFixed(decimales));
  return <>{formateur ? formateur(arrondi) : arrondi.toFixed(decimales)}{suffixe}</>;
}
