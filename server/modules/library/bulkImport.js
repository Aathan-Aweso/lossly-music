#!/usr/bin/env node
// Bulk-import audio files from a directory into the database.
// Usage: node server/modules/library/bulkImport.js [dir]
// Default dir: ./songs
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const mm = require('music-metadata');
const Song = require('../../models/Song');
const User = require('../../models/User');
const { MONGODB_URI, UPLOAD_DIR, SONGS_DIR_NAME, COVERS_DIR_NAME } = require('../../config');

const AUDIO_EXTS = new Set(['.flac', '.wav', '.mp3', '.m4a']);

async function getOrCreateAdmin() {
  let user = await User.findOne({ username: 'admin' });
  if (!user) {
    user = await User.create({
      username: 'admin',
      email: 'admin@lossly.local',
      password: `admin_${Math.random().toString(36).slice(2)}`,
    });
    console.log('Created admin user');
  }
  return user;
}

async function extractMeta(filePath) {
  const stream = fs.createReadStream(filePath);
  try {
    return await mm.parseStream(stream, { skipPostHeaders: true });
  } catch {
    return null;
  } finally {
    stream.destroy();
  }
}

function guessFromFilename(filename) {
  const name = path.parse(filename).name;
  // "01. Title" or "01 - Artist - Title"
  const parts = name.replace(/^\d+[\.\s-]+/, '').split(/\s+-\s+/);
  return {
    title: parts[parts.length - 1]?.trim() || name,
    artist: parts.length > 1 ? parts[0].trim() : 'Unknown Artist',
    album: parts.length > 2 ? parts[1].trim() : 'Unknown Album',
  };
}

async function run() {
  const inputDir = process.argv[2] || path.join(process.cwd(), 'songs');
  const destSongs = path.join(UPLOAD_DIR, SONGS_DIR_NAME);
  const destCovers = path.join(UPLOAD_DIR, COVERS_DIR_NAME);
  fs.mkdirSync(destSongs, { recursive: true });
  fs.mkdirSync(destCovers, { recursive: true });

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const admin = await getOrCreateAdmin();
  const files = fs.readdirSync(inputDir).filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()));
  console.log(`Found ${files.length} audio files in ${inputDir}`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const srcPath = path.join(inputDir, file);
    const destName = `${Date.now()}_${file}`;
    const destPath = path.join(destSongs, destName);

    const meta = await extractMeta(srcPath);
    const guess = guessFromFilename(file);
    const format = path.extname(file).toUpperCase().slice(1);

    const title = meta?.common?.title || guess.title;
    const artist = meta?.common?.artist || guess.artist;

    const existing = await Song.findOne({ title, artist });
    if (existing) {
      console.log(`  skip (exists): ${title} – ${artist}`);
      skipped++;
      continue;
    }

    // Copy file to uploads/songs
    fs.copyFileSync(srcPath, destPath);

    // Save cover art if embedded
    let coverArt = 'default-cover.png';
    if (meta?.common?.picture?.length) {
      const pic = meta.common.picture[0];
      const mimeToExt = { 'image/jpeg': '.jpg', 'image/png': '.png' };
      const ext = mimeToExt[pic.format] || '.jpg';
      const coverName = `${Date.now()}-cover${ext}`;
      fs.writeFileSync(path.join(destCovers, coverName), pic.data);
      coverArt = coverName;
    }

    const hasDolbyAtmos = (meta?.format?.channels >= 6) &&
      ['FLAC', 'WAV'].includes(meta?.format?.container?.toUpperCase());

    await Song.create({
      title,
      artist: artist,
      album: meta?.common?.album || guess.album,
      genre: meta?.common?.genre?.[0] || 'Unknown',
      duration: meta?.format?.duration || 0,
      bitrate: meta?.format?.bitrate ? Math.round(meta.format.bitrate / 1000) : 1411,
      format,
      audioFile: destName,
      coverArt,
      hasDolbyAtmos,
      addedBy: admin._id,
    });

    console.log(`  imported: ${title} – ${artist} (${format})`);
    imported++;
  }

  console.log(`\nDone. ${imported} imported, ${skipped} skipped.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
