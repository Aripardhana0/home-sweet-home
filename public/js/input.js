"use strict";

class InputManager {
  constructor(network, getGameState, getLocalRole) {
    this.network = network;
    this.getGameState = getGameState;
    this.getLocalRole = getLocalRole;

    this.keys = new Set();
    this.moveInterval = null;
    this.setupListeners();
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
    let dx = 0;
    let dy = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.network.send("move_intent", { dx, dy, dt: 0.05 });
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
          detail: { objectId: "tiger", objectName: "Macan (Si Belang)" }
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
