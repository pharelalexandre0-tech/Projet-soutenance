import { useState } from 'react';

const VIDE = { parentNom: '', parentPrenom: '', parentEmail: '', parentMotDePasse: '' };

// Rattacher un parent en tapant son e-mail à l'aveugle (en espérant une
// correspondance exacte avec un compte déjà créé) était le seul moyen — la
// moindre faute de frappe passait inaperçue et créait un second compte
// parent au lieu de réutiliser le bon. Ici, un sélecteur choisit parmi les
// parents déjà connus de l'établissement ; "Nouveau parent" retombe sur la
// saisie manuelle habituelle.
export default function ChampParent({ parents, valeur, onChange, motDePasseVisible, onBasculerMotDePasseVisible }) {
  const parentExistant = parents.find((p) => p.email === valeur.parentEmail);
  const [modeNouveau, setModeNouveau] = useState(!parentExistant);

  function choisir(idBrut) {
    if (!idBrut) {
      setModeNouveau(true);
      onChange(VIDE);
      return;
    }
    const p = parents.find((pp) => String(pp.id) === idBrut);
    setModeNouveau(false);
    onChange({ parentNom: '', parentPrenom: '', parentEmail: p.email, parentMotDePasse: '' });
  }

  return (
    <>
      {parents.length > 0 && (
        <div className="champ">
          <label>Parent</label>
          <select value={modeNouveau ? '' : (parentExistant?.id ?? '')} onChange={(e) => choisir(e.target.value)}>
            <option value="">— Nouveau parent —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.email})</option>)}
          </select>
        </div>
      )}
      {!modeNouveau && parentExistant ? (
        <p className="note-secondaire" style={{ margin: 0 }}>
          Sera rattaché au compte existant de {parentExistant.prenom} {parentExistant.nom} ({parentExistant.email}).
        </p>
      ) : (
        <>
          <div className="ligne-champs">
            <div className="champ">
              <label>Prénom du parent</label>
              <input value={valeur.parentPrenom} onChange={(e) => onChange({ parentPrenom: e.target.value })} />
            </div>
            <div className="champ">
              <label>Nom du parent</label>
              <input value={valeur.parentNom} onChange={(e) => onChange({ parentNom: e.target.value })} />
            </div>
          </div>
          <div className="ligne-champs">
            <div className="champ">
              <label>E-mail du parent</label>
              <input
                type="email" autoComplete="off" required
                value={valeur.parentEmail}
                onChange={(e) => onChange({ parentEmail: e.target.value })}
              />
            </div>
            <div className="champ" style={{ flex: 1 }}>
              <label>Mot de passe (si nouveau compte)</label>
              <input
                type={motDePasseVisible ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={6}
                value={valeur.parentMotDePasse}
                onChange={(e) => onChange({ parentMotDePasse: e.target.value })}
              />
            </div>
            <button type="button" className="secondaire" style={{ alignSelf: 'flex-end', marginBottom: 1 }} onClick={onBasculerMotDePasseVisible}>
              {motDePasseVisible ? 'Masquer' : 'Afficher'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
