"use strict";

const CLIENT_WALLS = [
  { x: 20, y: 20, w: 1360, h: 15 },
  { x: 20, y: 865, w: 1360, h: 15 },
  { x: 20, y: 20, w: 15, h: 860 },
  { x: 1365, y: 20, w: 15, h: 860 },
  { x: 350, y: 35, w: 15, h: 180 },
  { x: 590, y: 35, w: 15, h: 180 },
  { x: 35, y: 310, w: 130, h: 15 },
  { x: 260, y: 310, w: 170, h: 15 },
  { x: 510, y: 310, w: 170, h: 15 },
  { x: 780, y: 310, w: 115, h: 15 },
  { x: 880, y: 35, w: 15, h: 120 },
  { x: 880, y: 260, w: 15, h: 100 },
  { x: 880, y: 500, w: 15, h: 100 },
  { x: 430, y: 325, w: 15, h: 65 },
  { x: 430, y: 510, w: 15, h: 85 },
  { x: 35, y: 600, w: 420, h: 15 },
  { x: 580, y: 600, w: 300, h: 15 },
  { x: 880, y: 600, w: 180, h: 15 },
  { x: 1200, y: 600, w: 165, h: 15 },
  { x: 750, y: 625, w: 580, h: 12 },
  { x: 1320, y: 625, w: 12, h: 220 },
  { x: 750, y: 835, w: 580, h: 12 },
  { x: 750, y: 625, w: 12, h: 70 },
  { x: 750, y: 765, w: 12, h: 80 }
];

function checkClientCollision(x, y, radius = 14, objects = null) {
  if (x - radius < 35 || x + radius > 1365 || y - radius < 35 || y + radius > 865) return true;
  for (let i = 0; i < CLIENT_WALLS.length; i++) {
    const w = CLIENT_WALLS[i];
    if (x + radius > w.x && x - radius < w.x + w.w && y + radius > w.y && y - radius < w.y + w.h) {
      return true;
    }
  }
  if (objects) {
    for (const obj of Object.values(objects)) {
      if (!obj.solid) continue;
      if (x + radius > obj.x && x - radius < obj.x + obj.w && y + radius > obj.y && y - radius < obj.y + obj.h) {
        return true;
      }
    }
  }
  return false;
}
class InputManager {
  constructor(network, getGameState, getLocalRole) {
    this.network = network;
    this.getGameState = getGameState;
    this.getLocalRole = getLocalRole;
    this.keys = new Set();
    this.touchDirection = { dx: 0, dy: 0 };
    this.moveInterval = null;
    this.setupListeners();
    this.bindTouchControls();
  }

  setupListeners() {
    window.addEventListener("keydown", (e) => {
      // Ignore if typing in text inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      this.keys.add(e.code);

      // Interact trigger
      if (e.code === "KeyE") {
        this.triggerInteraction();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
    });

    // 20 TPS move intent dispatcher
    this.moveInterval = setInterval(() => this.dispatchMoveIntent(), 50);
  }

  dispatchMoveIntent() {
    let dx = this.touchDirection.dx;
    let dy = this.touchDirection.dy;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      // Authoritative intent to server
      this.network.send("move_intent", { dx, dy, dt: 0.05 });

      // Client-Side Prediction: instant 0ms response on local avatar
      const state = this.getGameState();
      const role = this.getLocalRole();
      if (state && role && state.players && state.players[role] && !state.players[role].activeTask) {
        const p = state.players[role];
        const len = Math.hypot(dx, dy) || 1;
        const speed = p.isSick ? 55 : 125;
        const step = 0.05 * speed;
        const ndx = (dx / len) * step;
        const ndy = (dy / len) * step;

        const objs = state.objects || null;
        let moved = false;

        if (!checkClientCollision(targetX, targetY, 14, objs)) {
          p.x = Math.round(targetX * 10) / 10;
          p.y = Math.round(targetY * 10) / 10;
          moved = true;
        } else {
          if (!checkClientCollision(targetX, p.y, 14, objs)) {
            p.x = Math.round(targetX * 10) / 10;
            moved = true;
          } else if (!checkClientCollision(p.x, targetY, 14, objs)) {
            p.y = Math.round(targetY * 10) / 10;
            moved = true;
          }
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          p.direction = dx > 0 ? "right" : "left";
        } else if (Math.abs(dy) > 0) {
          p.direction = dy > 0 ? "down" : "up";
        }
        p.anim = "walk";
      }
    }
  }

  bindTouchControls() {
    const bindBtn = (id, dx, dy) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        this.touchDirection.dx = dx;
        this.touchDirection.dy = dy;
        el.classList.add("active");
      };
      const end = (e) => {
        e.preventDefault();
        if (this.touchDirection.dx === dx) this.touchDirection.dx = 0;
        if (this.touchDirection.dy === dy) this.touchDirection.dy = 0;
        el.classList.remove("active");
      };
      el.addEventListener("touchstart", start, { passive: false });
      el.addEventListener("touchend", end, { passive: false });
      el.addEventListener("touchcancel", end, { passive: false });
      el.addEventListener("mousedown", start);
      el.addEventListener("mouseup", end);
      el.addEventListener("mouseleave", end);
    };

    bindBtn("dpadUp", 0, -1);
    bindBtn("dpadDown", 0, 1);
    bindBtn("dpadLeft", -1, 0);
    bindBtn("dpadRight", 1, 0);

    const actionBtn = document.getElementById("dpadAction");
    if (actionBtn) {
      actionBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.triggerInteraction();
      });
      actionBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.triggerInteraction();
      }, { passive: false });
    }
  }

  triggerInteraction() {
    const state = this.getGameState();
    const role = this.getLocalRole();
    if (!state || !role || !state.players || !state.players[role]) return;

    const player = state.players[role];
    if (player.activeTask) {
      // If currently busy, E cancels task
      this.network.send("task_cancel", {});
      return;
    }

    // Check nearby interactive object
    if (state.objects) {
      for (const obj of Object.values(state.objects)) {
        const targetX = obj.interactX ?? (obj.x + obj.w / 2);
        const targetY = obj.interactY ?? (obj.y + obj.h / 2);
        const maxDist = (obj.radius || 60) + 25;
        const dist = Math.hypot(player.x - targetX, player.y - targetY);

        if (dist <= maxDist) {
          window.dispatchEvent(new CustomEvent("gk:open-tasks-for-object", {
            detail: { objectId: obj.id, objectName: obj.name }
          }));
          return;
        }
      }
    }
    // Check nearby tiger
    if (state.tiger) {
      const dist = Math.hypot(player.x - state.tiger.x, player.y - state.tiger.y);
      if (dist <= 85) {
        window.dispatchEvent(new CustomEvent("gk:open-tasks-for-object", {
          detail: { objectId: "tiger", objectName: "Mamacan" }
        }));
        return;
      }
    }

    // Check nearby partner
    const otherRole = role === "karip" ? "gabin" : "karip";
    const partner = state.players[otherRole];
    if (partner && partner.online) {
      const dist = Math.hypot(player.x - partner.x, player.y - partner.y);
      if (dist <= 85) {
        window.dispatchEvent(new CustomEvent("gk:open-tasks-for-object", {
          detail: { objectId: "partner", objectName: otherRole === "karip" ? "Karip" : "Gabin" }
        }));
      }
    }
  }
}

window.InputManager = InputManager;
