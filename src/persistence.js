"use strict";

const fs = require("node:fs");
const path = require("node:path");

function getStorageDir(customDir) {
  const dir = customDir || process.env.DATA_DIR || path.join(__dirname, "../data/rooms");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function saveRoomState(roomId, state, storageDir) {
  const dir = getStorageDir(storageDir);
  const targetPath = path.join(dir, `${roomId}.json`);
  const tmpPath = path.join(dir, `${roomId}.${Date.now()}.tmp`);

  // Strip ephemeral runtime sockets or timers before persisting
  const serialized = JSON.stringify(state, (key, value) => {
    if (key === "ws" || key === "timer") return undefined;
    return value;
  }, 2);

  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, targetPath);
}

function loadRoomState(roomId, storageDir) {
  const dir = getStorageDir(storageDir);
  const targetPath = path.join(dir, `${roomId}.json`);
  if (!fs.existsSync(targetPath)) return null;

  try {
    const raw = fs.readFileSync(targetPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAllRooms(storageDir) {
  const dir = getStorageDir(storageDir);
  const result = new Map();
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const roomId = path.basename(entry, ".json");
    const state = loadRoomState(roomId, dir);
    if (state) {
      result.set(roomId, state);
    }
  }
  return result;
}

function deleteRoomState(roomId, storageDir) {
  const dir = getStorageDir(storageDir);
  const targetPath = path.join(dir, `${roomId}.json`);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}

module.exports = {
  getStorageDir,
  saveRoomState,
  loadRoomState,
  loadAllRooms,
  deleteRoomState
};
