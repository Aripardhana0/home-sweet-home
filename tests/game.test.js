"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const { generateRoomCode, verifyPassword, hashRoomCode } = require("../src/auth");
const { RoomManager } = require("../src/rooms");
const { checkCollision } = require("../src/game-state");
const { processMoveIntent } = require("../src/movement");
const { findTask, startSoloTask, createCoopInvite, resolveCoopInvite, tickRoomTasks } = require("../src/tasks");

test("Auth: Room code and password security", () => {
  const code = generateRoomCode();
  assert.match(code, /^GK-[2-9A-HJ-NP-Z]{6}$/);

  const secret = "test-secret";
  const hash1 = hashRoomCode(code, secret);
  const hash2 = hashRoomCode(code.toLowerCase(), secret);
  assert.equal(hash1, hash2, "Hashing room code must be case-insensitive");

  assert.equal(verifyPassword("correct", "correct"), true);
  assert.equal(verifyPassword("wrong", "correct"), false);
  assert.equal(verifyPassword("", "correct"), false);
});

test("RoomManager: Atomic slot claims and reconnect token protection", () => {
  const tmpDir = path.join(__dirname, "tmp_rooms_" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const manager = new RoomManager("test-key", tmpDir);
    const created = manager.createRoom("Rumah Uji");

    assert.ok(created.roomId);
    assert.ok(created.code);

    const room = manager.findRoomByCode(created.code);
    assert.ok(room, "Room must be discoverable by its plain code");

    // Player 1 claims Karip
    const claim1 = manager.claimSlot(room.meta.roomId, "karip");
    assert.equal(claim1.ok, true);
    assert.ok(claim1.token);
    assert.equal(claim1.reconnected, false);

    // Player 2 attempts to claim Karip without token -> must fail
    const claim2 = manager.claimSlot(room.meta.roomId, "karip");
    assert.equal(claim2.ok, false);

    // Player 1 reconnects with matching token -> must succeed
    const reconnect = manager.claimSlot(room.meta.roomId, "karip", claim1.token);
    assert.equal(reconnect.ok, true);
    assert.equal(reconnect.reconnected, true);

    // Player 2 claims Gabin -> succeeds
    const claimGabin = manager.claimSlot(room.meta.roomId, "gabin");
    assert.equal(claimGabin.ok, true);
    assert.equal(room.meta.status, "active");

    // Release slot
    const released = manager.releaseSlot(room.meta.roomId, "karip");
    assert.equal(released, true);
    assert.equal(room.state.players.karip.claimed, false);

    // Custom room code support
    const custom = manager.createRoom("Rumah Impian", "KITA-BERDUA");
    assert.equal(custom.ok, true);
    assert.equal(custom.code, "KITA-BERDUA");
    const foundCustom = manager.findRoomByCode("kita-berdua");
    assert.ok(foundCustom);
    assert.equal(foundCustom.meta.roomId, custom.roomId);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Movement: Wall collision prevents passing through boundaries", () => {
  // Test outer left wall boundary
  assert.equal(checkCollision(25, 100), true, "X <= 35 must collide with outer wall");
  assert.equal(checkCollision(200, 200), false, "Open space in room should not collide");

  // Move intent sliding against boundary
  const player = { x: 40, y: 100, direction: "down", anim: "idle", activeTask: null };
  const moved = processMoveIntent(player, { dx: -1, dy: 0 }, 0.05);
  // Target X is 40 - step (~32px), which collides with wall (x < 35), so player cannot move past 35
  assert.ok(player.x >= 35, "Player cannot penetrate wall boundary");
});

test("Tasks: Solo task execution and co-op consent handshake", () => {
  const tmpDir = path.join(__dirname, "tmp_tasks_" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const manager = new RoomManager("test-key", tmpDir);
    const created = manager.createRoom("Rumah Uji");
    const room = manager.getRoom(created.roomId);

    manager.claimSlot(created.roomId, "karip");
    manager.claimSlot(created.roomId, "gabin");

    const state = room.state;
    state.players.karip.online = true;
    state.players.gabin.online = true;

    // Solo task too far -> fails
    state.players.karip.x = 800;
    state.players.karip.y = 600;
    const farResult = startSoloTask(state, "karip", "PER-01"); // bed is at (60, 50)
    assert.equal(farResult.ok, false);

    // Move player near bed
    state.players.karip.x = 180;
    state.players.karip.y = 110;
    const startResult = startSoloTask(state, "karip", "PER-01");
    assert.equal(startResult.ok, true);
    assert.ok(state.players.karip.activeTask);

    // Fast-forward tick to complete task
    const future = Date.now() + 5000;
    const completed = tickRoomTasks(state, future);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].taskId, "PER-01");
    assert.equal(state.players.karip.activeTask, null);

    // Co-op task consent flow: KIT-17 (Sarapan bersama)
    // Place both players near dining table
    state.players.karip.x = 200;
    state.players.karip.y = 525;
    state.players.gabin.x = 220;
    state.players.gabin.y = 525;

    const inviteResult = createCoopInvite(state, "karip", "KIT-17");
    assert.equal(inviteResult.ok, true);
    assert.ok(state.activeInvite);

    // Gabin accepts invite
    const resolveResult = resolveCoopInvite(state, "gabin", inviteResult.invite.id, true);
    assert.equal(resolveResult.ok, true);
    assert.equal(resolveResult.accepted, true);
    assert.ok(state.players.karip.activeTask);
    assert.ok(state.players.gabin.activeTask);

    // Complete co-op task
    const coCompleted = tickRoomTasks(state, Date.now() + 10000);
    assert.equal(coCompleted.length, 1);
    assert.equal(coCompleted[0].taskId, "KIT-17");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, { agent: false }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

test("HTTP Server: Serves healthcheck, index, admin, and guards paths", async () => {
  const { server } = require("../server");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const port = server.address().port;

  try {
    // Healthcheck
    const resHealth = await httpGet(port, "/healthz");
    assert.equal(resHealth.status, 200);
    const dataHealth = JSON.parse(resHealth.body);
    assert.equal(dataHealth.status, "ok");

    // Main page
    const resIndex = await httpGet(port, "/");
    assert.equal(resIndex.status, 200);
    assert.ok(resIndex.body.includes("RUMAH KECIL-KECILAN"));

    // Admin page
    const resAdmin = await httpGet(port, "/admin");
    assert.equal(resAdmin.status, 200);
    assert.ok(resAdmin.body.includes("RUMAH KECIL-KECILAN"));

    // Path traversal guard
    const resEscape = await httpGet(port, "/../../package.json");
    assert.ok(resEscape.status === 403 || resEscape.status === 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
