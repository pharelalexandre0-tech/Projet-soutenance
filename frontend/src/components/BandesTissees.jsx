import Tissage from './Tissage';

// Motif tissé en haut et en bas d'un écran d'ouverture marine : le centre
// reste libre pour le logo et le nom, sans aucun encadré.
export default function BandesTissees() {
  return (
    <>
      <div className="ouverture-bande haut" aria-hidden="true"><Tissage colonnes={10} lignes={3} /></div>
      <div className="ouverture-bande bas" aria-hidden="true"><Tissage colonnes={10} lignes={3} /></div>
    </>
  );
}
