const express = require('express');

const router = express.Router();

const rooms = new Map();
const STALE_MEMBER_MS = 15000;
const ROOM_TTL_MS = 30 * 60 * 1000;

function normalizeRoomId(roomId = '') {
  return roomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
}

function clampPosition(position) {
  const safePosition = Number(position);
  if (!Number.isFinite(safePosition) || safePosition < 0) return 0;
  return safePosition;
}

function sanitizeSong(song) {
  if (!song || typeof song !== 'object') return null;
  if (!song._id) return null;

  return {
    _id: song._id,
    title: song.title || 'Unknown title',
    artist: song.artist || 'Unknown artist',
    coverArt: song.coverArt || 'default-cover.png',
    duration: Number(song.duration) || 0,
    format: song.format || '',
    hasDolbyAtmos: Boolean(song.hasDolbyAtmos)
  };
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) return [];
  return queue.map(sanitizeSong).filter(Boolean);
}

function ensureRoom(roomId) {
  const id = normalizeRoomId(roomId);
  if (!id) return null;

  if (!rooms.has(id)) {
    rooms.set(id, {
      roomId: id,
      version: 1,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      members: new Map(),
      playback: {
        currentSong: null,
        queue: [],
        isPlaying: false,
        position: 0,
        updatedAtMs: Date.now(),
        updatedBy: null
      }
    });
  }

  return rooms.get(id);
}

function touchMember(room, clientId, username = 'Listener') {
  if (!clientId) return;
  room.members.set(clientId, {
    clientId,
    username: String(username || 'Listener').slice(0, 32),
    lastSeenMs: Date.now(),
    joinedAtMs: room.members.get(clientId)?.joinedAtMs || Date.now()
  });
}

function cleanupRoom(room) {
  const now = Date.now();
  for (const [memberId, member] of room.members.entries()) {
    if (now - member.lastSeenMs > STALE_MEMBER_MS) {
      room.members.delete(memberId);
    }
  }
}

function maybeDeleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const isInactive = Date.now() - room.updatedAtMs > ROOM_TTL_MS;
  if (room.members.size === 0 && isInactive) {
    rooms.delete(roomId);
  }
}

function projectedPosition(playback) {
  if (!playback.isPlaying) return playback.position;
  const elapsedSeconds = (Date.now() - playback.updatedAtMs) / 1000;
  return Math.max(0, playback.position + elapsedSeconds);
}

function serializeRoom(room) {
  cleanupRoom(room);

  return {
    roomId: room.roomId,
    version: room.version,
    serverTimeMs: Date.now(),
    memberCount: room.members.size,
    members: Array.from(room.members.values()).map((member) => ({
      clientId: member.clientId,
      username: member.username
    })),
    playback: {
      currentSong: room.playback.currentSong,
      queue: room.playback.queue,
      isPlaying: room.playback.isPlaying,
      position: projectedPosition(room.playback),
      updatedBy: room.playback.updatedBy,
      updatedAtMs: room.playback.updatedAtMs
    }
  };
}

router.post('/join', (req, res) => {
  const { roomId, clientId, username } = req.body || {};
  const room = ensureRoom(roomId);
  if (!room) {
    return res.status(400).json({ message: 'Invalid room id' });
  }

  touchMember(room, clientId, username);
  room.updatedAtMs = Date.now();
  room.version += 1;

  return res.json(serializeRoom(room));
});

router.post('/leave', (req, res) => {
  const roomId = normalizeRoomId(req.body?.roomId);
  const clientId = req.body?.clientId;
  const room = rooms.get(roomId);

  if (!room) {
    return res.json({ ok: true });
  }

  if (clientId) {
    room.members.delete(clientId);
  }
  room.updatedAtMs = Date.now();
  room.version += 1;

  maybeDeleteRoom(roomId);
  return res.json({ ok: true });
});

router.post('/sync', (req, res) => {
  const { roomId, clientId, username, playback } = req.body || {};
  const room = ensureRoom(roomId);
  if (!room) {
    return res.status(400).json({ message: 'Invalid room id' });
  }

  touchMember(room, clientId, username);

  if (playback && typeof playback === 'object') {
    room.playback.currentSong = sanitizeSong(playback.currentSong);
    room.playback.queue = sanitizeQueue(playback.queue);
    room.playback.isPlaying = Boolean(playback.isPlaying);
    room.playback.position = clampPosition(playback.position);
    room.playback.updatedAtMs = Date.now();
    room.playback.updatedBy = clientId || null;
    room.updatedAtMs = Date.now();
    room.version += 1;
  }

  return res.json(serializeRoom(room));
});

router.get('/:roomId/state', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const clientId = req.query.clientId;
  const username = req.query.username;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  if (clientId) {
    touchMember(room, clientId, username);
  }
  room.updatedAtMs = Date.now();
  return res.json(serializeRoom(room));
});

module.exports = router;
