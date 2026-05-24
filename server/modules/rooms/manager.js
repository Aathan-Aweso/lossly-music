const { ROOM_STALE_MEMBER_MS, ROOM_TTL_MS } = require('../../config');

const rooms = new Map();

function normalizeId(id = '') {
  return String(id).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
}

function clampPosition(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sanitizeSong(song) {
  if (!song?._id) return null;
  return {
    _id: song._id,
    title: song.title || 'Unknown',
    artist: song.artist || 'Unknown',
    coverArt: song.coverArt || 'default-cover.png',
    duration: Number(song.duration) || 0,
    format: song.format || '',
    hasDolbyAtmos: Boolean(song.hasDolbyAtmos),
  };
}

function sanitizeQueue(q) {
  return Array.isArray(q) ? q.map(sanitizeSong).filter(Boolean) : [];
}

function getOrCreate(rawId) {
  const id = normalizeId(rawId);
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
        updatedBy: null,
      },
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
    joinedAtMs: room.members.get(clientId)?.joinedAtMs ?? Date.now(),
  });
}

function removeMember(room, clientId) {
  room.members.delete(clientId);
  room.version += 1;
  room.updatedAtMs = Date.now();
  maybeDelete(room.roomId);
}

function pruneStaleMembers(room) {
  const cutoff = Date.now() - ROOM_STALE_MEMBER_MS;
  for (const [id, m] of room.members.entries()) {
    if (m.lastSeenMs < cutoff) room.members.delete(id);
  }
}

function maybeDelete(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.members.size === 0 && Date.now() - room.updatedAtMs > ROOM_TTL_MS) {
    rooms.delete(roomId);
  }
}

function projectedPosition(playback) {
  if (!playback.isPlaying) return playback.position;
  return Math.max(0, playback.position + (Date.now() - playback.updatedAtMs) / 1000);
}

function serialize(room) {
  pruneStaleMembers(room);
  return {
    roomId: room.roomId,
    version: room.version,
    serverTimeMs: Date.now(),
    memberCount: room.members.size,
    members: Array.from(room.members.values()).map(({ clientId, username }) => ({ clientId, username })),
    playback: {
      currentSong: room.playback.currentSong,
      queue: room.playback.queue,
      isPlaying: room.playback.isPlaying,
      position: projectedPosition(room.playback),
      updatedBy: room.playback.updatedBy,
      updatedAtMs: room.playback.updatedAtMs,
    },
  };
}

function applySync(room, clientId, username, playback) {
  touchMember(room, clientId, username);
  if (playback && typeof playback === 'object') {
    room.playback.currentSong = sanitizeSong(playback.currentSong);
    room.playback.queue = sanitizeQueue(playback.queue);
    room.playback.isPlaying = Boolean(playback.isPlaying);
    room.playback.position = clampPosition(playback.position);
    room.playback.updatedAtMs = Date.now();
    room.playback.updatedBy = clientId || null;
  }
  room.updatedAtMs = Date.now();
  room.version += 1;
  return serialize(room);
}

function join(rawId, clientId, username) {
  const room = getOrCreate(rawId);
  if (!room) return null;
  touchMember(room, clientId, username);
  room.version += 1;
  room.updatedAtMs = Date.now();
  return { room, state: serialize(room) };
}

module.exports = { normalizeId, join, removeMember, applySync, serialize, getOrCreate, touchMember };
