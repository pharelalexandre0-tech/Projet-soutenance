import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import logoIcon from '../assets/logo-icon.png';
import { IconShield, IconArrowLeft } from '../components/icons';

function dateLongue(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Politique de confidentialité, publique : le texte vient de la base
// (modifiable par le superadmin), avec un sommaire pour s'y retrouver.
export default function Confidentialite() {
  const [politique, setPolitique] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    document.title = 'Politique de confidentialité · EduSphere';
    client.get('/plateforme/confidentialite').then((res) => setPolitique(res.data)).catch(() => setErreur(true));
  }, []);

  return (
    <div className="page-confidentialite">
      <header className="confidentialite-bandeau">
        <div className="confidentialite-bandeau-interieur">
          <Link to="/connexion" className="confidentialite-retour"><IconArrowLeft /> Retour à la connexion</Link>
          <div className="confidentialite-marque">
            <span className="confidentialite-logo"><img src={logoIcon} alt="" /></span>
            <span>EduSphere</span>
          </div>
          <span className="confidentialite-pastille"><IconShield /> Vos données</span>
          <h1>Politique de confidentialité</h1>
          <p>
            Comment EduSphere et votre établissement traitent et protègent les données des élèves, des familles et du personnel.
            {politique?.misAJourLe && <> Dernière mise à jour le {dateLongue(politique.misAJourLe)}.</>}
          </p>
        </div>
      </header>
      <main className="confidentialite-corps">
        {!politique && !erreur && <div className="chargement">Chargement…</div>}
        {erreur && <div className="vide">La politique de confidentialité est momentanément indisponible. Réessayez dans un instant.</div>}
        {politique && (
          <div className="confidentialite-grille">
            <nav className="confidentialite-sommaire" aria-label="Sommaire">
              <strong>Sommaire</strong>
              <ol>
                {politique.sections.map((s, i) => <li key={i}><a href={`#section-${i + 1}`}>{s.titre}</a></li>)}
              </ol>
            </nav>
            <article className="confidentialite-texte">
              {politique.sections.map((s, i) => (
                <section key={i} id={`section-${i + 1}`}>
                  <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.titre}</h2>
                  {s.contenu.split(/\n{2,}/).map((p, j) => <p key={j}>{p}</p>)}
                </section>
              ))}
            </article>
          </div>
        )}
      </main>
      <footer className="confidentialite-pied">© {new Date().getFullYear()} EduSphere, plateforme de gestion scolaire</footer>
    </div>
  );
}
