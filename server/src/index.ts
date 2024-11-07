import WebSocket from 'ws';
import { setupChatServer } from './chat';
import { initializeDb, openDb } from './database';

initializeDb().catch((err) =>
  console.error('Error initializing database:', err),
);

const wss = new WebSocket.Server({ port: 3001 });

setupChatServer(wss);

async function checkUserExists(username: string) {
  const db = await openDb();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [
    username,
  ]);
  return user;
}

async function createUser(username: string) {
  const db = await openDb();
  await db.run('INSERT INTO users (username) VALUES (?)', [username]);
  return { username };
}

async function checkRoomExists(roomId: string) {
  const db = await openDb();
  const room = await db.get('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
  return room;
}

async function createRoom(roomId: string) {
  const db = await openDb();
  await db.run('INSERT INTO rooms (room_id) VALUES (?)', [roomId]);
  return { roomId };
}

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'check-username') {
      const user = await checkUserExists(data.username);
      if (user) {
        ws.send(JSON.stringify({ type: 'username-taken' }));
      } else {
        ws.send(JSON.stringify({ type: 'username-available' }));
      }
    } else if (data.type === 'create-username') {
      const user = await createUser(data.username);
      ws.send(JSON.stringify({ type: 'user-created', user }));
    } else if (data.type === 'join-room') {
      const room = await checkRoomExists(data.roomId);
      if (room) {
        ws.send(JSON.stringify({ type: 'room-exists', roomId: data.roomId }));
      } else {
        ws.send(
          JSON.stringify({ type: 'room-not-found', roomId: data.roomId }),
        );
      }
    } else if (data.type === 'create-room') {
      const room = await createRoom(data.roomId);
      ws.send(JSON.stringify({ type: 'room-created', roomId: data.roomId }));
    }
  });
});

console.log('Chat server is running on ws://localhost:3001');
