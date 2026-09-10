// Service E-mail (présent dans les diagrammes 3, 4, 5, 6, 8, 9). En
// environnement de démo/soutenance, on se contente de journaliser l'envoi
// plutôt que de configurer un vrai serveur SMTP — le point important pour
// les diagrammes est le contrat (qui reçoit quoi, à quel moment), pas le
// transport e-mail réel.
async function envoyerEmail(destinataire, sujet, corps) {
  console.log(`[Service E-mail] À: ${destinataire} | Sujet: ${sujet}\n${corps}\n`);
  return { envoye: true };
}

module.exports = { envoyerEmail };
