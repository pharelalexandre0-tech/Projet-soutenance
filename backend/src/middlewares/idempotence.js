// Évite les doublons quand une saisie faite hors ligne est renvoyée : si la
// clé X-Idempotence a déjà été traitée pour cette route, la réponse gardée
// est rendue telle quelle. Sans clé, la requête suit son cours normal.
function idempotence(req, res, next) {
  const cle = String(req.get('X-Idempotence') || '').trim().slice(0, 80);
  if (!cle) return next();
  const { RequeteIdempotente } = require('../models');
  const route = `${req.method} ${req.baseUrl}${req.route?.path || req.path}`.slice(0, 160);
  RequeteIdempotente.findOne({ where: { cle, route } }).then((deja) => {
    if (deja) return res.status(deja.statut).json(deja.reponse);
    const json = res.json.bind(res);
    res.json = (corps) => {
      if (res.statusCode < 400) RequeteIdempotente.create({ cle, route, statut: res.statusCode, reponse: corps }).catch(() => {});
      return json(corps);
    };
    return next();
  }).catch(next);
}

module.exports = idempotence;
