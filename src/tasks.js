"use strict";

const { getTaskCatalog } = require("./game-state");

function findTask(taskId) {
  const catalog = getTaskCatalog();
  return catalog.find((t) => t.id === taskId) || null;
}

function checkProximity(player, targetObject, roomState) {
  if (!player || !targetObject) return false;

  // Task directed at partner
  if (targetObject === "partner") {
    const otherRole = player.role === "karip" ? "gabin" : "karip";
    const partner = roomState.players[otherRole];
    if (!partner || !partner.online) return false;
    const dist = Math.hypot(player.x - partner.x, player.y - partner.y);
    return dist <= 95;
  }

  // Task directed at the tiger
  if (targetObject === "tiger" || (targetObject && targetObject.id === "tiger")) {
    if (!roomState.tiger) return false;
    const dist = Math.hypot(player.x - roomState.tiger.x, player.y - roomState.tiger.y);
    return dist <= 110;
  }
  // Task directed at room furniture
  const targetX = targetObject.interactX ?? (targetObject.x + targetObject.w / 2);
  const targetY = targetObject.interactY ?? (targetObject.y + targetObject.h / 2);
  const maxDist = (targetObject.radius || 60) + 35;
  const dist = Math.hypot(player.x - targetX, player.y - targetY);
  return dist <= maxDist;
}

function applyStatDelta(stats, effects) {
  if (!effects || typeof effects !== "object") return;
  for (const [key, delta] of Object.entries(effects)) {
    if (typeof stats[key] === "number") {
      stats[key] = Math.max(0, Math.min(100, stats[key] + delta));
    }
  }
}

function startSoloTask(roomState, role, taskId) {
  const task = findTask(taskId);
  if (!task) return { ok: false, error: "Task tidak terdaftar" };
  if (task.mode === "co-op") {
    return { ok: false, error: "Task ini memerlukan ajakan dan persetujuan pasangan (co-op)" };
  }

  const player = roomState.players[role];
  if (!player || !player.online) return { ok: false, error: "Pemain tidak aktif" };
  if (player.activeTask) return { ok: false, error: "Pemain sedang mengerjakan aktivitas lain" };

  // Check cooldown
  const cooldownUntil = roomState.tasks.cooldowns[taskId] || 0;
  if (Date.now() < cooldownUntil) {
    const remainSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
    return { ok: false, error: `Tugas sedang cooldown (${remainSec} detik)` };
  }

  // Check proximity
  const targetObj = task.objectId === "partner" ? "partner" : roomState.objects[task.objectId];
  if (!targetObj) return { ok: false, error: "Objek interaksi tidak ditemukan" };
  if (!checkProximity(player, targetObj, roomState)) {
    return { ok: false, error: "Pemain terlalu jauh dari objek tugas" };
  }

  const now = Date.now();
  const activeTask = {
    taskId: task.id,
    title: task.title,
    animation: task.animation || "work",
    startTime: now,
    durationMs: task.durationMs,
    expiresAt: now + task.durationMs,
    participants: [role]
  };

  player.activeTask = activeTask;
  player.anim = task.animation || "work";

  return { ok: true, activeTask };
}

function createCoopInvite(roomState, fromRole, taskId) {
  const task = findTask(taskId);
  if (!task) return { ok: false, error: "Task tidak terdaftar" };
  if (task.mode !== "co-op") return { ok: false, error: "Task ini bukan tugas bersama" };

  const fromPlayer = roomState.players[fromRole];
  const toRole = fromRole === "karip" ? "gabin" : "karip";
  const toPlayer = roomState.players[toRole];

  if (!fromPlayer || !fromPlayer.online) return { ok: false, error: "Pemain tidak aktif" };
  if (!toPlayer || !toPlayer.online) return { ok: false, error: "Pasangan sedang offline" };
  if (fromPlayer.activeTask || toPlayer.activeTask) {
    return { ok: false, error: "Salah satu pemain sedang sibuk dengan aktivitas lain" };
  }

  // Check proximity to object/partner
  const targetObj = task.objectId === "partner" ? "partner" : roomState.objects[task.objectId];
  if (targetObj && !checkProximity(fromPlayer, targetObj, roomState)) {
    return { ok: false, error: "Pemain terlalu jauh dari lokasi aktivitas" };
  }

  const invite = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    taskId: task.id,
    taskTitle: task.title,
    fromRole,
    toRole,
    createdAt: Date.now(),
    expiresAt: Date.now() + 25000 // 25s consent window
  };

  roomState.activeInvite = invite;
  return { ok: true, invite };
}

