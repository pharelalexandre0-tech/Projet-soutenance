// Réglages et comportement des fonctionnalités personnalisées "actives"
// (assistant, formulaire, registre), créées par le superadmin sans code.
// Tout ce qu'elles produisent est enregistré dans PostgreSQL
// (EntreeExtension), école par école.

const TYPES_INTERACTIFS = ['assistant', 'formulaire', 'registre'];
const TYPES_CHAMPS = ['texte', 'long', 'nombre', 'date', 'choix', 'email', 'telephone'];
const TYPES_COLONNES = ['texte', 'long', 'nombre', 'date', 'lien'];

const LIMITES = {
  questions: 60,
  champs: 15,
  colonnes: 8,
  options: 20,
};

function texte(valeur, max) {
  return String(valeur ?? '').trim().slice(0, max);
}

function identifiant(libelle, index, dejaPris) {
  const base = normaliser(libelle).replace(/\s+/g, '-').slice(0, 30) || `champ-${index + 1}`;
  let id = base;
  let n = 2;
  while (dejaPris.has(id)) id = `${base}-${n++}`;
  dejaPris.add(id);
  return id;
}

// ---- Validation des réglages (création / modification par le superadmin) --

function lireAssistant(brut) {
  const accueil = texte(brut?.accueil, 300)
    || 'Bonjour, je suis là pour répondre à vos questions. Écrivez votre question ou choisissez un sujet ci-dessous.';
  const questions = (Array.isArray(brut?.questions) ? brut.questions : [])
    .map((q) => ({
      question: texte(q?.question, 200),
      reponse: texte(q?.reponse, 2000),
      motsCles: (Array.isArray(q?.motsCles) ? q.motsCles : String(q?.motsCles || '').split(','))
        .map((m) => texte(m, 40)).filter(Boolean).slice(0, 12),
    }))
    .filter((q) => q.question || q.reponse);
  if (questions.length === 0) return { erreur: "ajoute au moins une question et sa réponse à l'assistant" };
  if (questions.length > LIMITES.questions) return { erreur: `l'assistant accepte ${LIMITES.questions} questions au plus` };
  const incomplete = questions.findIndex((q) => !q.question || !q.reponse);
  if (incomplete >= 0) return { erreur: `la question n° ${incomplete + 1} doit avoir un intitulé et une réponse` };
  return { configuration: { accueil, questions } };
}

function lireFormulaire(brut) {
  const pris = new Set();
  const champs = (Array.isArray(brut?.champs) ? brut.champs : [])
    .map((c) => ({
      libelle: texte(c?.libelle, 80),
      type: TYPES_CHAMPS.includes(c?.type) ? c.type : 'texte',
      obligatoire: c?.obligatoire !== false,
      options: (Array.isArray(c?.options) ? c.options : String(c?.options || '').split(','))
        .map((o) => texte(o, 60)).filter(Boolean),
    }))
    .filter((c) => c.libelle);
  if (champs.length === 0) return { erreur: 'ajoute au moins un champ au formulaire' };
  if (champs.length > LIMITES.champs) return { erreur: `un formulaire compte ${LIMITES.champs} champs au plus` };
  for (const c of champs) {
    if (c.type === 'choix' && (c.options.length < 2 || c.options.length > LIMITES.options)) {
      return { erreur: `le champ « ${c.libelle} » est une liste de choix : donne-lui entre 2 et ${LIMITES.options} options, séparées par des virgules` };
    }
    if (c.type !== 'choix') c.options = [];
  }
  champs.forEach((c, i) => { c.id = identifiant(c.libelle, i, pris); });
  const messageConfirmation = texte(brut?.messageConfirmation, 300)
    || "Votre demande a bien été transmise à l'Académie. Vous suivrez son traitement ici.";
  return { configuration: { champs, messageConfirmation } };
}

function lireRegistre(brut) {
  const pris = new Set();
  const colonnes = (Array.isArray(brut?.colonnes) ? brut.colonnes : [])
    .map((c) => ({ libelle: texte(c?.libelle, 60), type: TYPES_COLONNES.includes(c?.type) ? c.type : 'texte' }))
    .filter((c) => c.libelle);
  if (colonnes.length === 0) return { erreur: 'ajoute au moins une colonne au registre' };
  if (colonnes.length > LIMITES.colonnes) return { erreur: `un registre compte ${LIMITES.colonnes} colonnes au plus` };
  colonnes.forEach((c, i) => { c.id = identifiant(c.libelle, i, pris); });
  return { configuration: { colonnes } };
}

function lireConfiguration(type, brut) {
  if (type === 'assistant') return lireAssistant(brut);
  if (type === 'formulaire') return lireFormulaire(brut);
  if (type === 'registre') return lireRegistre(brut);
  return { configuration: null };
}

