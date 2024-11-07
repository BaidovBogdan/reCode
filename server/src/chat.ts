import WebSocket from 'ws';
import { openDb } from './database';

export function setupChatServer(wss: WebSocket.Server) {
  wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (message) => {
      const data = JSON.parse(message.toString());

      if (data.type === 'message') {
        const { room_id, username, content } = data;

        const db = await openDb();
        await db.run(
          'INSERT INTO messages (room_id, username, content) VALUES (?, ?, ?)',
          room_id,
          username,
          content,
        );

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({ type: 'message', room_id, username, content }),
            );
          }
        });
      } else if (
        data.type === 'offer' ||
        data.type === 'answer' ||
        data.type === 'ice-candidate'
      ) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    });

    ws.on('join-room', async (roomId: string) => {
      const db = await openDb();

      db.all(
        'SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC',
        [roomId],
        (err: any, rows: any) => {
          if (err) {
            console.error('Error fetching messages', err);
          } else {
            ws.send(
              JSON.stringify({ type: 'message-history', messages: rows }),
            );
          }
        },
      );
    });
  });
}
