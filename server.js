"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer } = require("ws");

const { parseClientEnvelope, createEnvelope, escapeHtml } = require("./src/protocol");
const { verifyPassword, generateAdminToken } = require("./src/auth");
const { RoomManager } = require("./src/rooms");
const { processMoveIntent } = require("./src/movement");
const { startSoloTask, createCoopInvite, resolveCoopInvite, tickRoomTasks } = require("./src/tasks");
const { getTaskCatalog } = require("./src/game-state");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "gabin-karip-admin-2026";
const ROOM_SECRET = process.env.ROOM_SECRET_KEY || "dev-secret-gk-2026";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data/rooms");

const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const roomManager = new RoomManager(ROOM_SECRET, DATA_DIR);
roomManager.init();

const adminSessions = new Set();

function broadcastToRoom(roomId, messageString, excludeWs = null) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  for (const [clientWs, session] of roomManager.sockets.entries()) {
    if (session.roomId === roomId && clientWs !== excludeWs && clientWs.readyState === 1) {
      clientWs.send(messageString);
    }
  }
}

function sendToRole(roomId, role, messageString) {
  for (const [clientWs, session] of roomManager.sockets.entries()) {
    if (session.roomId === roomId && session.role === role && clientWs.readyState === 1) {
      clientWs.send(messageString);
      break;
    }
  }
}

function readJsonBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function verifyAdmin(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return adminSessions.has(token);
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // Healthcheck endpoint
  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime(), rooms: roomManager.rooms.size }));
    return;
  }

  // Task catalog endpoint
  if (pathname === "/api/tasks" || pathname === "/data/tasks.json") {
    const tasks = getTaskCatalog();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(JSON.stringify(tasks));
    return;
  }

  // Admin API: Login
  if (pathname === "/api/admin/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (verifyPassword(body.password, ADMIN_PASSWORD)) {
        const token = generateAdminToken();
        adminSessions.add(token);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, token }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Password admin salah" }));
      }
    } catch {
      res.writeHead(400).end("Bad request");
    }
    return;
  }

  // Admin API: List rooms
  if (pathname === "/api/admin/rooms" && req.method === "GET") {
    if (!verifyAdmin(req)) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: roomManager.listRooms() }));
    return;
  }

  // Admin API: Create room
  if (pathname === "/api/admin/create-room" && req.method === "POST") {
    if (!verifyAdmin(req)) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "Rumah Bahagia").slice(0, 50);
      const customCode = body.code ? String(body.code).trim().slice(0, 30) : null;
      const created = roomManager.createRoom(name, customCode);
      if (!created.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: created.error }));
        return;
      }
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...created }));
    } catch {
      res.writeHead(400).end("Bad request");
    }
    return;
  }

  // Admin API: Revoke room
  if (pathname === "/api/admin/revoke-room" && req.method === "POST") {
    if (!verifyAdmin(req)) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    try {
      const body = await readJsonBody(req);
      const ok = roomManager.revokeRoom(body.roomId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    } catch {
      res.writeHead(400).end("Bad request");
    }
    return;
  }

  // Admin API: Reset room
  if (pathname === "/api/admin/reset-room" && req.method === "POST") {
    if (!verifyAdmin(req)) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    try {
      const body = await readJsonBody(req);
      const ok = roomManager.resetRoom(body.roomId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    } catch {
      res.writeHead(400).end("Bad request");
    }
    return;
  }

  // Admin API: Release slot
  if (pathname === "/api/admin/release-slot" && req.method === "POST") {
    if (!verifyAdmin(req)) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    try {
      const body = await readJsonBody(req);
      const ok = roomManager.releaseSlot(body.roomId, body.role);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    } catch {
      res.writeHead(400).end("Bad request");
    }
    return;
  }

  // Static files
  let safePath = pathname === "/" ? "/index.html" : (pathname === "/admin" ? "/admin.html" : pathname);
  const resolved = path.normalize(path.join(PUBLIC_DIR, safePath));

  // Path traversal guard
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const envelope = parseClientEnvelope(raw);
    if (!envelope) return;

    const { type, payload = {}, requestId } = envelope;
    const session = roomManager.sockets.get(ws);

    // Join room & select character
    if (type === "join_room") {
      const { code, role, token } = payload;
      const room = roomManager.findRoomByCode(code);
      if (!room) {
        ws.send(createEnvelope("error", { message: "Kode room tidak valid atau sudah kedaluwarsa" }, requestId));
        return;
      }

      // If role not yet chosen, return available slot info
      if (!role) {
        ws.send(createEnvelope("room_info", {
          roomId: room.meta.roomId,
          name: room.meta.name,
          slots: {
            karip: { claimed: room.state.players.karip.claimed, online: room.state.players.karip.online },
            gabin: { claimed: room.state.players.gabin.claimed, online: room.state.players.gabin.online }
          }
        }, requestId));
        return;
      }

      // Claim slot or reconnect
      const claim = roomManager.claimSlot(room.meta.roomId, role, token);
      if (!claim.ok) {
        ws.send(createEnvelope("error", { message: claim.error }, requestId));
        return;
      }

      roomManager.sockets.set(ws, { roomId: room.meta.roomId, role, token: claim.token });

      // Send join result and full room snapshot
      ws.send(createEnvelope("join_result", {
        ok: true,
        roomId: room.meta.roomId,
        role,
        token: claim.token,
        reconnected: claim.reconnected
      }, requestId, room.meta.roomId));

      ws.send(createEnvelope("room_snapshot", room.state, null, room.meta.roomId));
      ws.send(createEnvelope("task_catalog", getTaskCatalog(), null, room.meta.roomId));
      // Broadcast to partner
      broadcastToRoom(room.meta.roomId, createEnvelope("player_joined", {
        role,
        reconnected: claim.reconnected,
        player: room.state.players[role]
      }, null, room.meta.roomId), ws);

      return;
    }

    // Require active room session for all subsequent messages
    if (!session) {
      ws.send(createEnvelope("error", { message: "Belum bergabung ke room" }, requestId));
      return;
    }

    const { roomId, role } = session;
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.state.players[role];
    if (!player) return;

    // Movement intent
    if (type === "move_intent") {
      const moved = processMoveIntent(player, payload, payload.dt || 0.05, room.state.objects);
      if (moved) {
        broadcastToRoom(roomId, createEnvelope("player_moved", {
          role,
          x: player.x,
          y: player.y,
          direction: player.direction,
          anim: player.anim
        }, null, roomId));
      }
      return;
    }

    // Solo or flexible task start
    if (type === "task_start") {
      const result = startSoloTask(room.state, role, payload.taskId);
      if (!result.ok) {
        ws.send(createEnvelope("task_rejected", { error: result.error, taskId: payload.taskId }, requestId, roomId));
        return;
      }

      broadcastToRoom(roomId, createEnvelope("task_started", {
        taskId: payload.taskId,
        role,
        activeTask: result.activeTask
      }, requestId, roomId));
      return;
    }

    // Task cancellation
    if (type === "task_cancel") {
      if (player.activeTask) {
        player.activeTask = null;
        player.anim = "idle";
        broadcastToRoom(roomId, createEnvelope("task_cancelled", { role }, requestId, roomId));
      }
      return;
    }

    // Co-op invite
    if (type === "invite_action") {
      const result = createCoopInvite(room.state, role, payload.taskId);
      if (!result.ok) {
        ws.send(createEnvelope("error", { message: result.error }, requestId, roomId));
        return;
      }

      const toRole = role === "karip" ? "gabin" : "karip";
      sendToRole(roomId, toRole, createEnvelope("invite_received", result.invite, null, roomId));
      ws.send(createEnvelope("invite_sent", { ok: true, inviteId: result.invite.id }, requestId, roomId));
      return;
    }

    // Co-op invite resolution
    if (type === "invite_accept" || type === "invite_decline") {
      const accept = type === "invite_accept";
      const result = resolveCoopInvite(room.state, role, payload.inviteId, accept);
      if (!result.ok) {
        ws.send(createEnvelope("error", { message: result.error }, requestId, roomId));
        return;
      }

      if (!result.accepted) {
        broadcastToRoom(roomId, createEnvelope("invite_resolved", {
          accepted: false,
          taskId: result.taskId,
          by: role
        }, null, roomId));
      } else {
        broadcastToRoom(roomId, createEnvelope("task_started", {
          taskId: result.activeTask.taskId,
          participants: result.activeTask.participants,
          activeTask: result.activeTask
        }, null, roomId));
      }
      return;
    }

    // Real-time Chat
    if (type === "chat_send") {
      const text = escapeHtml(String(payload.text || "").trim().slice(0, 160));
      if (!text) return;

      const now = Date.now();
      const messageObj = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        time: now
      };

      player.bubble = { text, expiresAt: now + 5000 };
      room.state.chat.push(messageObj);
      if (room.state.chat.length > 100) {
        room.state.chat.shift();
      }

      broadcastToRoom(roomId, createEnvelope("chat_message", {
        message: messageObj,
        bubble: { role, text }
      }, requestId, roomId));
      return;
    }

    // Emote
    if (type === "emote") {
      const emoteId = String(payload.emoteId || "").slice(0, 20);
      const now = Date.now();
      player.bubble = { text: emoteId, expiresAt: now + 4000 };

      broadcastToRoom(roomId, createEnvelope("emote", {
        role,
        emoteId
      }, requestId, roomId));
      return;
    }

    // Full snapshot request
    if (type === "request_snapshot") {
      ws.send(createEnvelope("room_snapshot", room.state, requestId, roomId));
    }
  });

  ws.on("close", () => {
    const session = roomManager.sockets.get(ws);
    if (!session) return;

    roomManager.sockets.delete(ws);
    const { roomId, role } = session;
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.state.players[role];
    if (player) {
      player.online = false;
      player.anim = "idle";
      player.lastActive = Date.now();
      broadcastToRoom(roomId, createEnvelope("player_left", { role }, null, roomId));
    }
    roomManager.save(roomId);
  });
});

