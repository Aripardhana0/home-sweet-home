"use strict";

const { generateRoomCode, hashRoomCode, generatePlayerToken } = require("./auth");
const { createInitialRoomState, checkCollision } = require("./game-state");
const { saveRoomState, loadAllRooms, deleteRoomState } = require("./persistence");

class RoomManager {
  constructor(secretKey, storageDir) {
    this.secretKey = secretKey;
    this.storageDir = storageDir;
    this.rooms = new Map(); // roomId -> { meta, state }
    this.codeIndex = new Map(); // codeHash -> roomId
    this.sockets = new Map(); // ws -> { roomId, role, token }
  }

  init() {
    const { OBJECTS } = require("./game-state");
    const loaded = loadAllRooms(this.storageDir);
    for (const [roomId, state] of loaded.entries()) {
      const meta = state.meta || {
        roomId,
        name: `Rumah ${roomId}`,
        createdAt: Date.now(),
        status: "active",
        codeHash: hashRoomCode(roomId, this.secretKey)
      };

      state.objects = state.objects || {};
      for (const [id, def] of Object.entries(OBJECTS)) {
        if (!state.objects[id]) {
          state.objects[id] = JSON.parse(JSON.stringify(def));
        } else {
          state.objects[id].x = def.x;
          state.objects[id].y = def.y;
          state.objects[id].w = def.w;
          state.objects[id].h = def.h;
          state.objects[id].interactX = def.interactX;
          state.objects[id].interactY = def.interactY;
          state.objects[id].radius = def.radius;
        }
      }

      if (!state.tiger) {
        state.tiger = {
          x: 980,
          y: 720,
          targetX: 980,
          targetY: 720,
          direction: "left",
          anim: "idle",
          isOutside: false,
          lastMoveTick: Date.now()
        };
      }

      for (const role of ["karip", "gabin"]) {
        const p = state.players[role];
        if (p && checkCollision(p.x, p.y, 14, state.objects)) {
          p.x = role === "karip" ? 200 : 260;
          p.y = 240;
        }
      }

      this.rooms.set(roomId, { meta, state });
      if (meta.codeHash) {
        this.codeIndex.set(meta.codeHash, roomId);
      }
    }
  }

  createRoom(name = "Rumah Bahagia", customCode = null) {
    let code = "";
    let codeHash = "";

    if (customCode && typeof customCode === "string" && customCode.trim().length >= 3) {
      code = customCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      codeHash = hashRoomCode(code, this.secretKey);
      if (this.codeIndex.has(codeHash)) {
        return { ok: false, error: `Kode room "${code}" sudah digunakan. Silakan pilih kode lain.` };
      }
    } else {
      code = generateRoomCode();
      codeHash = hashRoomCode(code, this.secretKey);
      let attempts = 0;
      while (this.codeIndex.has(codeHash) && attempts < 10) {
        code = generateRoomCode();
        codeHash = hashRoomCode(code, this.secretKey);
        attempts++;
      }
    }

    const roomId = `gk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const meta = {
      roomId,
      name,
      createdAt: Date.now(),
      status: "waiting_for_players",
      codeHash
    };

    const state = createInitialRoomState(roomId);
    state.meta = meta;

    this.rooms.set(roomId, { meta, state });
    this.codeIndex.set(codeHash, roomId);
    this.save(roomId);

    return { ok: true, roomId, code, name };
  }

  findRoomByCode(code) {
    if (!code || typeof code !== "string") return null;
    const hash = hashRoomCode(code, this.secretKey);
    const roomId = this.codeIndex.get(hash);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  listRooms() {
    const result = [];
    for (const { meta, state } of this.rooms.values()) {
      const karip = state.players.karip;
      const gabin = state.players.gabin;
      result.push({
        roomId: meta.roomId,
        name: meta.name,
        status: meta.status,
        createdAt: meta.createdAt,
        slots: {
          karip: { claimed: karip.claimed, online: karip.online },
          gabin: { claimed: gabin.claimed, online: gabin.online }
        }
      });
    }
    return result;
  }

  claimSlot(roomId, role, existingToken = null) {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "Room tidak ditemukan" };
    if (room.meta.status === "revoked") return { ok: false, error: "Room sudah dicabut" };
    if (role !== "karip" && role !== "gabin") {
      return { ok: false, error: "Role tidak valid (pilih karip atau gabin)" };
    }

    const player = room.state.players[role];

    // Reconnection path: matching token grants access
    if (player.claimed) {
      if (existingToken && player.token === existingToken) {
        player.online = true;
        player.lastActive = Date.now();
        // Safety: ensure reconnected player is never stuck in an obstacle
        if (checkCollision(player.x, player.y, 14)) {
          player.x = role === "karip" ? 200 : 260;
          player.y = 240;
        }
        room.meta.status = "active";
        this.save(roomId);
        return { ok: true, role, token: player.token, reconnected: true };
      }
      return { ok: false, error: `Slot ${role} sudah terisi oleh pemain lain` };
    }

    // New claim path
    const token = generatePlayerToken();
    player.claimed = true;
    player.token = token;
    player.online = true;
    player.lastActive = Date.now();

    // Safety: ensure newly claimed player is never stuck in an obstacle
    if (checkCollision(player.x, player.y, 14)) {
      player.x = role === "karip" ? 200 : 260;
      player.y = 240;
    }
    const otherRole = role === "karip" ? "gabin" : "karip";
    if (room.state.players[otherRole].claimed) {
      room.meta.status = "active";
    }

    this.save(roomId);
    return { ok: true, role, token, reconnected: false };
  }

  releaseSlot(roomId, role) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (role !== "karip" && role !== "gabin") return false;

    const player = room.state.players[role];
    player.claimed = false;
    player.token = null;
    player.online = false;
    player.activeTask = null;

    room.meta.status = "waiting_for_players";
    this.save(roomId);
    return true;
  }

  revokeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.meta.status = "revoked";
    if (room.meta.codeHash) {
      this.codeIndex.delete(room.meta.codeHash);
    }
    deleteRoomState(roomId, this.storageDir);
    this.rooms.delete(roomId);
    return true;
  }

  resetRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const meta = { ...room.meta, status: "waiting_for_players" };
    const newState = createInitialRoomState(roomId);
    newState.meta = meta;

    this.rooms.set(roomId, { meta, state: newState });
    this.save(roomId);
    return true;
  }

  rotateRoomCode(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.meta.codeHash) {
      this.codeIndex.delete(room.meta.codeHash);
    }

    const newCode = generateRoomCode();
    const newHash = hashRoomCode(newCode, this.secretKey);
    room.meta.codeHash = newHash;
    this.codeIndex.set(newHash, roomId);
    this.save(roomId);

    return newCode;
  }

  save(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    saveRoomState(roomId, room.state, this.storageDir);
  }
}

module.exports = {
  RoomManager
};
