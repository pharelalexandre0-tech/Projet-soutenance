// Adresse IP du visiteur.
//   - Requête relayée par le site (nginx du frontend) : en-tête
//     X-EduSphere-Client, l'adresse que la passerelle de l'hébergeur a vue.
//   - Appel direct (application Android, outils) : dernière adresse de
//     X-Forwarded-For, ajoutée par la passerelle et donc non falsifiable.
//   - En local : l'adresse de la connexion.
const FORME_IP = /^[0-9a-fA-F:.]{3,45}$/;

function ipClient(req) {
  const relais = String(req?.headers?.['x-edusphere-client'] || '').trim();
  if (FORME_IP.test(relais)) return relais;
  const chaine = String(req?.headers?.['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const derniere = chaine[chaine.length - 1];
  if (derniere && FORME_IP.test(derniere)) return derniere;
  return req?.socket?.remoteAddress || 'inconnue';
}

module.exports = { ipClient };