// Server Tick Loop (20 TPS)
const TICK_INTERVAL_MS = 50;
let lastSaveTick = Date.now();

const tickTimer = setInterval(() => {
  const now = Date.now();

  for (const [roomId, { state }] of roomManager.rooms.entries()) {
    const karipOnline = state.players.karip.online;
    const gabinOnline = state.players.gabin.online;

    // Advance in-game clock only if at least one player is active
    if (karipOnline || gabinOnline) {
      const elapsed = now - (state.lastTick || now);
      state.gameTimeMs = (state.gameTimeMs + elapsed * 10) % (24 * 60 * 60 * 1000); // 1 real sec = 10 game sec
    }
    state.lastTick = now;

    // Tiger autonomous wandering AI
    if (state.tiger) {
      if (!state.tiger.lastMoveTick || now - state.tiger.lastMoveTick > 4500) {
        state.tiger.lastMoveTick = now;
        if (state.tiger.isOutside) {
          // Mamacan explores the whole estate, roaming into living room, kitchen, or garden
          const houseSpots = [
            { x: 550, y: 440 }, // Ruang keluarga di atas karpet
            { x: 680, y: 440 }, // Meja board game
            { x: 260, y: 460 }, // Dekat meja makan dapur
            { x: 180, y: 680 }, // Dekat kolam koi di taman
            { x: 350, y: 680 }, // Dekat pot bunga & BBQ
            { x: 500, y: 760 }, // Jalan setapak taman
            { x: 980, y: 720 }, // Kembali ke dekat kandang
          ];
          const spot = houseSpots[Math.floor(Math.random() * houseSpots.length)];
          state.tiger.targetX = spot.x + (Math.random() * 40 - 20);
          state.tiger.targetY = spot.y + (Math.random() * 40 - 20);
        } else {
          state.tiger.targetX = 820 + Math.random() * 460;
          state.tiger.targetY = 660 + Math.random() * 140;
        }
      }

      const tdx = state.tiger.targetX - state.tiger.x;
      const tdy = state.tiger.targetY - state.tiger.y;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist > 5) {
        const tspeed = 35 * (TICK_INTERVAL_MS / 1000);
        state.tiger.x += (tdx / tdist) * tspeed;
        state.tiger.y += (tdy / tdist) * tspeed;
        state.tiger.direction = tdx > 0 ? "right" : "left";
        state.tiger.anim = "walk";

        broadcastToRoom(roomId, createEnvelope("tiger_moved", {
          x: Math.round(state.tiger.x * 10) / 10,
          y: Math.round(state.tiger.y * 10) / 10,
          direction: state.tiger.direction,
          anim: state.tiger.anim,
          isOutside: state.tiger.isOutside
        }, null, roomId));
      } else {
        if (state.tiger.anim !== "idle") {
          state.tiger.anim = "idle";
          broadcastToRoom(roomId, createEnvelope("tiger_moved", {
            x: Math.round(state.tiger.x * 10) / 10,
            y: Math.round(state.tiger.y * 10) / 10,
            direction: state.tiger.direction,
            anim: "idle",
            isOutside: state.tiger.isOutside
          }, null, roomId));
        }
      }
    }

    // Natural fatigue, hunger, and unified distress check
    if (karipOnline || gabinOnline) {
      if (!state.lastDecay || now - state.lastDecay > 3500) {
        state.lastDecay = now;
        state.stats.hunger = Math.max(0, state.stats.hunger - 0.25);
        state.stats.energy = Math.max(0, state.stats.energy - 0.2);
        state.stats.homeComfort = Math.max(0, state.stats.homeComfort - 0.15);
        state.stats.mood = Math.max(0, state.stats.mood - 0.15);

        let distress = { active: false, icon: null, text: null };
        if (state.stats.energy <= 0) distress = { active: true, type: "lemas", icon: "💫", text: "[LEMAS]" };
        else if (state.stats.hunger <= 0) distress = { active: true, type: "lapar", icon: "🍙", text: "[LAPAR]" };
        else if (state.stats.mood <= 0) distress = { active: true, type: "sedih", icon: "😢", text: "[MURUNG]" };
        else if (state.stats.homeComfort <= 0) distress = { active: true, type: "risih", icon: "🧹", text: "[RISIH]" };

        for (const r of ["karip", "gabin"]) {
          const p = state.players[r];
          if (!p) continue;
          const prevActive = p.distress ? p.distress.active : false;
          p.distress = distress;
          p.isSick = distress.active;
          if (distress.active !== prevActive) {
            broadcastToRoom(roomId, createEnvelope("player_distress", {
              role: r,
              distress
            }, null, roomId));
          }
        }
      }
    }

    // Task completions
    const completedTasks = tickRoomTasks(state, now);
    for (const comp of completedTasks) {
      let distress = { active: false, icon: null, text: null };
      if (state.stats.energy <= 0) distress = { active: true, type: "lemas", icon: "💫", text: "[LEMAS]" };
      else if (state.stats.hunger <= 0) distress = { active: true, type: "lapar", icon: "🍙", text: "[LAPAR]" };
      else if (state.stats.mood <= 0) distress = { active: true, type: "sedih", icon: "😢", text: "[MURUNG]" };
      else if (state.stats.homeComfort <= 0) distress = { active: true, type: "risih", icon: "🧹", text: "[RISIH]" };

      for (const r of ["karip", "gabin"]) {
        if (state.players[r]) {
          state.players[r].distress = distress;
          state.players[r].isSick = distress.active;
        }
      }

      broadcastToRoom(roomId, createEnvelope("task_completed", {
        taskId: comp.taskId,
        title: comp.title,
        participants: comp.participants,
        effects: comp.effects,
        stats: state.stats,
        objects: state.objects,
        distress,
        players: state.players
      }, null, roomId));
    }

    // Clear expired speech bubbles
    for (const role of ["karip", "gabin"]) {
      const p = state.players[role];
      if (p.bubble && now > p.bubble.expiresAt) {
        p.bubble = null;
        broadcastToRoom(roomId, createEnvelope("bubble_cleared", { role }, null, roomId));
      }
    }
  }

  // Periodic persistence every 5 seconds
  if (now - lastSaveTick >= 5000) {
    lastSaveTick = now;
    for (const roomId of roomManager.rooms.keys()) {
      roomManager.save(roomId);
    }
  }
}, TICK_INTERVAL_MS);
tickTimer.unref();

// Graceful termination
process.on("SIGINT", () => {
  for (const roomId of roomManager.rooms.keys()) {
    roomManager.save(roomId);
  }
  process.exit(0);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`GK Game Server running at http://${HOST}:${PORT}`);
    console.log(`Admin Panel : http://localhost:${PORT}/admin`);
    console.log(`WebSocket   : ws://${HOST}:${PORT}/ws`);
  });
}

module.exports = { server, roomManager, tickTimer };