// ---- Valeurs saisies dans un formulaire ou une ligne de registre ----------

const FORMATS = {
  nombre: (v) => (Number.isFinite(Number(String(v).replace(',', '.'))) ? null : 'doit être un nombre'),
  date: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : 'doit être une date valide'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'doit être une adresse e-mail valide'),
  telephone: (v) => (/^[+\d][\d\s.-]{5,19}$/.test(v) ? null : 'doit être un numéro de téléphone valide'),
  lien: (v) => (/^https?:\/\/\S+$/i.test(v) ? null : 'doit commencer par https://'),
};

// `definitions` : champs d'un formulaire ou colonnes d'un registre.
function lireValeurs(definitions, brut, { toutFacultatif = false } = {}) {
  const valeurs = {};
  for (const d of definitions) {
    const v = texte(brut?.[d.id], d.type === 'long' ? 3000 : 300);
    if (!v) {
      if (d.obligatoire && !toutFacultatif) return { erreur: `le champ « ${d.libelle} » est obligatoire` };
      continue;
    }
    if (d.type === 'choix' && !d.options.includes(v)) return { erreur: `choix invalide pour « ${d.libelle} »` };
    const probleme = FORMATS[d.type]?.(v);
    if (probleme) return { erreur: `« ${d.libelle} » ${probleme}` };
    valeurs[d.id] = v;
  }
  if (Object.keys(valeurs).length === 0) return { erreur: 'remplis au moins un champ' };
  return { valeurs };
}

// ---- Assistant : trouver la bonne réponse --------------------------------

const MOTS_VIDES = new Set(`
  le la les un une des du de d l au aux et ou a à en y ce cet cette ces se sa son ses mon ma mes ton ta tes
  notre nos votre vos leur leurs je tu il elle on nous vous ils elles me te lui qui que quoi quel quelle quels
  quelles est sont suis es etre être ai as avons avez ont avoir fait faire pour par sur dans avec sans pas ne
  plus comment combien quand pourquoi ou où peut peux puis dois doit faut il-y bonjour merci svp stp s'il plait
`.split(/\s+/).filter(Boolean));

function normaliser(chaine) {
  return String(chaine || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function motsUtiles(chaine) {
  return normaliser(chaine).split(' ').filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
}

// Deux mots "se ressemblent" s'ils sont égaux ou partagent le même début
// (inscription / inscriptions / inscrire), pour tolérer pluriels et
// conjugaisons sans dictionnaire.
function proches(a, b) {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  return n >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

function score(motsQuestion, texteQuestion, entree) {
  let total = 0;
  entree.motsCles.forEach((cle) => {
    const cleNormalisee = normaliser(cle);
    if (!cleNormalisee) return;
    if (cleNormalisee.includes(' ')) {
      if (texteQuestion.includes(cleNormalisee)) total += 3;
    } else if (motsQuestion.some((m) => proches(m, cleNormalisee))) total += 2;
  });
  const motsEntree = motsUtiles(entree.question);
  motsQuestion.forEach((m) => { if (motsEntree.some((e) => proches(m, e))) total += 1; });
  return total;
}

function repondre(configuration, question) {
  const texteQuestion = normaliser(question);
  const motsQuestion = motsUtiles(question);
  const classement = configuration.questions
    .map((q, index) => ({ index, q, points: score(motsQuestion, texteQuestion, q) }))
    .sort((a, b) => b.points - a.points);
  const meilleure = classement[0];
  const seuil = motsQuestion.length <= 2 ? 1 : 2;
  if (meilleure && meilleure.points >= seuil) {
    return {
      trouvee: true,
      reponse: meilleure.q.reponse,
      sujet: meilleure.q.question,
      index: meilleure.index,
      suggestions: classement.slice(1, 4).filter((c) => c.points > 0).map((c) => c.q.question),
    };
  }
  return {
    trouvee: false,
    reponse: "Je n'ai pas encore la réponse à cette question. Elle a été enregistrée pour que mes réponses soient complétées ; en attendant, l'Académie de votre établissement peut vous renseigner. Voici les sujets sur lesquels je peux déjà vous aider :",
    suggestions: configuration.questions.slice(0, 4).map((q) => q.question),
  };
}

// Ce que l'espace de l'utilisateur reçoit : jamais les réponses de
// l'assistant en bloc (elles passent par le serveur, question par question).
function configurationPublique(type, configuration) {
  if (!configuration) return null;
  if (type === 'assistant') {
    return { accueil: configuration.accueil, sujets: configuration.questions.map((q) => q.question) };
  }
  return configuration;
}

module.exports = {
  TYPES_INTERACTIFS,
  TYPES_CHAMPS,
  TYPES_COLONNES,
  lireConfiguration,
  lireValeurs,
  repondre,
  configurationPublique,
  normaliser,
};
