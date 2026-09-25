// Algorithmes d'apprentissage supervisé utilisés pour prédire le risque
// d'échec / de décrochage : forêt aléatoire (ensemble d'arbres de décision
// CART) et régression logistique régularisée, plus les mesures
// d'évaluation (exactitude, précision, rappel, F1, AUC ROC) et la
// validation croisée. Aucune dépendance externe : tout est ici.

// Générateur pseudo-aléatoire à graine (résultats reproductibles).
function generateur(graine = 42) {
  let g = graine >>> 0;
  return function alea() {
    g = (g + 0x6D2B79F5) | 0;
    let t = Math.imul(g ^ (g >>> 15), 1 | g);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function melanger(tableau, alea) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// ---------------------------------------------------------------------------
// Arbre de décision CART (critère de Gini) et forêt aléatoire
// ---------------------------------------------------------------------------

function gini(positifs, total) {
  if (!total) return 0;
  const p = positifs / total;
  return 2 * p * (1 - p);
}

function construireNoeud(X, y, indices, profondeur, options, alea, importances) {
  const total = indices.length;
  let positifs = 0;
  for (const i of indices) positifs += y[i];
  const proba = positifs / total;
  if (profondeur >= options.profondeurMax || total < 2 * options.minFeuille || positifs === 0 || positifs === total) {
    return Math.round(proba * 10000) / 10000;
  }

  const nbCaracteristiques = X[0].length;
  const candidates = melanger([...Array(nbCaracteristiques).keys()], alea).slice(0, options.caracteristiquesParNoeud);
  const impureteParent = gini(positifs, total);
  let meilleur = null;

  for (const f of candidates) {
    const tries = [...indices].sort((a, b) => X[a][f] - X[b][f]);
    let positifsGauche = 0;
    // On n'évalue qu'un nombre limité de seuils (quantiles) pour rester rapide.
    const pas = Math.max(1, Math.floor(total / options.seuilsParCaracteristique));
    for (let k = 0; k < total - 1; k += 1) {
      positifsGauche += y[tries[k]];
      const v = X[tries[k]][f];
      const suivant = X[tries[k + 1]][f];
      if (v === suivant) continue;
      const nGauche = k + 1;
      if (nGauche < options.minFeuille || total - nGauche < options.minFeuille) continue;
      if (k % pas !== 0 && nGauche !== options.minFeuille) continue;
      const impurete = (nGauche * gini(positifsGauche, nGauche) + (total - nGauche) * gini(positifs - positifsGauche, total - nGauche)) / total;
      const gain = impureteParent - impurete;
      if (!meilleur || gain > meilleur.gain) meilleur = { f, seuil: (v + suivant) / 2, gain };
    }
  }

  if (!meilleur || meilleur.gain <= 1e-7) return Math.round(proba * 10000) / 10000;
  importances[meilleur.f] += meilleur.gain * total;
  const gauche = indices.filter((i) => X[i][meilleur.f] <= meilleur.seuil);
  const droite = indices.filter((i) => X[i][meilleur.f] > meilleur.seuil);
  return [
    meilleur.f,
    Math.round(meilleur.seuil * 10000) / 10000,
    construireNoeud(X, y, gauche, profondeur + 1, options, alea, importances),
    construireNoeud(X, y, droite, profondeur + 1, options, alea, importances),
  ];
}

function predireArbre(noeud, x) {
  let n = noeud;
  while (Array.isArray(n)) n = x[n[0]] <= n[1] ? n[2] : n[3];
  return n;
}

// Hyperparamètres retenus par validation croisée (AUC) sur la cohorte de référence.
const OPTIONS_FORET = { nbArbres: 120, profondeurMax: 10, minFeuille: 4, seuilsParCaracteristique: 40, caracteristiquesParNoeud: 5, graine: 7 };

// Forêt aléatoire : chaque arbre apprend sur un échantillon tiré avec
// remise (bootstrap) et ne regarde qu'une partie des caractéristiques à
// chaque division ; la prédiction est la moyenne des arbres.
function entrainerForet(X, y, options = {}) {
  const o = { ...OPTIONS_FORET, ...options };
  o.caracteristiquesParNoeud = o.caracteristiquesParNoeud || Math.max(2, Math.round(Math.sqrt(X[0].length)));
  const alea = generateur(o.graine);
  const importances = new Array(X[0].length).fill(0);
  const arbres = [];
  for (let t = 0; t < o.nbArbres; t += 1) {
    const echantillon = Array.from({ length: X.length }, () => Math.floor(alea() * X.length));
    arbres.push(construireNoeud(X, y, echantillon, 0, o, alea, importances));
  }
  const somme = importances.reduce((a, b) => a + b, 0) || 1;
  return {
    type: 'foret_aleatoire',
    parametres: { nbArbres: o.nbArbres, profondeurMax: o.profondeurMax, minFeuille: o.minFeuille, caracteristiquesParNoeud: o.caracteristiquesParNoeud },
    arbres,
    importances: importances.map((v) => v / somme),
  };
}

// ---------------------------------------------------------------------------
// Régression logistique (variables standardisées, régularisation L2)
// ---------------------------------------------------------------------------

const sigmoide = (z) => 1 / (1 + Math.exp(-z));

function entrainerRegression(X, y, { tauxApprentissage = 0.3, epoques = 1500, lambda = 0.01 } = {}) {
  const d = X[0].length;
  const moyennes = new Array(d).fill(0);
  const ecarts = new Array(d).fill(0);
  X.forEach((x) => x.forEach((v, j) => { moyennes[j] += v / X.length; }));
  X.forEach((x) => x.forEach((v, j) => { ecarts[j] += (v - moyennes[j]) ** 2 / X.length; }));
  for (let j = 0; j < d; j += 1) ecarts[j] = Math.sqrt(ecarts[j]) || 1;
  const Z = X.map((x) => x.map((v, j) => (v - moyennes[j]) / ecarts[j]));

  const poids = new Array(d).fill(0);
  let biais = 0;
  for (let e = 0; e < epoques; e += 1) {
    const gradient = new Array(d).fill(0);
    let gradientBiais = 0;
    for (let i = 0; i < Z.length; i += 1) {
      const erreur = sigmoide(Z[i].reduce((s, v, j) => s + v * poids[j], biais)) - y[i];
      for (let j = 0; j < d; j += 1) gradient[j] += erreur * Z[i][j];
      gradientBiais += erreur;
    }
    for (let j = 0; j < d; j += 1) poids[j] -= tauxApprentissage * (gradient[j] / Z.length + lambda * poids[j]);
    biais -= tauxApprentissage * (gradientBiais / Z.length);
  }
  const somme = poids.reduce((a, w) => a + Math.abs(w), 0) || 1;
  return {
    type: 'regression_logistique',
    parametres: { epoques, tauxApprentissage, lambda },
    moyennes, ecarts, poids, biais,
    importances: poids.map((w) => Math.abs(w) / somme),
  };
}

// ---------------------------------------------------------------------------
// Prédiction commune
// ---------------------------------------------------------------------------

function predireProbabilite(modele, x) {
  if (modele.type === 'foret_aleatoire') {
    return modele.arbres.reduce((s, arbre) => s + predireArbre(arbre, x), 0) / modele.arbres.length;
  }
  const z = x.reduce((s, v, j) => s + ((v - modele.moyennes[j]) / modele.ecarts[j]) * modele.poids[j], modele.biais);
  return sigmoide(z);
}

// ---------------------------------------------------------------------------
// Évaluation
// ---------------------------------------------------------------------------

// Aire sous la courbe ROC : probabilité qu'un élève réellement en échec
// reçoive un score plus élevé qu'un élève qui réussit.
function auc(y, probas) {
  const paires = y.map((v, i) => [probas[i], v]).sort((a, b) => a[0] - b[0]);
  let rang = 0;
  let sommeRangsPositifs = 0;
  let i = 0;
  while (i < paires.length) {
    let j = i;
    while (j < paires.length && paires[j][0] === paires[i][0]) j += 1;
    const rangMoyen = (rang + 1 + rang + (j - i)) / 2;
    for (let k = i; k < j; k += 1) if (paires[k][1] === 1) sommeRangsPositifs += rangMoyen;
    rang += j - i;
    i = j;
  }
  const nPos = y.filter((v) => v === 1).length;
  const nNeg = y.length - nPos;
  if (!nPos || !nNeg) return 0.5;
  return (sommeRangsPositifs - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

function mesures(y, probas, seuil = 0.5) {
  let vp = 0; let fp = 0; let vn = 0; let fn = 0;
  y.forEach((v, i) => {
    const pred = probas[i] >= seuil ? 1 : 0;
    if (pred && v) vp += 1; else if (pred && !v) fp += 1; else if (!pred && !v) vn += 1; else fn += 1;
  });
  const precision = vp + fp ? vp / (vp + fp) : 0;
  const rappel = vp + fn ? vp / (vp + fn) : 0;
  const arrondi = (v) => Math.round(v * 1000) / 1000;
  return {
    exactitude: arrondi((vp + vn) / y.length),
    precision: arrondi(precision),
    rappel: arrondi(rappel),
    f1: arrondi(precision + rappel ? (2 * precision * rappel) / (precision + rappel) : 0),
    auc: arrondi(auc(y, probas)),
    matriceConfusion: { vraisPositifs: vp, fauxPositifs: fp, vraisNegatifs: vn, fauxNegatifs: fn },
  };
}

// Validation croisée à k plis : moyenne et écart-type de l'AUC.
function validationCroisee(X, y, entrainer, k = 5, graine = 11) {
  const alea = generateur(graine);
  const indices = melanger([...Array(X.length).keys()], alea);
  const scores = [];
  for (let pli = 0; pli < k; pli += 1) {
    const test = indices.filter((_, i) => i % k === pli);
    const apprentissage = indices.filter((_, i) => i % k !== pli);
    const modele = entrainer(apprentissage.map((i) => X[i]), apprentissage.map((i) => y[i]));
    scores.push(auc(test.map((i) => y[i]), test.map((i) => predireProbabilite(modele, X[i]))));
  }
  const m = scores.reduce((a, b) => a + b, 0) / k;
  const ecart = Math.sqrt(scores.reduce((a, s) => a + (s - m) ** 2, 0) / k);
  return { aucMoyenne: Math.round(m * 1000) / 1000, aucEcartType: Math.round(ecart * 1000) / 1000, plis: k };
}

module.exports = {
  generateur, melanger, entrainerForet, entrainerRegression, predireProbabilite, mesures, validationCroisee, auc,
};
