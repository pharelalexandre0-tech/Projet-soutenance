const REGEX_LOGO = /^data:image\/(png|jpeg|jpg|webp);base64,/;

// Même validation partout où un logo d'établissement peut être envoyé (à la
// création d'une école par le Superadmin, en modification par le Superadmin
// ou l'Académie) — jamais un format inattendu stocké en base sous prétexte
// qu'un seul des trois points d'entrée le vérifiait.
function erreurLogoInvalide(logo) {
  if (!logo) return null;
  if (!REGEX_LOGO.test(logo)) {
    return 'format de logo non reconnu (PNG, JPEG ou WebP attendu)';
  }
  return null;
}

module.exports = { erreurLogoInvalide };