function resolveCoopInvite(roomState, toRole, inviteId, accept) {
  const invite = roomState.activeInvite;
  if (!invite || invite.id !== inviteId) {
    return { ok: false, error: "Undangan tidak ditemukan atau sudah kadaluarsa" };
  }
  if (invite.toRole !== toRole) {
    return { ok: false, error: "Anda bukan penerima undangan ini" };
  }
  if (Date.now() > invite.expiresAt) {
    roomState.activeInvite = null;
    return { ok: false, error: "Undangan sudah kadaluarsa" };
  }

  roomState.activeInvite = null;

  if (!accept) {
    return { ok: true, accepted: false, taskId: invite.taskId, fromRole: invite.fromRole };
  }

  const task = findTask(invite.taskId);
  if (!task) return { ok: false, error: "Task tidak valid" };

  const p1 = roomState.players[invite.fromRole];
  const p2 = roomState.players[invite.toRole];

  const now = Date.now();
  const activeTask = {
    taskId: task.id,
    title: task.title,
    animation: task.animation || "work",
    startTime: now,
    durationMs: task.durationMs,
    expiresAt: now + task.durationMs,
    participants: [invite.fromRole, invite.toRole]
  };

  p1.activeTask = activeTask;
  p2.activeTask = activeTask;
  p1.anim = task.animation || "work";
  p2.anim = task.animation || "work";

  return { ok: true, accepted: true, activeTask };
}

function tickRoomTasks(roomState, now = Date.now()) {
  const completed = [];

  for (const role of ["karip", "gabin"]) {
    const player = roomState.players[role];
    if (!player || !player.activeTask) continue;

    // Check if task completed
    if (now >= player.activeTask.expiresAt) {
      const taskId = player.activeTask.taskId;
      const task = findTask(taskId);

      // Only process reward and completion once per unique task execution
      if (!completed.some((c) => c.taskId === taskId)) {
        if (task) {
          applyStatDelta(roomState.stats, task.effects);
          roomState.tasks.cooldowns[taskId] = now + (task.cooldownMs || 60000);

          // Special trigger: Toggle tiger gate open/close
          if (taskId === "TIG-01") {
            const gate = roomState.objects.tiger_gate;
            if (gate) {
              gate.state = gate.state === "open" ? "closed" : "open";
              gate.solid = gate.state === "closed";
              if (roomState.tiger) {
                roomState.tiger.isOutside = gate.state === "open";
              }
            }
          }

          // Update sick / health status
          const isExhausted = roomState.stats.energy <= 0 || roomState.stats.hunger <= 0;
          const isRecovered = roomState.stats.energy >= 35 && roomState.stats.hunger >= 35;
          for (const r of ["karip", "gabin"]) {
            const p = roomState.players[r];
            if (!p) continue;
            if (isExhausted) p.isSick = true;
            else if (isRecovered) p.isSick = false;
          }

          roomState.tasks.completedToday.push({
            taskId,
            title: task.title,
            completedAt: now,
            by: player.activeTask.participants
          });
        }
        completed.push({
          taskId,
          title: task ? task.title : taskId,
          participants: player.activeTask.participants,
          effects: task ? task.effects : {}
        });
      }

      player.activeTask = null;
      player.anim = "idle";
    }
  }

  // Clear expired invite if any
  if (roomState.activeInvite && now > roomState.activeInvite.expiresAt) {
    roomState.activeInvite = null;
  }

  return completed;
}

module.exports = {
  findTask,
  checkProximity,
  startSoloTask,
  createCoopInvite,
  resolveCoopInvite,
  tickRoomTasks
};
