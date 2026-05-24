const WebSocket = require('ws');
const url = require('url');
const { normalizeId, join, removeMember, applySync, serialize, getOrCreate } = require('./manager');
const { ROOM_PING_INTERVAL_MS } = require('../../config');

// Maps roomId -> Set<WebSocket>
const roomSockets = new Map();

function getRoomSockets(roomId) {
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  return roomSockets.get(roomId);
}

function broadcast(roomId, payload, excludeWs = null) {
  const msg = JSON.stringify(payload);
  const sockets = getRoomSockets(roomId);
  for (const ws of sockets) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function broadcastAll(roomId, payload) {
  broadcast(roomId, payload, null);
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function attach(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/rooms' });

  wss.on('connection', (ws, req) => {
    const params = new url.URL(req.url, 'http://localhost').searchParams;
    const rawRoomId = params.get('roomId') || '';
    const clientId = params.get('clientId') || `anon_${Date.now()}`;
    const username = params.get('username') || 'Listener';
    const roomId = normalizeId(rawRoomId);

    if (!roomId) {
      ws.close(4000, 'Invalid room id');
      return;
    }

    const { state } = join(roomId, clientId, username);
    getRoomSockets(roomId).add(ws);

    // Send current state to the new joiner
    send(ws, { type: 'state', room: state });

    // Broadcast updated member list to others
    const updatedRoom = getOrCreate(roomId);
    if (updatedRoom) {
      broadcastAll(roomId, { type: 'state', room: serialize(updatedRoom) });
    }

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'pong') {
        ws.isAlive = true;
        return;
      }

      if (msg.type === 'sync') {
        const room = getOrCreate(roomId);
        if (!room) return;
        const newState = applySync(room, clientId, username, msg.playback);
        // Broadcast to all members including sender so everyone is in sync
        broadcastAll(roomId, { type: 'state', room: newState });
      }
    });

    ws.on('close', () => {
      getRoomSockets(roomId).delete(ws);
      const room = getOrCreate(roomId);
      if (room) {
        removeMember(room, clientId);
        broadcastAll(roomId, { type: 'state', room: serialize(room) });
      }
      if (getRoomSockets(roomId).size === 0) roomSockets.delete(roomId);
    });

    ws.on('error', (err) => {
      console.error('ws error', err);
      ws.terminate();
    });
  });

  // Heartbeat: ping all clients every ROOM_PING_INTERVAL_MS
  const pingInterval = setInterval(() => {
    for (const [roomId, sockets] of roomSockets.entries()) {
      for (const ws of sockets) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        send(ws, { type: 'ping' });
      }
    }
  }, ROOM_PING_INTERVAL_MS);

  wss.on('close', () => clearInterval(pingInterval));

  console.log('WebSocket room server attached at /ws/rooms');
  return wss;
}

module.exports = { attach };
