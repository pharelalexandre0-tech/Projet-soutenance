// Régression logistique générique (binaire) — implémentation à la main
// plutôt qu'une bibliothèque, pour que chaque ligne soit explicable à
// l'oral : sigmoïde, descente de gradient sur l'entropie croisée binaire.
// Rien ici n'est spécifique au risque de décrochage — c'est le script
// d'entraînement (scripts/entrainerModeleRisque.js) qui construit les
// données et les caractéristiques métier.

function sigmoide(z) {
  return 1 / (1 + Math.exp(-z));
}

function predireProbabilite(caracteristiques, poids, biais) {
  const z = caracteristiques.reduce((somme, x, i) => somme + x * poids[i], biais);
  return sigmoide(z);
}

// Descente de gradient en batch (pas de mini-lots : le jeu de données est
// petit) sur la fonction de coût d'entropie croisée binaire. `X` : une
// ligne par exemple, une colonne par caractéristique (déjà normalisées
// entre 0 et 1 par l'appelant). `y` : étiquette 0/1 correspondante.
function entrainer(X, y, { tauxApprentissage = 0.5, epochs = 3000 } = {}) {
  const nExemples = X.length;
  const nCaracteristiques = X[0].length;
  let poids = new Array(nCaracteristiques).fill(0);
  let biais = 0;
  const historiqueCout = [];

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradientPoids = new Array(nCaracteristiques).fill(0);
    let gradientBiais = 0;
    let cout = 0;

    for (let i = 0; i < nExemples; i++) {
      const pred = predireProbabilite(X[i], poids, biais);
      const erreur = pred - y[i];
      for (let j = 0; j < nCaracteristiques; j++) gradientPoids[j] += erreur * X[i][j];
      gradientBiais += erreur;
      // epsilon pour éviter log(0) si une prédiction sature à 0 ou 1.
      const p = Math.min(Math.max(pred, 1e-9), 1 - 1e-9);
      cout += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
    }

    for (let j = 0; j < nCaracteristiques; j++) poids[j] -= (tauxApprentissage * gradientPoids[j]) / nExemples;
    biais -= (tauxApprentissage * gradientBiais) / nExemples;

    if (epoch % 200 === 0) historiqueCout.push({ epoch, cout: Math.round((cout / nExemples) * 1000) / 1000 });
  }

  return { poids, biais, historiqueCout };
}

function evaluer(X, y, poids, biais, seuil = 0.5) {
  let vraisPositifs = 0, fauxPositifs = 0, vraisNegatifs = 0, fauxNegatifs = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = predireProbabilite(X[i], poids, biais) >= seuil ? 1 : 0;
    if (pred === 1 && y[i] === 1) vraisPositifs++;
    else if (pred === 1 && y[i] === 0) fauxPositifs++;
    else if (pred === 0 && y[i] === 0) vraisNegatifs++;
    else fauxNegatifs++;
  }
  const exactitude = (vraisPositifs + vraisNegatifs) / X.length;
  const precision = vraisPositifs + fauxPositifs > 0 ? vraisPositifs / (vraisPositifs + fauxPositifs) : 0;
  const rappel = vraisPositifs + fauxNegatifs > 0 ? vraisPositifs / (vraisPositifs + fauxNegatifs) : 0;
  const f1 = precision + rappel > 0 ? (2 * precision * rappel) / (precision + rappel) : 0;
  return {
    exactitude: Math.round(exactitude * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    rappel: Math.round(rappel * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    matriceConfusion: { vraisPositifs, fauxPositifs, vraisNegatifs, fauxNegatifs },
  };
}

module.exports = { sigmoide, predireProbabilite, entrainer, evaluer };
