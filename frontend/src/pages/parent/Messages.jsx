import { useEffect, useState } from 'react';
import client from '../../api/client';

const LIBELLES_TYPE = { message: 'gris', annonce: 'or', convocation: 'rouge' };

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    client.get('/messages').then((res) => {
      setMessages(res.data.messages);
      setChargement(false);
    });
  }, []);

  return (
    <div className="carte">
      <h2>Messages &amp; annonces de l'école</h2>
      {chargement && <div className="chargement">Chargement…</div>}
      {!chargement && messages.length === 0 && <div className="vide">Aucun message pour le moment</div>}
      <div className="liste-notifications">
        {messages.map((m) => (
          <div className="notification-item" key={m.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{m.titre}</strong>
              <span className={`badge ${LIBELLES_TYPE[m.type]}`}>{m.type}</span>
            </div>
            <p style={{ fontSize: '0.87rem', margin: '6px 0' }}>{m.contenu}</p>
            <span style={{ fontSize: '0.76rem', color: 'var(--texte-clair)' }}>
              {new Date(m.dateEnvoi).toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
