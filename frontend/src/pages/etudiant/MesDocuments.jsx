import { useEffect, useState } from 'react';
import client from '../../api/client';
import BoutonDocument from '../../components/BoutonDocument';
import { IconDownload, IconDocument, IconShield } from '../../components/icons';

// Documents officiels de l'étudiant, certifiés et vérifiables par QR code :
// attestations de scolarité et d'inscription, attestation de réussite par
// semestre validé, relevé de notes officiel.
export default function MesDocuments() {
  const [semestres, setSemestres] = useState(null);
  useEffect(() => { client.get('/scolarite/semestres').then((r) => setSemestres(r.data.semestres)).catch(() => setSemestres([])); }, []);
  const valides = (semestres || []).filter((s) => s.valide);

  return (
    <>
      <div className="encart-info" style={{ marginBottom: 20 }}>
        <IconShield />
        <span>Chaque document porte un QR code et un code de vérification : un employeur ou une autre université peut en confirmer l’authenticité en ligne.</span>
      </div>
      <div className="grille-documents">
        <section className="carte carte-document">
          <div className="entete-carte"><h2><IconDocument /> Attestation de scolarité</h2></div>
          <p className="carte-document-texte">Certifie l’inscription et le suivi des enseignements pour l’année universitaire en cours.</p>
          <div className="carte-document-actions"><BoutonDocument className="primaire" chemin="/api/scolarite/attestation?type=scolarite"><IconDownload width={16} height={16} /> Télécharger</BoutonDocument></div>
        </section>
        <section className="carte carte-document">
          <div className="entete-carte"><h2><IconDocument /> Attestation d’inscription</h2></div>
          <p className="carte-document-texte">Certifie l’inscription en cours (niveau et classe), par exemple pour un dossier de bourse ou de transport.</p>
          <div className="carte-document-actions"><BoutonDocument className="primaire" chemin="/api/scolarite/attestation?type=inscription"><IconDownload width={16} height={16} /> Télécharger</BoutonDocument></div>
        </section>
        <section className="carte carte-document">
          <div className="entete-carte"><h2><IconDocument /> Relevé de notes officiel</h2></div>
          <p className="carte-document-texte">Toutes les notes, unité par unité et matière par matière, avec la moyenne, les crédits et la décision de chaque semestre.</p>
          <div className="carte-document-actions"><BoutonDocument className="primaire" chemin="/api/scolarite/releve"><IconDownload width={16} height={16} /> Télécharger</BoutonDocument></div>
        </section>
        <section className="carte carte-document">
          <div className="entete-carte"><h2><IconDocument /> Attestations de réussite</h2></div>
          <p className="carte-document-texte">Une attestation par semestre validé, avec la moyenne, la mention et les crédits obtenus.</p>
          {semestres === null && <div className="chargement">Chargement…</div>}
          {semestres && !valides.length && <div className="vide">Aucun semestre validé pour l’instant.</div>}
          <div className="carte-document-actions">
            {valides.map((s) => (
              <BoutonDocument key={s.id} className="secondaire" chemin={`/api/scolarite/attestation?type=reussite&semestreId=${s.id}`}><IconDownload width={16} height={16} /> {s.libelle} {s.anneeScolaire}</BoutonDocument>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
